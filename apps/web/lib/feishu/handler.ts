/**
 * Feishu Bot Inbound Message Handler (Bot Mode)
 *
 * Unlike Telegram/iMessage self mode: this is "user → bot → Alloomi replies on behalf".
 * - One-in-one-out: each im.message.receive_v1 contains only one user message, generates one reply from that content, no session history.
 * - Input: the current text from user to bot; Output: sent back to that chat as the bot.
 * - Tauri: uses modelConfig to request /api/ai; Non-Tauri: direct LLM.
 */
import { sendReplyByBotId } from "@/lib/bots/send-reply";
import {
  type IntegrationAccountWithBot,
  getUserTypeForService,
  getUserById,
} from "@/lib/db/queries";
import { generateText } from "ai";
import { model, setAIUserContext, clearAIUserContext } from "@/lib/ai";
import {
  isTauriMode,
  DEFAULT_AI_MODEL,
  AI_PROXY_BASE_URL,
} from "@/lib/env/constants";
import { handleAgentRuntime } from "@/lib/ai/runtime/shared";

/**
 * Process single user message received by Feishu bot: use account owner's insight context + this message content to generate reply, sent as bot
 * Bot mode: only uses this params.text, no session history attached
 * @param options.authToken Cloud token for bot to call AI in Tauri mode
 */
export async function handleFeishuInboundMessage(
  account: IntegrationAccountWithBot,
  params: {
    chatId: string;
    messageId: string;
    senderId: string;
    senderName?: string;
    text: string;
    chatType: "p2p" | "group";
  },
  options?: { authToken?: string },
): Promise<void> {
  const { userId } = account;
  const bot = account.bot;
  if (!bot || bot.adapter !== "feishu") {
    console.warn("[Feishu] Account not linked to a Feishu bot, skipping");
    return;
  }

  const { chatId, text, messageId } = params;
  if (!text?.trim()) {
    return;
  }

  const LOG_FEISHU = process.env.DEBUG_FEISHU === "true";
  const logMsg = (label: string, ...args: unknown[]) => {
    if (LOG_FEISHU) console.log("[Feishu]", label, ...args);
  };

  try {
    const userType = await getUserTypeForService(userId);
    const user = await getUserById(userId);

    // Bot mode: only this user message as "current question", no session history
    const prompt = [
      "You are the Alloomi assistant. Help the user based on the following cross-platform message summaries.",
      "When information is insufficient, say so instead of making up content.",
      "",
      "=== User's question (this single message to the bot) ===",
      text,
      "",
      "Answer concisely.",
    ].join("\n");

    console.log(
      "[Feishu] Bot initiating model generation message_id=%s user message length=%d content=%s",
      messageId,
      text.length,
      text.slice(0, 200),
    );

    let answer: string;

    // In Tauri mode, consistent with Telegram/iMessage: only use the per-connection token passed during init, do not rely on global token
    if (isTauriMode()) {
      const token = options?.authToken;
      if (!token) {
        console.warn(
          "[Feishu] No cloud auth token found in Tauri mode, please complete cloud login and pass token when 'connecting Feishu'.",
        );
      }
      const replyParts: string[] = [];
      await handleAgentRuntime(
        prompt,
        {
          userId,
          conversation: [],
          stream: false,
          silentTools: true, // Don't spam user with tool_use notifications
          ...(token && {
            modelConfig: {
              apiKey: token,
              baseUrl: AI_PROXY_BASE_URL,
              model: DEFAULT_AI_MODEL,
            },
          }),
        },
        async (chunk) => {
          replyParts.push(chunk);
        },
        "feishu", // platform is only for agent logging
      );
      answer = replyParts.join("").trim();
    } else {
      setAIUserContext({
        id: userId,
        email: user?.email ?? "",
        name: user?.name ?? null,
        type: userType,
      });
      try {
        const result = await generateText({ model, prompt });
        answer = result.text.trim();
      } finally {
        clearAIUserContext();
      }
    }

    const toSend = answer || "I don't have enough context to answer that.";
    logMsg("sending full reply content", toSend.slice(0, 500));

    await sendReplyByBotId({
      id: bot.id,
      userId,
      recipients: [chatId],
      message: toSend,
      withAppSuffix: true,
    });
  } catch (error) {
    console.error("[Feishu] Failed to process inbound message:", error);
    try {
      await sendReplyByBotId({
        id: bot.id,
        userId,
        recipients: [chatId],
        message:
          "An error occurred while processing your message. Please try again later.",
        withAppSuffix: false,
      });
    } catch (e) {
      console.error("[Feishu] Failed to send error message:", e);
    }
  }
}
