import { auth } from "@/app/(auth)/auth";
import { linkDiscordAccount } from "@/lib/db/queries";
import { AppError } from "@alloomi/shared/errors";
import {
  deleteDiscordLoginToken,
  getDiscordLoginToken,
} from "@/lib/discord/login-token";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new AppError("unauthorized:discord").toResponse();
  }

  let token: string | undefined;
  try {
    const body = (await request.json()) as { token?: string };
    token = body.token?.trim();
  } catch (error) {
    console.error("[Discord] Failed to parse link payload:", error);
    return new AppError(
      "bad_request:discord",
      "Invalid JSON body",
    ).toResponse();
  }

  if (!token) {
    return new AppError("bad_request:discord", "Missing token").toResponse();
  }
  AppError;
  const payload = await getDiscordLoginToken(token);
  if (!payload) {
    return new AppError(
      "bad_request:discord",
      "The login token is invalid or has expired. Please run /login in Discord again.",
    ).toResponse();
  }

  try {
    await linkDiscordAccount({
      userId: session.user.id,
      account: {
        discordUserId: payload.discordUserId,
        discordGuildId: payload.discordGuildId,
        discordChannelId: payload.discordChannelId,
        username: payload.username,
        globalName: payload.globalName,
      },
    });

    await deleteDiscordLoginToken(token);

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("[Discord] Failed to link account:", error);
    return new AppError(
      "bad_request:discord",
      "Failed to link Discord account. Please try again later.",
    ).toResponse();
  }
}
