import { randomUUID } from "node:crypto";
import redis from "@/lib/session/context";

const TELEGRAM_LOGIN_TOKEN_PREFIX = "telegram_login_token:";
export const TELEGRAM_LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface TelegramLoginTokenPayload {
  telegramUserId: string;
  telegramChatId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
  isBot?: boolean;
}

export async function createTelegramLoginToken(
  payload: TelegramLoginTokenPayload,
): Promise<{ token: string; expiresAt: number }> {
  if (!redis) {
    throw new Error("Redis is not available");
  }
  const token = randomUUID();
  const key = `${TELEGRAM_LOGIN_TOKEN_PREFIX}${token}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + TELEGRAM_LOGIN_TOKEN_TTL_MS;

  await redis.set(
    key,
    JSON.stringify({
      ...payload,
      createdAt,
    }),
    "PX",
    TELEGRAM_LOGIN_TOKEN_TTL_MS,
  );

  return { token, expiresAt };
}

export async function getTelegramLoginToken(
  token: string,
): Promise<TelegramLoginTokenPayload | null> {
  if (!token || !redis) {
    return null;
  }

  const key = `${TELEGRAM_LOGIN_TOKEN_PREFIX}${token}`;
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TelegramLoginTokenPayload & {
      createdAt?: number;
    };
    if (!parsed.telegramUserId || !parsed.telegramChatId) {
      return null;
    }

    return {
      telegramUserId: parsed.telegramUserId,
      telegramChatId: parsed.telegramChatId,
      username: parsed.username ?? null,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      languageCode: parsed.languageCode ?? null,
      isBot: parsed.isBot,
    };
  } catch (error) {
    console.error("[Telegram] Failed to parse login token payload:", error);
    return null;
  }
}

export async function deleteTelegramLoginToken(token: string): Promise<void> {
  if (!token || !redis) return;
  const key = `${TELEGRAM_LOGIN_TOKEN_PREFIX}${token}`;
  await redis.del(key);
}
