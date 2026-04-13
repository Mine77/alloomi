/**
 * WeChat iLink long-polling listener (parallel to QQ WebSocket listener)
 * One loop per integration account, fetches USER text messages and forwards to handler
 */
import {
  getIntegrationAccountsByUserId,
  loadIntegrationCredentials,
  bulkUpsertContacts,
} from "@/lib/db/queries";
import type { IntegrationAccountWithBot } from "@/lib/db/queries";
import {
  weixinGetUpdates,
  weixinGetConfig,
  weixinSendTyping,
  downloadAndDecryptBuffer,
  detectImageMimeType,
  CDN_BASE_URL,
  MessageType as MSG_TYPE,
  MessageItemType,
  TypingStatus,
} from "./ilink-client";
import type { WeixinIlinkCredentials } from "./ilink-client";
import type { WeixinMessage } from "./ilink-client";
import { handleWeixinInboundMessage } from "./handler";

const DEBUG = process.env.DEBUG_WEIXIN === "true";
const DEDUP_TTL_MS = 5 * 60 * 1000;
const processedMessageIds = new Map<string, number>();

// Use official library enum constants (MessageType, MessageItemType)
const MSG_TYPE_BOT = MSG_TYPE.BOT;
const TEXT_ITEM_TYPE = MessageItemType.TEXT;
const IMAGE_ITEM_TYPE = MessageItemType.IMAGE;
const VOICE_ITEM_TYPE = MessageItemType.VOICE;
const FILE_ITEM_TYPE = MessageItemType.FILE;
const VIDEO_ITEM_TYPE = MessageItemType.VIDEO;

type WeixinConn = {
  accountId: string;
  userId: string;
  account: Awaited<ReturnType<typeof getIntegrationAccountsByUserId>>[number];
  credentials: WeixinIlinkCredentials;
  authToken?: string;
  stopped: boolean;
  loopPromise: Promise<void> | null;
};

const connections = new Map<string, WeixinConn>();

function pruneProcessedIds(): void {
  const now = Date.now();
  for (const [key, ts] of processedMessageIds.entries()) {
    if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(key);
  }
}

/** Image CDN download task, executed asynchronously in message loop */
type ImageDownloadTask = {
  encryptQueryParam: string;
  /** AES-128 key in base64 format (converted uniformly before passing to cdnDownloadAndDecrypt) */
  aesKeyBase64: string;
};

/** File download task (voice/file) */
type FileDownloadTask = {
  encryptQueryParam: string;
  aesKeyBase64: string;
  fileName: string;
  mimeType: string;
  hintOnSuccess?: string;
};

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

function guessMimeTypeByFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".amr")) return "audio/amr";
  if (lower.endsWith(".silk")) return "audio/silk";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function voiceExtByEncodeType(encodeType?: number): string {
  switch (encodeType) {
    case 5:
      return "amr";
    case 6:
      return "silk";
    case 7:
      return "mp3";
    case 8:
      return "ogg";
    default:
      return "audio";
  }
}

/**
 * Extract text content, media hints, and image download tasks from messages
 * - Text messages: extract body
 * - Voice messages: use server-side transcription (if available); otherwise record duration description
 * - Images: collect download tasks (deferred to async download in loop)
 * - Video/files: generate descriptive hints to inform AI of message type
 */
