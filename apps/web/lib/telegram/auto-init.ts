import { initTelegramBot } from "./init";

let autoInitPromise: Promise<void> | null = null;

/**
 * Ensure Telegram Bot is initialized (lazy load)
 * Initialization is executed on first call, subsequent calls return directly
 */
export async function ensureTelegramBotInitialized(): Promise<void> {
  if (!autoInitPromise) {
    autoInitPromise = initTelegramBot();
  }
  return autoInitPromise;
}

/**
 * Reset initialization state (mainly for testing)
 */
export function resetTelegramBotInit(): void {
  autoInitPromise = null;
}
