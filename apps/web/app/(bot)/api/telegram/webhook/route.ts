import { AppError } from "@alloomi/shared/errors";
import { processMessage, type TelegramUpdate } from "@/lib/telegram/handlers";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

async function ensureSecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (!expected) {
    return;
  }
  const received = request.headers.get(TELEGRAM_SECRET_HEADER);
  if (received !== expected) {
    throw new AppError("unauthorized:telegram", "Invalid webhook secret");
  }
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://alloomi.ai"
  );
}

export async function POST(request: Request) {
  try {
    await ensureSecret(request);
  } catch (error) {
    if (error instanceof AppError) {
      return error.toResponse();
    }
    return new AppError("unauthorized:telegram").toResponse();
  }

  let update: TelegramUpdate | null = null;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch (error) {
    console.error("[Telegram] Invalid webhook payload:", error);
    return new AppError("bad_request:telegram", "Invalid payload").toResponse();
  }

  const message = update?.message;
  if (!message || !message.text) {
    return Response.json({ ok: true });
  }

  // Use shared message handler
  try {
    await processMessage(message, getAppUrl);
  } catch (error) {
    console.error("[Telegram] Failed to process message:", error);
    // Even if processing fails, return 200 to avoid Telegram retry
  }

  return Response.json({ ok: true });
}