function extractContent(msg: WeixinMessage): {
  text: string;
  mediaHints: string[];
  imageDownloadTasks: ImageDownloadTask[];
  fileDownloadTasks: FileDownloadTask[];
} {
  const items = msg.item_list ?? [];
  let text = "";
  const mediaHints: string[] = [];
  const imageDownloadTasks: ImageDownloadTask[] = [];
  const fileDownloadTasks: FileDownloadTask[] = [];

  for (const it of items) {
    switch (it.type) {
      case TEXT_ITEM_TYPE:
        if (it.text_item?.text) {
          text = it.text_item.text.trim();
        }
        break;

      case IMAGE_ITEM_TYPE: {
        const img = it.image_item;
        const encryptQueryParam = img?.media?.encrypt_query_param;
        if (encryptQueryParam) {
          // aeskey is hex format (preferred), needs to be converted to base64; media.aes_key is already base64
          const aesKeyBase64 = img?.aeskey
            ? Buffer.from(img.aeskey, "hex").toString("base64")
            : img?.media?.aes_key;
          if (aesKeyBase64) {
            imageDownloadTasks.push({ encryptQueryParam, aesKeyBase64 });
          } else {
            mediaHints.push("[User sent an image (missing decryption key)]");
          }
        } else {
          mediaHints.push("[User sent an image]");
        }
        break;
      }

      case VOICE_ITEM_TYPE: {
        const voiceMedia = it.voice_item?.media;
        const voiceEncryptQueryParam = voiceMedia?.encrypt_query_param;
        const voiceAesKeyBase64 = voiceMedia?.aes_key;
        const voiceText = it.voice_item?.text?.trim();
        const durationSec = Math.round((it.voice_item?.playtime ?? 0) / 1000);
        if (voiceText) {
          // Server already provided voice-to-text, use directly as user text input
          text = voiceText;
          if (durationSec > 0) {
            mediaHints.push(
              `[Voice message, duration ${durationSec}s, below is the transcribed content]`,
            );
          }
        } else {
          mediaHints.push(
            durationSec > 0
              ? `[User sent a ${durationSec}s voice message (no transcription text yet)]`
              : "[User sent a voice message]",
          );

          // When no server-side transcription, download voice and pass as attachment to Agent for subsequent auto-transcription
          if (voiceEncryptQueryParam && voiceAesKeyBase64) {
            const ext = voiceExtByEncodeType(it.voice_item?.encode_type);
            const fileName = `weixin-voice-${msg.message_id ?? Date.now()}.${ext}`;
            fileDownloadTasks.push({
              encryptQueryParam: voiceEncryptQueryParam,
              aesKeyBase64: voiceAesKeyBase64,
              fileName,
              mimeType: guessMimeTypeByFileName(fileName),
              hintOnSuccess:
                durationSec > 0
                  ? `[Downloaded voice attachment: ${fileName} (${durationSec}s), can try auto-transcription]`
                  : `[Downloaded voice attachment: ${fileName}, can try auto-transcription]`,
            });
          }
        }
        break;
      }

      case FILE_ITEM_TYPE: {
        const fileName = it.file_item?.file_name?.trim() || "Unknown file";
        const fileSizeBytes = Number(it.file_item?.len ?? 0);
        const fileSizeStr =
          fileSizeBytes > 0
            ? fileSizeBytes >= 1024 * 1024
              ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
              : `${Math.round(fileSizeBytes / 1024)} KB`
            : "Unknown size";
        mediaHints.push(
          `[User sent a file: ${fileName}, size: ${fileSizeStr}]`,
        );

        const fileEncryptQueryParam = it.file_item?.media?.encrypt_query_param;
        const fileAesKeyBase64 = it.file_item?.media?.aes_key;
        if (fileEncryptQueryParam && fileAesKeyBase64) {
          fileDownloadTasks.push({
            encryptQueryParam: fileEncryptQueryParam,
            aesKeyBase64: fileAesKeyBase64,
            fileName,
            mimeType: guessMimeTypeByFileName(fileName),
            hintOnSuccess: `[Downloaded file attachment: ${fileName}]`,
          });
        }
        break;
      }

      case VIDEO_ITEM_TYPE: {
        const videoSec = Math.round((it.video_item?.play_length ?? 0) / 1000);
        mediaHints.push(
          videoSec > 0
            ? `[用户发送了一段 ${videoSec} 秒的视频]`
            : "[用户发送了一段视频]",
        );
        break;
      }

      default:
        if (DEBUG && it.type) {
          console.log("[Weixin] 未识别的消息 item 类型:", it.type);
        }
    }
  }

  return { text, mediaHints, imageDownloadTasks, fileDownloadTasks };
}

