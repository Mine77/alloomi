import { handleAgentRuntime as sharedHandleAgentRuntime } from "@/lib/ai/runtime/shared";
import {
  getTelegramAccountByTelegramUserId,
  updateTelegramAccountLastCommand,
  getUserTypeForService,
  getBotsByUserId,
  getUserById,
} from "@/lib/db/queries";
import { createTelegramLoginToken } from "@/lib/telegram/login-token";
import {
  sendTelegramMessage,
  sendTelegramTypingAction,
} from "@/lib/telegram/api";
import { generateText } from "ai";
import { model, setAIUserContext } from "@/lib/ai";
import { sendReplyByBotId } from "@/lib/bots/send-reply";

/**
 * Options for handleAgentRuntime
 */
export interface HandleAgentRuntimeOptions {
  conversation?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  images?: Array<{ data: string; mimeType: string }>;
  fileAttachments?: Array<{ name: string; data: string; mimeType: string }>;
  userId?: string; // Add userId for direct Agent calls
  workDir?: string; // Working directory for file operations
  aiSoulPrompt?: string | null; // User-defined AI Soul prompt
  modelConfig?: {
    // Model configuration for custom API endpoints
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  accountId?: string; // Account ID for per-day file persistence (used by compaction)
}

/**
 * Handle agent runtime call - When user sends message to themselves (Saved Messages)
 * This provides full Claude Agent Runtime capabilities like in web interface
 *
 * @param prompt - The message content
 * @param optionsOrCallback - Either options object or reply callback for backward compatibility
 * @param callback - Reply callback (if options is provided as first param)
 */
export async function handleAgentRuntime(
  prompt: string,
  optionsOrCallback?:
    | HandleAgentRuntimeOptions
    | ((message: string) => Promise<void>),
  callback?: (message: string) => Promise<void>,
): Promise<void> {
  // Handle backward compatibility with old signature
  let options: HandleAgentRuntimeOptions = {};
  let replyCallback: (message: string) => Promise<void>;

  if (typeof optionsOrCallback === "function") {
    // Old signature: handleAgentRuntime(prompt, replyCallback)
    replyCallback = optionsOrCallback;
  } else {
    // New signature: handleAgentRuntime(prompt, options, callback)
    options = optionsOrCallback || {};
    if (!callback) {
      throw new Error("callback is required when options is provided");
    }
    replyCallback = callback;
  }

  // Use shared implementation
  return sharedHandleAgentRuntime(prompt, options, replyCallback, "telegram");
}

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{ type: string; offset: number; length: number }>;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const LOGIN_LINK_PATH = "/telegram/login";

export function isCommandEntity(message: TelegramMessage) {
  if (message.text?.trim().startsWith("/")) {
    return true;
  }
  return message.entities?.some((entity) => entity.type === "bot_command");
}

export function extractCommand(
  message: TelegramMessage,
): { command: string; args: string } | null {
  if (!message.text) {
    return null;
  }

  const text = message.text.trim();
  if (!text.startsWith("/")) {
    return null;
  }

  const [first, ...rest] = text.split(/\s+/);
  const command = first.split("@")[0].toLowerCase();
  const args = rest.join(" ").trim();

  return { command, args };
}

function tokenizeArguments(input: string): string[] {
  const tokens: string[] = [];
  const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match: RegExpExecArray | null = regex.exec(input);

  while (match !== null) {
    const [, doubleQuoted, singleQuoted, bare] = match;
    tokens.push(doubleQuoted ?? singleQuoted ?? bare ?? "");
    match = regex.exec(input);
  }

  return tokens;
}

export async function handleStartCommand(chatId: string | number) {
  await sendTelegramMessage(
    chatId,
    [
      "Welcome to Alloomi AI Bot! 🌟",
      "",
      "You can quickly get cross-platform message summaries via this bot and let Alloomi handle your communications directly.",
      "",
      "Available Commands:",
      "• /login — Link your Alloomi account",
      "• /insight — Get the latest insight",
      "• /ask <question> — Ask Alloomi a question",
      "• /reply <platform> <contact> <content> — Reply directly to external messages",
      "",
      "Start by sending /login to complete the linking process!",
    ].join("\n"),
  );
}

export async function handleLoginCommand(
  message: TelegramMessage,
  getAppUrl: () => string,
) {
  if (!message.from) {
    return;
  }

  const chatNumericId = message.chat.id;
  const chatId = chatNumericId.toString();
  const { token } = await createTelegramLoginToken({
    telegramUserId: message.from.id.toString(),
    telegramChatId: chatId,
    username: message.from.username,
    firstName: message.from.first_name,
    lastName: message.from.last_name,
    languageCode: message.from.language_code,
    isBot: message.from.is_bot,
  });

  const appUrl = getAppUrl();
  const loginUrl = `${appUrl}${LOGIN_LINK_PATH}?token=${token}`;

  await sendTelegramMessage(
    chatNumericId,
    [
      "Please open the following link in your browser and log in to Alloomi to complete the binding:",
      loginUrl,
      "",
      "This link is valid for 10 minutes. If it expires, please send /login again to get a new link.",
    ].join("\n"),
  );
}

export async function handleAskCommand(
  telegramUserId: string,
  chatId: string | number,
  question: string,
) {
  const account = await getTelegramAccountByTelegramUserId(telegramUserId);
  if (!account?.userId) {
    await sendTelegramMessage(
      chatId,
      "Account binding not completed. Please send /login first and complete authorization in your browser.",
    );
    return;
  }

  if (!question) {
    await sendTelegramMessage(chatId, "Please enter your question after /ask.");
    return;
  }

  await sendTelegramTypingAction(chatId);

  const userType = await getUserTypeForService(account.userId);

  try {
    // Get user info for AI context
    const user = await getUserById(account.userId);

    // Set AI user context for proper billing in proxy mode
    setAIUserContext({
      id: account.userId,
      email: user?.email || "",
      name: user?.name || null,
      type: userType,
    });

    const prompt = [
      "You are the Alloomi assistant. You need to help users based on the following cross-platform message summaries.",
      "When information is insufficient, state this directly instead of making up content.",
      "",
      "=== User's question ===",
      question,
      "",
      "Please answer concisely in English.",
    ].join("\n");

    const result = await generateText({
      model,
      prompt,
    });

    const answer = result.text.trim();
    await sendTelegramMessage(
      chatId,
      answer ||
        "I cannot provide an answer based on the available information at the moment.",
    );
  } catch (error) {
    console.error("[Telegram] /ask command failed:", error);
    await sendTelegramMessage(
      chatId,
      "An error occurred while processing your question. Please try again later.",
    );
    return;
  }

  await updateTelegramAccountLastCommand({
    telegramUserId,
    lastCommandAt: new Date(),
  });
}

export async function handleReplyCommand(
  telegramUserId: string,
  chatId: string | number,
  args: string,
) {
  const account = await getTelegramAccountByTelegramUserId(telegramUserId);
  if (!account?.userId) {
    await sendTelegramMessage(
      chatId,
      "Account binding not completed. Please send /login first and complete authorization in your browser.",
    );
    return;
  }

  const [platform, recipient, ...messageParts] = tokenizeArguments(args);
  const message = messageParts.join(" ").trim();

  if (!platform || !recipient || !message) {
    await sendTelegramMessage(
      chatId,
      [
        "Please use the following format to send the command:",
        "/reply <platform> <contact or group> <message content>",
        "",
        'Example: /reply slack "#design-team" Hello everyone, the requirements have been updated!',
        "If the contact contains spaces, enclose it in quotes.",
      ].join("\n"),
    );
    return;
  }

  const normalizedPlatform = platform.toLowerCase();

  await sendTelegramTypingAction(chatId);

  const bots = await getBotsByUserId({
    id: account.userId,
    limit: null,
    startingAfter: null,
    endingBefore: null,
    onlyEnable: true,
  });

  const targetBot = bots.bots.find((botItem) => {
    return botItem.adapter === normalizedPlatform;
  });

  if (!targetBot) {
    await sendTelegramMessage(
      chatId,
      `Your account has not connected to a ${normalizedPlatform} bot yet. Please complete authorization on the Alloomi web interface first.`,
    );
    return;
  }

  try {
    await sendReplyByBotId({
      id: targetBot.id,
      userId: account.userId,
      recipients: [recipient],
      message,
      withAppSuffix: false,
    });

    await sendTelegramMessage(
      chatId,
      `Message sent to ${recipient} on ${normalizedPlatform}.`,
    );
  } catch (error) {
    console.error("[Telegram] Failed to send reply:", error);
    await sendTelegramMessage(
      chatId,
      "An error occurred while sending the message. Please check if the contact name is correct or try again later.",
    );
    return;
  }

  await updateTelegramAccountLastCommand({
    telegramUserId,
    lastCommandAt: new Date(),
  });
}

export async function handleStatusCommand(
  telegramUserId: string,
  chatId: string | number,
) {
  const account = await getTelegramAccountByTelegramUserId(telegramUserId);
  if (!account?.userId) {
    await sendTelegramMessage(
      chatId,
      "Account binding not completed. Please send /login first and complete authorization in your browser.",
    );
    return;
  }

  const bots = await getBotsByUserId({
    id: account.userId,
    limit: null,
    startingAfter: null,
    endingBefore: null,
    onlyEnable: true,
  });

  const adapterLabels: Record<string, string> = {
    telegram: "Telegram",
    slack: "Slack",
    gmail: "Gmail",
    whatsapp: "WhatsApp",
    discord: "Discord",
  };

  const orderedAdapters = Object.keys(adapterLabels);
  const connectedMap = new Map<string, Array<string>>();
  for (const bot of bots.bots) {
    const label = adapterLabels[bot.adapter] ?? bot.adapter;
    const list = connectedMap.get(label) ?? [];
    list.push(bot.name);
    connectedMap.set(label, list);
  }

  const connectedLines: string[] = [];
  const disconnectedLines: string[] = [];

  for (const adapter of orderedAdapters) {
    const label = adapterLabels[adapter];
    const names = connectedMap.get(label);
    if (names && names.length > 0) {
      const displayNames = names.join(", ");
      connectedLines.push(`• ${label} — Connected (${displayNames})`);
    } else {
      disconnectedLines.push(`• ${label} — Not connected`);
    }
  }

  if (connectedLines.length === 0 && disconnectedLines.length === 0) {
    await sendTelegramMessage(
      chatId,
      "No connected platforms detected. Please go to the Integrations panel on the Alloomi web interface to complete authorization.",
    );
    return;
  }

  const sections: string[] = [];
  if (connectedLines.length > 0) {
    sections.push(
      ["✅ Currently connected platforms:", ...connectedLines].join("\n"),
    );
  }
  if (disconnectedLines.length > 0) {
    sections.push(
      [
        "➡️ Platforms still available for connection:",
        ...disconnectedLines,
        "Please go to the Integrations panel on the Alloomi web interface to complete authorization.",
      ].join("\n"),
    );
  }

  await sendTelegramMessage(chatId, sections.join("\n\n"), {
    disable_web_page_preview: true,
  });

  await updateTelegramAccountLastCommand({
    telegramUserId,
    lastCommandAt: new Date(),
  });
}

export async function processMessage(
  message: TelegramMessage,
  getAppUrl: () => string,
): Promise<void> {
  const from = message.from;
  if (!from || !message.text) {
    return;
  }

  const chatNumericId = message.chat.id;
  const telegramUserId = from.id.toString();
  const messageText = message.text.trim();

  // Check if it's a command (starts with /)
  if (isCommandEntity(message)) {
    const commandInfo = extractCommand(message);
    if (!commandInfo) {
      return;
    }

    console.log(`[Telegram] Received command: ${commandInfo.command}`);

    switch (commandInfo.command) {
      case "/start":
      case "/help":
        await handleStartCommand(chatNumericId);
        break;
      case "/login":
        await handleLoginCommand(message, getAppUrl);
        break;
      case "/ask":
        await handleAskCommand(telegramUserId, chatNumericId, commandInfo.args);
        break;
      case "/reply":
        await handleReplyCommand(
          telegramUserId,
          chatNumericId,
          commandInfo.args,
        );
        break;
      case "/status":
        await handleStatusCommand(telegramUserId, chatNumericId);
        break;
      default:
        await sendTelegramMessage(
          chatNumericId,
          "This command is not supported yet. Send /help to view available commands.",
        );
    }
  } else {
    // Not a command, treat it as a question to Alloomi AI
    if (messageText.length > 0) {
      console.log(
        `[Telegram] Received question: ${messageText.substring(0, 50)}...`,
      );
      await handleAskCommand(telegramUserId, chatNumericId, messageText);
    }
  }
}
