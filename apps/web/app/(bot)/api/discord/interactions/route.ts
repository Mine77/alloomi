import { verify as verifySignature } from "node:crypto";

import {
  getDiscordAccountByDiscordUserId,
  updateDiscordAccountLastCommand,
  getBotsByUserId,
} from "@/lib/db/queries";
import { createDiscordLoginToken } from "@/lib/discord/login-token";
import { generateText } from "ai";
import { model } from "@/lib/ai";
import { sendReplyByBotId } from "@/lib/bots/send-reply";

export const runtime = "nodejs";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MAX_DISCORD_MESSAGE_LENGTH = 2000;

type DiscordUser = {
  id: string;
  username?: string;
  global_name?: string;
};

type DiscordInteractionOption = {
  name: string;
  type: number;
  value?: string;
};

type DiscordInteraction = {
  id: string;
  application_id: string;
  type: number;
  token: string;
  data?: {
    name?: string;
    options?: DiscordInteractionOption[];
  };
  member?: {
    user?: DiscordUser;
  };
  user?: DiscordUser;
  channel_id?: string;
  guild_id?: string;
};

function buildEd25519PublicKey(publicKeyHex: string) {
  // DER prefix for Ed25519 public key
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  const keyBytes = Buffer.from(publicKeyHex, "hex");
  return Buffer.concat([prefix, keyBytes]);
}

function verifyDiscordRequest(
  signature: string,
  timestamp: string,
  rawBody: string,
  publicKeyHex: string,
): boolean {
  try {
    const publicKeyDer = buildEd25519PublicKey(publicKeyHex);
    const keyObject = {
      key: publicKeyDer,
      format: "der" as const,
      type: "spki" as const,
    };
    const message = Buffer.concat([
      Buffer.from(timestamp, "utf8"),
      Buffer.from(rawBody, "utf8"),
    ]);
    const signatureBuf = Buffer.from(signature, "hex");
    return verifySignature(null, message, keyObject, signatureBuf);
  } catch (error) {
    console.error("[Discord] Signature verification failed:", error);
    return false;
  }
}

