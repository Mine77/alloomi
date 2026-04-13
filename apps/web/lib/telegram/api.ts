const TELEGRAM_API_BASE = "https://api.telegram.org";

type TelegramSendMessageOptions = {
  parse_mode?: "MarkdownV2" | "HTML" | "Markdown";
  disable_web_page_preview?: boolean;
  reply_to_message_id?: number;
};

async function telegramApiCall<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) {
    throw new Error("TG_BOT_TOKEN is not configured");
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("[Telegram] API call failed before request", {
      method,
      payload,
      bot: token.slice(0, 10),
      error,
    });
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Telegram API ${method} failed with status ${response.status}: ${errorBody} | payload=${JSON.stringify(payload)} | bot=${token.slice(0, 10)}`,
    );
  }

  const data = (await response.json()) as { ok: boolean; result: T };
  if (!data.ok) {
    throw new Error(`Telegram API ${method} responded with ok=false`);
  }

  return data.result;
}

function coerceChatId(chatId: string | number): string | number {
  if (typeof chatId === "number") {
    return chatId;
  }

  if (/^-?\d+$/.test(chatId)) {
    // Avoid losing precision on very large identifiers by keeping them as strings.
    if (chatId.length <= 15) {
      const asNumber = Number(chatId);
      if (!Number.isNaN(asNumber)) {
        return asNumber;
      }
    }
  }

  return chatId;
}

export async function sendTelegramTypingAction(chatId: string | number) {
  try {
    await telegramApiCall("sendChatAction", {
      chat_id: coerceChatId(chatId),
      action: "typing",
    });
  } catch (error) {
    console.error("[Telegram] Failed to send typing action:", error);
  }
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: TelegramSendMessageOptions = {},
) {
  return telegramApiCall("sendMessage", {
    chat_id: coerceChatId(chatId),
    text,
    ...options,
  });
}
