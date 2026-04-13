/**
 * Gmail Self Message Listener
 *
 * Listens for emails users send to themselves
 * When user sends an email to their own address, it triggers Agent Runtime
 *
 * Uses IMAP polling via EmailAdapter to detect new self-sent emails
 */

import {
  getIntegrationAccountsByUserId,
  loadIntegrationCredentials,
} from "@/lib/db/queries";
import { EmailAdapter } from "@/lib/integration/sources/email";
import { handleAgentRuntime } from "@/lib/ai/runtime/shared";
import { gmailConversationStore } from "./conversation-store";
import { DEFAULT_AI_MODEL, AI_PROXY_BASE_URL } from "@/lib/env/constants";

// AI reply signature
const AI_SUFFIX = "\n\n---\nSent by Alloomi AI";

// Polling interval in milliseconds
const POLL_INTERVAL_MS = 10000; // 10 seconds

// Maximum time to wait for initial sync
const INITIAL_SYNC_WAIT_MS = 5000;

interface SelfMessageListenerConfig {
  userId: string;
  authToken?: string;
}

interface EmailAccount {
  adapter: EmailAdapter;
  email: string;
}

class GmailSelfMessageListener {
  private userId: string;
  private authToken?: string;
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private adapters: Map<string, EmailAccount> = new Map();
  private processedUids: Map<string, Set<number>> = new Map();
  private lastCheckTimes: Map<string, number> = new Map();

  constructor(config: SelfMessageListenerConfig) {
    this.userId = config.userId;
    this.authToken = config.authToken;
  }

  /**
   * Start listening to all Gmail accounts for this user
   */
  async start(): Promise<void> {
    console.log(`[GmailSelfListener] Starting for user ${this.userId}`);

    // Get all integration accounts and filter for Gmail
    const allAccounts = await getIntegrationAccountsByUserId({
      userId: this.userId,
    });

    const accounts = allAccounts.filter((acc) => acc.platform === "gmail");

    if (!accounts || accounts.length === 0) {
      console.log(
        `[GmailSelfListener] No Gmail accounts found for user ${this.userId}`,
      );
      return;
    }

    console.log(
      `[GmailSelfListener] Found ${accounts.length} Gmail account(s)`,
    );

    // Initialize adapters for each Gmail account
    for (const account of accounts) {
      try {
        const encryptedCredentials = loadIntegrationCredentials<{
          email?: string;
          appPassword?: string;
        }>(account);

        if (
          !encryptedCredentials?.email ||
          !encryptedCredentials?.appPassword
        ) {
          console.log(
            `[GmailSelfListener] No credentials for account ${account.id}, skipping`,
          );
          continue;
        }

        const adapter = new EmailAdapter({
          botId: account.id,
          emailAddress: encryptedCredentials.email,
          appPassword: encryptedCredentials.appPassword,
          ownerUserId: this.userId,
        });

        // Get user's email address
        const email = await adapter.getUserEmailAddress();

        this.adapters.set(account.id, { adapter, email });
        this.processedUids.set(account.id, new Set());
        this.lastCheckTimes.set(account.id, Date.now());

        console.log(
          `[GmailSelfListener] Initialized adapter for account ${account.id} (${email})`,
        );
      } catch (error) {
        console.error(
          `[GmailSelfListener] Failed to initialize adapter for account ${account.id}:`,
          error,
        );
      }
    }

    if (this.adapters.size === 0) {
      console.log(
        `[GmailSelfListener] No valid adapters initialized for user ${this.userId}`,
      );
      return;
    }

    this.running = true;

    // Wait for initial sync
    console.log(
      `[GmailSelfListener] Waiting ${INITIAL_SYNC_WAIT_MS}ms for initial sync...`,
    );
    await new Promise((resolve) => setTimeout(resolve, INITIAL_SYNC_WAIT_MS));

    // Start polling
    this.pollInterval = setInterval(() => {
      this.checkForNewEmails();
    }, POLL_INTERVAL_MS);

    // Run immediately
    this.checkForNewEmails();

    console.log(`[GmailSelfListener] Started polling for user ${this.userId}`);
  }

