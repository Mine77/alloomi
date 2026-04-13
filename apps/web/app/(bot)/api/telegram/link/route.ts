import { auth } from "@/app/(auth)/auth";
import { linkTelegramAccount } from "@/lib/db/queries";
import { AppError } from "@alloomi/shared/errors";
import {
  deleteTelegramLoginToken,
  getTelegramLoginToken,
} from "@/lib/telegram/login-token";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new AppError("unauthorized:telegram").toResponse();
  }

  let token: string | undefined;
  try {
    const body = (await request.json()) as { token?: string };
    token = body.token?.trim();
  } catch (error) {
    console.error("[Telegram] Failed to parse link payload:", error);
    return new AppError(
      "bad_request:telegram",
      "Invalid JSON body",
    ).toResponse();
  }

  if (!token) {
    return new AppError("bad_request:telegram", "Missing token").toResponse();
  }
  AppError;
  const payload = await getTelegramLoginToken(token);
  if (!payload) {
    return new AppError(
      "bad_request:telegram",
      "The login token is invalid or has expired. Please run /login in Telegram again.",
    ).toResponse();
  }

  try {
    await linkTelegramAccount({
      userId: session.user.id,
      account: {
        telegramUserId: payload.telegramUserId,
        telegramChatId: payload.telegramChatId,
        username: payload.username,
        firstName: payload.firstName,
        lastName: payload.lastName,
        languageCode: payload.languageCode,
        isBot: payload.isBot ?? false,
      },
    });

    await deleteTelegramLoginToken(token);

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("[Telegram] Failed to link account:", error);
    return new AppError(
      "bad_request:telegram",
      "Failed to link Telegram account. Please try again later.",
    ).toResponse();
  }
}