function runPollLoop(conn: WeixinConn): void {
  let buf = "";

  const tick = async (): Promise<void> => {
    while (!conn.stopped) {
      try {
        const resp = await weixinGetUpdates({
          credentials: conn.credentials,
          getUpdatesBuf: buf,
        });
        if (typeof resp.get_updates_buf === "string") {
          buf = resp.get_updates_buf;
        }
        // errcode=-14: iLink session or Token has expired, need to re-authorize to continue receiving messages
        if (resp.ret !== 0 && resp.errcode === -14) {
          console.error(
            "[Weixin] iLink 会话已失效 (errcode=-14)，已停止该账号长轮询。请在应用内「集成账号 → 微信」重新扫码绑定，或更新该账号的 iLink Token。accountId=%s",
            conn.accountId,
          );
          conn.stopped = true;
          connections.delete(conn.accountId);
          return;
        }
        const nextTimeout = resp.longpolling_timeout_ms;
        const msgs = resp.msgs ?? [];
        for (const raw of msgs) {
          if (conn.stopped) return;
          // Skip bot's own messages
          if (raw.message_type === MSG_TYPE_BOT) {
            continue;
          }
          const fromId = raw.from_user_id?.trim();
          if (!fromId) continue;
          const { text, mediaHints, imageDownloadTasks, fileDownloadTasks } =
            extractContent(raw);
          // Skip if both text and media hints are empty (empty message)
          if (
            !text &&
            mediaHints.length === 0 &&
            imageDownloadTasks.length === 0
          )
            continue;
          const messageId = String(
            raw.message_id ?? raw.seq ?? `${fromId}-${raw.create_time_ms}`,
          );
          const contextToken = raw.context_token?.trim() ?? "";
          if (!contextToken) {
            if (DEBUG)
              console.warn(
                "[Weixin] 消息无 context_token，跳过 messageId=%s",
                messageId,
              );
            continue;
          }

          const dedupKey = `${conn.accountId}:${messageId}`;
          if (processedMessageIds.has(dedupKey)) continue;
          processedMessageIds.set(dedupKey, Date.now());
          pruneProcessedIds();

          // Download images (CDN AES-128-ECB decryption)
          const downloadedImages: Array<{ data: string; mimeType: string }> =
            [];
          const downloadedFiles: Array<{
            name: string;
            data: string;
            mimeType: string;
          }> = [];
          if (imageDownloadTasks.length > 0) {
            const cdnBase = conn.credentials.baseUrl?.trim()
              ? CDN_BASE_URL // Always use dedicated CDN URL, unrelated to iLink API base
              : CDN_BASE_URL;
            for (const task of imageDownloadTasks) {
              try {
                const buf = await downloadAndDecryptBuffer(
                  task.encryptQueryParam,
                  task.aesKeyBase64,
                  cdnBase,
                  "ws-listener-image",
                );
                const mimeType = detectImageMimeType(buf);
                downloadedImages.push({
                  data: buf.toString("base64"),
                  mimeType,
                });
                if (DEBUG) {
                  console.log(
                    `[Weixin] 图片下载解密成功 ${buf.length} bytes mimeType=${mimeType}`,
                  );
                }
              } catch (err) {
                console.error("[Weixin] 图片 CDN 下载/解密失败:", err);
                mediaHints.push("[用户发送了一张图片（下载失败）]");
              }
            }
          }

          // Download voice/file (CDN AES-128-ECB decryption) and forward to Agent as file attachment
          if (fileDownloadTasks.length > 0) {
            const cdnBase = CDN_BASE_URL;
            for (const task of fileDownloadTasks) {
              try {
                const buf = await downloadAndDecryptBuffer(
                  task.encryptQueryParam,
                  task.aesKeyBase64,
                  cdnBase,
                  "ws-listener-file",
                );
                if (buf.length > MAX_ATTACHMENT_SIZE_BYTES) {
                  mediaHints.push(
                    `[附件 ${task.fileName} 过大（${(buf.length / 1024 / 1024).toFixed(1)}MB），已跳过自动解析]`,
                  );
                  continue;
                }
                downloadedFiles.push({
                  name: task.fileName,
                  data: buf.toString("base64"),
                  mimeType: task.mimeType,
                });
                if (task.hintOnSuccess) {
                  mediaHints.push(task.hintOnSuccess);
                }
              } catch (err) {
                console.error("[Weixin] 文件/语音 CDN 下载或解密失败:", err);
                mediaHints.push(`[附件 ${task.fileName} 下载失败]`);
              }
            }
          }

          const mediaDesc =
            mediaHints.length > 0 ||
            downloadedImages.length > 0 ||
            downloadedFiles.length > 0
              ? ` [含媒体: ${[
                  ...mediaHints,
                  ...downloadedImages.map((_, i) => `图片${i + 1}`),
                  ...downloadedFiles.map((f) => `附件:${f.name}`),
                ].join(", ")}]`
              : "";
          console.log(
            `[Weixin] 收到消息 messageId=${messageId} fromId=${fromId.slice(0, 12)}… contextToken=${contextToken.slice(0, 16)}…(len=${contextToken.length})${mediaDesc}`,
          );

          const acc = conn.account as IntegrationAccountWithBot;
          if (!acc.bot) continue;

          await bulkUpsertContacts([
            {
              userId: acc.userId,
              contactId: fromId,
              contactName: fromId,
              type: "private",
              botId: acc.bot.id,
              contactMeta: {
                platform: "weixin",
                lastContextToken: contextToken,
              },
            },
          ]).catch((err) =>
            console.error("[Weixin] bulkUpsertContacts 失败", err),
          );

          // Send "typing" status hint so user knows AI is processing
          weixinGetConfig({
            credentials: conn.credentials,
            ilinkUserId: fromId,
            contextToken,
          })
            .then((cfg) => {
              const ticket = cfg.typing_ticket?.trim();
              if (!ticket) return;
              return weixinSendTyping({
                credentials: conn.credentials,
                ilinkUserId: fromId,
                typingTicket: ticket,
                status: TypingStatus.TYPING,
              });
            })
            .catch((err) => {
              if (DEBUG) console.warn("[Weixin] sendTyping 失败（忽略）:", err);
            });

          setImmediate(() => {
            handleWeixinInboundMessage(
              acc,
              {
                fromUserId: fromId,
                messageId,
                text,
                mediaHints,
                images: downloadedImages,
                fileAttachments: downloadedFiles,
                contextToken,
              },
              { authToken: conn.authToken },
            ).catch((err) => console.error("[Weixin] 处理消息失败", err));
          });
        }
        // Use server-suggested timeout if available
        if (typeof nextTimeout === "number" && nextTimeout > 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      } catch (e) {
        if (conn.stopped) return;
        console.error(
          "[Weixin] getUpdates 异常 accountId=%s",
          conn.accountId,
          e,
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };

  conn.loopPromise = tick();
}

export async function startWeixinConnection(
  account: Awaited<ReturnType<typeof getIntegrationAccountsByUserId>>[number],
  authToken?: string,
): Promise<void> {
  if (account.platform !== "weixin") return;

  const raw = loadIntegrationCredentials<{
    ilinkToken?: string;
    baseUrl?: string;
    routeTag?: string;
  }>(account);
  const ilinkToken = raw?.ilinkToken?.trim();
  if (!ilinkToken) {
    if (DEBUG) console.warn("[Weixin] 账户 %s 缺少 ilinkToken", account.id);
    return;
  }

  const credentials: WeixinIlinkCredentials = {
    ilinkToken,
    baseUrl: raw?.baseUrl?.trim() || undefined,
    routeTag: raw?.routeTag?.trim() || undefined,
  };

  const accountId = account.id;
  const existing = connections.get(accountId);
  if (existing) {
    if (authToken?.trim()) existing.authToken = authToken.trim();
    if (DEBUG) console.log("[Weixin] 账户 %s 已在监听中", accountId);
    return;
  }

  const conn: WeixinConn = {
    accountId,
    userId: account.userId,
    account,
    credentials,
    authToken: authToken?.trim(),
    stopped: false,
    loopPromise: null,
  };
  connections.set(accountId, conn);
  if (DEBUG) console.log("[Weixin] 启动长轮询 accountId=%s", accountId);
  runPollLoop(conn);
}

export function stopWeixinConnection(accountId: string): void {
  const conn = connections.get(accountId);
  if (!conn) return;
  conn.stopped = true;
  connections.delete(accountId);
  if (DEBUG) console.log("[Weixin] 已停止 accountId=%s", accountId);
}

export async function startWeixinListenersForUser(
  userId: string,
  authToken?: string,
): Promise<void> {
  const accounts = await getIntegrationAccountsByUserId({ userId });
  const list = accounts.filter((a) => a.platform === "weixin");
  for (const account of list) {
    await startWeixinConnection(account, authToken);
  }
}

export async function startAllWeixinListeners(): Promise<void> {
  const { db } = await import("@/lib/db");
  const { integrationAccounts } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({ userId: integrationAccounts.userId })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.platform, "weixin"));

  const userIdList = rows
    .map((r: { userId: string | null }) => r.userId)
    .filter(
      (id: string | null): id is string =>
        typeof id === "string" && id.length > 0,
    );
  const uniqueIds = Array.from(new Set<string>(userIdList));
  for (const userId of uniqueIds) {
    await startWeixinListenersForUser(userId);
  }
  if (DEBUG) console.log("[Weixin] 已启动 %s 个长轮询连接", rows.length);
}