async function sendFollowupMessage(
  interaction: DiscordInteraction,
  content: string,
) {
  const { application_id: applicationId, token } = interaction;
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${token}`;
  const payload = {
    content,
    flags: 64, // ephemeral
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN ?? ""}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("[Discord] Failed to send followup message:", error);
  }
}

async function sendChunkedFollowup(
  interaction: DiscordInteraction,
  content: string,
) {
  const chunks: string[] = [];
  let remaining = content;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, MAX_DISCORD_MESSAGE_LENGTH));
    remaining = remaining.slice(MAX_DISCORD_MESSAGE_LENGTH);
  }
  for (const chunk of chunks) {
    await sendFollowupMessage(interaction, chunk);
  }
}

function extractUser(interaction: DiscordInteraction): DiscordUser | null {
  return interaction.member?.user ?? interaction.user ?? null;
}

function formatHelpMessage(): string {
  return [
    "Welcome to Alloomi Discord Bot! 🌟",
    "",
    "Commands:",
    "• /login — Link your Alloomi account",
    "• /insight — Get the latest insight",
    "• /ask <question> — Ask Alloomi a question",
    "• /reply <platform> <contact> <content> — Reply directly to external messages",
    "• /status — View connected platforms",
    "",
    "Start by sending /login to complete the linking process.",
  ].join("\n");
}

async function handleLoginCommand(
  interaction: DiscordInteraction,
  user: DiscordUser,
) {
  const { token } = await createDiscordLoginToken({
    discordUserId: user.id,
    discordGuildId: interaction.guild_id ?? null,
    discordChannelId: interaction.channel_id ?? null,
    username: user.username,
    globalName: user.global_name,
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.alloomi.ai";
  const loginUrl = `${appUrl}/discord/login?token=${token}`;

  await sendChunkedFollowup(
    interaction,
    [
      "Please open the following link in your browser and log in to Alloomi to complete the binding:",
      loginUrl,
      "",
      "This link is valid for 10 minutes. If it expires, please send /login again to get a new link.",
    ].join("\n"),
  );
}

async function handleAskCommand(
  interaction: DiscordInteraction,
  user: DiscordUser,
  question: string,
) {
  const account = await getDiscordAccountByDiscordUserId(user.id);
  if (!account?.userId) {
    await sendFollowupMessage(
      interaction,
      "Account binding not completed. Please send /login first and complete authorization in your browser.",
    );
    return;
  }

  if (!question) {
    await sendFollowupMessage(
      interaction,
      "Please enter your question after /ask.",
    );
    return;
  }

  try {
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
    await sendChunkedFollowup(
      interaction,
      answer ||
        "I cannot provide an answer based on the available information at the moment.",
    );
  } catch (error) {
    console.error("[Discord] /ask command failed:", error);
    await sendFollowupMessage(
      interaction,
      "An error occurred while processing your question. Please try again later.",
    );
    return;
  }

  await updateDiscordAccountLastCommand({
    discordUserId: user.id,
    lastCommandAt: new Date(),
  });
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

function optionsToArgs(
  options: DiscordInteractionOption[] | undefined,
): string {
  if (!options || options.length === 0) return "";
  const values = options
    .map((opt) => opt.value)
    .filter((v): v is string => typeof v === "string");
  return values.join(" ");
}

async function handleReplyCommand(
  interaction: DiscordInteraction,
  user: DiscordUser,
  args: string,
) {
  const account = await getDiscordAccountByDiscordUserId(user.id);
  if (!account?.userId) {
    await sendFollowupMessage(
      interaction,
      "Account binding not completed. Please send /login first and complete authorization in your browser.",
    );
    return;
  }

  const [platform, recipient, ...messageParts] = tokenizeArguments(args);
  const message = messageParts.join(" ").trim();

  if (!platform || !recipient || !message) {
    await sendFollowupMessage(
      interaction,
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
    await sendFollowupMessage(
      interaction,
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

    await sendFollowupMessage(
      interaction,
      `Message sent to ${recipient} on ${normalizedPlatform}.`,
    );
  } catch (error) {
    console.error("[Discord] Failed to send reply:", error);
    await sendFollowupMessage(
      interaction,
      "An error occurred while sending the message. Please check if the contact name is correct or try again later.",
    );
    return;
  }

  await updateDiscordAccountLastCommand({
    discordUserId: user.id,
    lastCommandAt: new Date(),
  });
}

async function handleStatusCommand(
  interaction: DiscordInteraction,
  user: DiscordUser,
) {
  const account = await getDiscordAccountByDiscordUserId(user.id);
  if (!account?.userId) {
    await sendFollowupMessage(
      interaction,
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
    await sendFollowupMessage(
      interaction,
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

  await sendFollowupMessage(interaction, sections.join("\n\n"));

  await updateDiscordAccountLastCommand({
    discordUserId: user.id,
    lastCommandAt: new Date(),
  });
}

async function handleInteraction(interaction: DiscordInteraction) {
  const user = extractUser(interaction);
  if (!user?.id) {
    await sendFollowupMessage(
      interaction,
      "Unable to identify Discord user from this interaction.",
    );
    return;
  }

  const commandName = interaction.data?.name?.toLowerCase();
  const args = optionsToArgs(interaction.data?.options);

  switch (commandName) {
    case "start":
    case "help":
      await sendFollowupMessage(interaction, formatHelpMessage());
      break;
    case "login":
      await handleLoginCommand(interaction, user);
      break;
    case "ask":
      await handleAskCommand(interaction, user, args);
      break;
    case "reply":
      await handleReplyCommand(interaction, user, args);
      break;
    case "status":
      await handleStatusCommand(interaction, user);
      break;
    default:
      await sendFollowupMessage(
        interaction,
        "This command is not supported yet. Send /help to view available commands.",
      );
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!signature || !timestamp || !publicKey) {
    return new Response("Bad request", { status: 400 });
  }

  const rawBody = await request.text();

  const isValid = verifyDiscordRequest(
    signature,
    timestamp,
    rawBody,
    publicKey,
  );
  if (!isValid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch (error) {
    console.error("[Discord] Invalid interaction payload:", error);
    return new Response("Invalid JSON", { status: 400 });
  }

  // Type 1 = PING
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  // Ack quickly then process in background
  void handleInteraction(interaction).catch((error) => {
    console.error("[Discord] Interaction processing failed:", error);
    // best-effort error message
    void sendFollowupMessage(
      interaction,
      "An unexpected error occurred. Please try again later.",
    );
  });

  return Response.json({
    type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      flags: 64, // ephemeral
    },
  });
}