  /**
   * Check for new self-sent emails
   */
  private async checkForNewEmails(): Promise<void> {
    if (!this.running) return;

    for (const [accountId, { adapter, email }] of this.adapters) {
      try {
        const lastCheck = this.lastCheckTimes.get(accountId) || Date.now();
        const cutoffDate = new Date(lastCheck - 60000); // 1 minute buffer

        // Get emails since last check
        const emails = await adapter.getEmailsByTime(cutoffDate);

        const processedUids = this.processedUids.get(accountId);
        if (!processedUids) continue;

        for (const emailInfo of emails) {
          const uid = Number.parseInt(emailInfo.uid, 10);

          // Skip already processed messages
          if (processedUids.has(uid)) {
            continue;
          }

          // Check if this is a self-sent email (from === to)
          const fromEmail = emailInfo.from.email.toLowerCase();
          const toEmail = email.toLowerCase();

          if (fromEmail !== toEmail) {
            // Not a self-sent email, skip
            processedUids.add(uid);
            continue;
          }

          // Mark as processed
          processedUids.add(uid);

          // Process the self-sent email
          await this.processSelfEmail(accountId, emailInfo, email);
        }

        // Update last check time
        this.lastCheckTimes.set(accountId, Date.now());
      } catch (error) {
        console.error(
          `[GmailSelfListener] Error checking emails for account ${accountId}:`,
          error,
        );
      }
    }
  }

  /**
   * Process a self-sent email
   */
  private async processSelfEmail(
    accountId: string,
    emailInfo: {
      subject: string;
      text: string;
      from: { email: string };
    },
    userEmail: string,
  ): Promise<void> {
    console.log(
      `[GmailSelfListener] Processing self-email: ${emailInfo.subject}`,
    );

    const messageText = emailInfo.text;

    // Skip empty messages
    if (!messageText?.trim()) {
      console.log("[GmailSelfListener] Empty message, skipping");
      return;
    }

    // Skip auto-reply emails (check subject)
    const lowerSubject = emailInfo.subject.toLowerCase();
    if (
      lowerSubject.includes("auto-reply") ||
      lowerSubject.includes("out of office") ||
      lowerSubject.includes("out-of-office") ||
      lowerSubject.includes("away") ||
      lowerSubject.includes("vacation")
    ) {
      console.log("[GmailSelfListener] Auto-reply email, skipping");
      return;
    }

    // Get conversation history
    const conversationHistory = gmailConversationStore.getConversationHistory(
      this.userId,
      accountId,
    );

    const account = this.adapters.get(accountId);
    if (!account) {
      console.log("[GmailSelfListener] No adapter found, skipping");
      return;
    }

    // Call Agent Runtime
    await handleAgentRuntime(
      messageText,
      {
        conversation: conversationHistory,
        userId: this.userId,
        accountId, // Account ID for per-day file persistence
        ...(this.authToken && {
          modelConfig: {
            apiKey: this.authToken,
            baseUrl: AI_PROXY_BASE_URL,
            model: DEFAULT_AI_MODEL,
          },
        }),
      },
      async (reply) => {
        try {
          // Send reply back to user via email
          const replySubject = `Re: ${emailInfo.subject}`;

          await account.adapter.sendEmail(
            userEmail,
            replySubject,
            reply + AI_SUFFIX,
          );

          console.log("[GmailSelfListener] Reply sent successfully");

          // Save conversation history
          gmailConversationStore.addMessage(
            this.userId,
            accountId,
            "user",
            messageText,
          );
          gmailConversationStore.addMessage(
            this.userId,
            accountId,
            "assistant",
            reply,
          );
        } catch (error) {
          console.error("[GmailSelfListener] Failed to send reply:", error);
        }
      },
      "gmail",
    );
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    console.log(`[GmailSelfListener] Stopping for user ${this.userId}`);

    this.running = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Kill all adapters
    for (const [accountId, { adapter }] of this.adapters) {
      try {
        await adapter.kill();
        console.log(
          `[GmailSelfListener] Killed adapter for account ${accountId}`,
        );
      } catch (error) {
        console.error(
          `[GmailSelfListener] Error killing adapter for account ${accountId}:`,
          error,
        );
      }
    }

    this.adapters.clear();
    this.processedUids.clear();
    this.lastCheckTimes.clear();
  }
}

// Global registry of self-message listeners
const selfMessageListeners = new Map<string, GmailSelfMessageListener>();

/**
 * Start Self Message Listener for a specific user
 */
export async function startGmailSelfMessageListener(
  userId: string,
  authToken?: string,
): Promise<void> {
  // Stop existing listener if any
  if (selfMessageListeners.has(userId)) {
    console.log(
      `[GmailSelfListener] Stopping existing listener for user ${userId}`,
    );
    await stopGmailSelfMessageListener(userId);
  }

  const listener = new GmailSelfMessageListener({
    userId,
    authToken,
  });

  selfMessageListeners.set(userId, listener);
  await listener.start();
}

/**
 * Stop Self Message Listener for a specific user
 */
export async function stopGmailSelfMessageListener(
  userId: string,
): Promise<void> {
  const listener = selfMessageListeners.get(userId);
  if (listener) {
    await listener.stop();
    selfMessageListeners.delete(userId);
  }
}

/**
 * Check if Self Message Listener is running for a user
 */
export function isGmailSelfMessageListenerRunning(userId: string): boolean {
  return selfMessageListeners.has(userId);
}
