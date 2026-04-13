import { randomUUID } from "node:crypto";
import redis from "@/lib/session/context";

const DISCORD_LOGIN_TOKEN_PREFIX = "discord_login_token:";
export const DISCORD_LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface DiscordLoginTokenPayload {
  discordUserId: string;
  discordGuildId?: string | null;
  discordChannelId?: string | null;
  username?: string | null;
  globalName?: string | null;
}

export async function createDiscordLoginToken(
  payload: DiscordLoginTokenPayload,
): Promise<{ token: string; expiresAt: number }> {
  if (!redis) {
    throw new Error("Redis is not available");
  }
  const token = randomUUID();
  const key = `${DISCORD_LOGIN_TOKEN_PREFIX}${token}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + DISCORD_LOGIN_TOKEN_TTL_MS;

  await redis.set(
    key,
    JSON.stringify({
      ...payload,
      createdAt,
    }),
    "PX",
    DISCORD_LOGIN_TOKEN_TTL_MS,
  );

  return { token, expiresAt };
}

export async function getDiscordLoginToken(
  token: string,
): Promise<DiscordLoginTokenPayload | null> {
  if (!token || !redis) {
    return null;
  }

  const key = `${DISCORD_LOGIN_TOKEN_PREFIX}${token}`;
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DiscordLoginTokenPayload & {
      createdAt?: number;
    };
    if (!parsed.discordUserId) {
      return null;
    }

    return {
      discordUserId: parsed.discordUserId,
      discordGuildId: parsed.discordGuildId ?? null,
      discordChannelId: parsed.discordChannelId ?? null,
      username: parsed.username ?? null,
      globalName: parsed.globalName ?? null,
    };
  } catch (error) {
    console.error("[Discord] Failed to parse login token payload:", error);
    return null;
  }
}

export async function deleteDiscordLoginToken(token: string): Promise<void> {
  if (!token || !redis) return;
  const key = `${DISCORD_LOGIN_TOKEN_PREFIX}${token}`;
  await redis.del(key);
}
