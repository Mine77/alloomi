import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

const DISCORD_API_BASE = "https://discord.com/api";
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

type GuildRequestPayload = {
  accessToken?: string;
  tokenType?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request
    .json()
    .catch(() => ({}))) as GuildRequestPayload;

  const accessToken = payload.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Discord access token" },
      { status: 400 },
    );
  }

  const tokenType = payload.tokenType ?? "Bearer";

  try {
    const result = await fetchGuildsWithRetry({ accessToken, tokenType });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Failed to fetch Discord guilds",
          details: result.details,
        },
        { status: result.status },
      );
    }

    const manageableGuilds = result.guilds;

    return NextResponse.json(
      {
        guilds: manageableGuilds.map((guild) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          owner: guild.owner,
          permissions: guild.permissions,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch Discord guilds",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function fetchGuildsWithRetry({
  accessToken,
  tokenType,
}: {
  accessToken: string;
  tokenType: string;
}) {
  const maxAttempts = 2;
  let attempt = 0;
  let lastDetails: unknown = null;

  while (attempt < maxAttempts) {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: {
        Authorization: `${tokenType} ${accessToken}`,
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 429) {
      lastDetails = body;
      const retryAfterMs = computeRetryAfter(response, body);
      if (retryAfterMs === null) {
        return {
          ok: false,
          status: 429,
          error: "Discord rate limited the request",
          details: body,
        } as const;
      }
      await wait(retryAfterMs);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body?.error ?? body?.message ?? "Failed to fetch Discord guilds",
        details: body,
      } as const;
    }

    return {
      ok: true,
      status: 200,
      guilds: body as DiscordGuild[],
      details: body,
    } as const;
  }

  return {
    ok: false,
    status: 429,
    error: "Discord rate limited the request",
    details: lastDetails,
  } as const;
}

function computeRetryAfter(response: Response, body: unknown): number | null {
  const headerValue = response.headers.get("retry-after");
  if (headerValue) {
    const parsed = Number.parseFloat(headerValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return Math.min(parsed * 1000, 5000);
    }
  }

  if (
    body &&
    typeof body === "object" &&
    "retry_after" in body &&
    typeof (body as { retry_after: unknown }).retry_after === "number"
  ) {
    const retryAfter = (body as { retry_after: number }).retry_after;
    if (!Number.isNaN(retryAfter) && retryAfter >= 0) {
      return Math.min(retryAfter * 1000, 5000);
    }
  }

  return 1000;
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
