import { startTelegramUserListener } from "./user-listener";
import { getIntegrationAccountsByUserId } from "@/lib/db/queries";

let isInitialized = false;

/**
 * Initialize Telegram Bot
 * Note: Polling mode has been removed, only Webhook mode is supported
 * In Webhook mode, Telegram actively pushes updates, no polling needed
 */
export async function initTelegramBot(): Promise<void> {
  if (isInitialized) {
    console.log("[Telegram Init] Already initialized");
    return;
  }

  const token = process.env.TG_BOT_TOKEN;

  // If token is not configured, skip initialization
  if (!token) {
    console.log("[Telegram Init] TG_BOT_TOKEN not configured, skipping");
    isInitialized = true;
    return;
  }

  // Only support Webhook mode (Telegram will actively push updates)
  console.log(
    "[Telegram Init] Webhook mode (Telegram will push updates actively)",
  );
  isInitialized = true;
}

/**
 * Initialize Telegram User Listener (listens to Saved Messages)
 * This is a separate initialization function that needs to be called after user login
 */
export async function initTelegramUserListener(userId: string): Promise<void> {
  try {
    console.log(
      `[Telegram Init] Initializing User Listener for user ${userId}...`,
    );

    // Check if user has imported Telegram accounts
    const allAccounts = await getIntegrationAccountsByUserId({
      userId,
    });

    const accounts = allAccounts.filter((acc) => acc.platform === "telegram");

    if (!accounts || accounts.length === 0) {
      console.log(
        `[Telegram Init] No Telegram accounts found for user ${userId}, skipping User Listener`,
      );
      return;
    }

    console.log(
      `[Telegram Init] Found ${accounts.length} Telegram account(s), starting User Listener...`,
    );

    // Start User Listener
    await startTelegramUserListener(userId);

    console.log(
      `[Telegram Init] User Listener started successfully for user ${userId}`,
    );
  } catch (error) {
    console.error(
      `[Telegram Init] Failed to start User Listener for user ${userId}:`,
      error,
    );
  }
}

/**
 * Get initialization status
 */
export function isTelegramBotInitialized(): boolean {
  return isInitialized;
}

/**
 * Manually trigger initialization (for development environment or testing)
 */
export async function ensureTelegramBotInitialized(): Promise<void> {
  if (!isInitialized) {
    await initTelegramBot();
  }
}
