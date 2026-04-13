import { startGmailSelfMessageListener } from "./self-message-listener";
import { getIntegrationAccountsByUserId } from "@/lib/db/queries";

/**
 * Initialize Gmail Self Message Listener
 * This is a standalone initialization function that needs to be called after user login
 */
export async function initGmailSelfMessageListener(
  userId: string,
  authToken?: string, // Cloud auth token for API configuration
): Promise<void> {
  try {
    console.log(
      `[Gmail Init] Initializing Self Message Listener for user ${userId}...`,
    );

    // Check if user has imported Gmail accounts
    const allAccounts = await getIntegrationAccountsByUserId({
      userId,
    });

    const accounts = allAccounts.filter((acc) => acc.platform === "gmail");

    if (!accounts || accounts.length === 0) {
      console.log(
        `[Gmail Init] No Gmail accounts found for user ${userId}, skipping Self Message Listener`,
      );
      return;
    }

    console.log(
      `[Gmail Init] Found ${accounts.length} Gmail account(s), starting Self Message Listener...`,
    );

    // Start Self Message Listener
    await startGmailSelfMessageListener(userId, authToken);

    console.log(
      `[Gmail Init] Self Message Listener started successfully for user ${userId}`,
    );
  } catch (error) {
    console.error(
      `[Gmail Init] Failed to start Self Message Listener for user ${userId}:`,
      error,
    );
  }
}

/**
 * Stop Gmail Self Message Listener
 */
export async function stopGmailSelfMessageListener(
  userId: string,
): Promise<void> {
  const { stopGmailSelfMessageListener: stopListener } =
    await import("./self-message-listener");
  await stopListener(userId);
}
