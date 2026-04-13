import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { sendMessage } from "@/lib/bots/message-service";
import type { SendMessageParams } from "@/lib/bots/message-service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      botId,
      recipients,
      message,
      messageHtml,
      cc,
      bcc,
      attachments,
      withAppSuffix,
    } = body;

    // Validate required parameters
    if (!botId) {
      return NextResponse.json(
        { error: "Bot ID is required" },
        { status: 400 },
      );
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 },
      );
    }

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    const params: SendMessageParams = {
      botId,
      recipients,
      message,
      messageHtml,
      cc,
      bcc,
      attachments,
    };

    // Only override default value when frontend explicitly passes withAppSuffix
    if (typeof withAppSuffix === "boolean") {
      params.withAppSuffix = withAppSuffix;
    }

    const result = await sendMessage(params, session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Failed to send message:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
