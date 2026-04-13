"use client";

import { useCallback, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Insight } from "@/lib/db/schema";
import type { DetailData, TimelineData } from "@/lib/ai/subagents/insights";
import { useInsightPagination } from "@/hooks/use-insight-data";
import { useInsightCache } from "@/hooks/use-insight-cache";
import { useIntegrations } from "@/hooks/use-integrations";
import { TG_SEND_INVALID_PEER_ID_ERR_MSG } from "../utils";

export interface SendInsightReplyParams {
  /** Plain text message content (e.g., emoji or short sentence) */
  content: string;
  /** Recipient (channel or person) */
  recipient: string;
  /** Account ID used for sending */
  accountId: string;
}

/**
 * Optimistic update message state type
 */
export interface PendingMessage extends DetailData {
  /** Temporary message ID, for tracking optimistic updates */
  pendingId: string;
  /** Send status: pending | sending | sent | failed */
  status: "pending" | "sending" | "sent" | "failed";
  /** Error message (when failed) */
  error?: string;
  /** Original send parameters (for retry) */
  originalParams?: SendInsightReplyParams;
}

/**
 * Message send result
 */
export interface SendResult {
  success: boolean;
  mock?: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Global pending message state manager (shared across components)
 */
class PendingMessageManager {
  private static instance: PendingMessageManager;
  private pendingMessages = new Map<string, PendingMessage>();
  private listeners = new Set<() => void>();

  private constructor() {}

  static getInstance(): PendingMessageManager {
    if (!PendingMessageManager.instance) {
      PendingMessageManager.instance = new PendingMessageManager();
    }
    return PendingMessageManager.instance;
  }

  add(message: PendingMessage) {
    this.pendingMessages.set(message.pendingId, message);
    this.notify();
  }

  update(pendingId: string, updates: Partial<PendingMessage>) {
    const message = this.pendingMessages.get(pendingId);
    if (message) {
      this.pendingMessages.set(pendingId, { ...message, ...updates });
      this.notify();
    }
  }

  remove(pendingId: string) {
    this.pendingMessages.delete(pendingId);
    this.notify();
  }

  get(pendingId: string): PendingMessage | undefined {
    return this.pendingMessages.get(pendingId);
  }

  getAll(): PendingMessage[] {
    return Array.from(this.pendingMessages.values());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

/**
 * Reusable "send Insight reply" logic, for use by ReplyWorkspace and quick emoji reply scenarios.
 * Calls /api/bot/send with optimistic updates and persistence.
 */
export function useSendInsightReply(insight: Insight) {
  const { t } = useTranslation();
  const { mutateInsightList } = useInsightPagination();
  const { addReply } = useInsightCache();
  const { accounts } = useIntegrations();
  const [isSending, setIsSending] = useState(false);
  const pendingManagerRef = useRef(PendingMessageManager.getInstance());

  /**
   * Mark message as sent successfully
   */
  const markMessageSent = useCallback(
    (pendingId: string, newDetail: DetailData) => {
      pendingManagerRef.current.update(pendingId, { status: "sent" });

      // Delay removing the pending state so the user can see the success state
      setTimeout(() => {
        pendingManagerRef.current.remove(pendingId);
      }, 500);
    },
    [],
  );

  /**
   * Mark message as failed
   */
  const markMessageFailed = useCallback(
    (
      pendingId: string,
      errorMessage: string,
      originalParams?: SendInsightReplyParams,
    ) => {
      pendingManagerRef.current.update(pendingId, {
        status: "failed",
        error: errorMessage,
        originalParams,
      });
    },
    [],
  );

  /**
   * Internal send logic
   */
  const sendReplyInternal = useCallback(
    async (
      params: SendInsightReplyParams,
      pendingId?: string,
    ): Promise<SendResult> => {
      const { content, recipient, accountId } = params;
      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        if (pendingId) {
          markMessageFailed(
            pendingId,
            t("common.missingPlatform", "Select an account to send from."),
            params,
          );
        }
        return { success: false, error: "Account not found" };
      }

      const requestBody = {
        botId: insight.botId,
        recipients: [recipient],
        message: content,
        messageHtml: content,
      };

      try {
        const response = await fetch("/api/bot/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();

        if (!response.ok) {
          const errorMessage =
            typeof result?.message === "string"
              ? result.message
              : t("common.sendFailedUnknownReason");
          throw new Error(errorMessage);
        }

        const currentTime = Date.now();
        const senderName = account.displayName || account.bot?.name || "Me";
        const newDetail: DetailData = {
          time: currentTime,
          person: senderName,
          platform: account.platform ?? undefined,
          channel: recipient || undefined,
          content,
        };
        const summaryPrefix = t("insight.youReplied", "You replied");
        const contentPreview =
          content.slice(0, 50) + (content.length > 50 ? "..." : "");
        const newTimelineItem: TimelineData = {
          time: currentTime,
          label: "💬",
          summary: `${summaryPrefix}: ${contentPreview}`,
        };

        const originalRecipients = [
          ...(insight.groups || []),
          ...(insight.people || []),
        ];
        const isReplyingToOriginalRecipients =
          originalRecipients.includes(recipient);

        if (isReplyingToOriginalRecipients) {
          // If there is a pendingId, update the corresponding message state
          if (pendingId) {
            markMessageSent(pendingId, newDetail);
          }

          // Update insight list (replace optimistic message with real message)
          mutateInsightList((currentPages) => {
            if (!currentPages) return currentPages;
            return currentPages.map((page) => ({
              ...page,
              items: page.items.map((item) => {
                if (item.id === insight.id) {
                  return {
                    ...item,
                    details: [...(item.details || []), newDetail],
                    timeline: [...(item.timeline || []), newTimelineItem],
                  };
                }
                return item;
              }),
            }));
          }, false);

          // Update global cache (ensure data persists after closing and reopening drawer)
          addReply(insight.id, newDetail, newTimelineItem);

          // Async persist
          fetch(`/api/insights/${insight.id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              detail: newDetail,
              timeline: newTimelineItem,
            }),
          }).catch(() => mutateInsightList());
        }

        return {
          success: true,
          mock: result.mock,
          messageId: newDetail.time?.toString(),
        };
      } catch (error) {
        let errorMessage =
          error instanceof Error ? error.message : t("common.sendErrorGeneric");
        if (errorMessage.includes(TG_SEND_INVALID_PEER_ID_ERR_MSG)) {
          errorMessage = t("common.sendErrorCannotFindInputEntity");
        }

        if (pendingId) {
          markMessageFailed(pendingId, errorMessage, params);
        }

        return { success: false, error: errorMessage };
      }
    },
    [
      insight,
      accounts,
      t,
      markMessageFailed,
      markMessageSent,
      mutateInsightList,
      addReply,
    ],
  );

  /**
   * Optimistic update: immediately display pending message in the UI
   */
  const addOptimisticMessage = useCallback(
    (
      content: string,
      recipient: string,
      accountId: string,
      account?: {
        displayName?: string;
        bot?: { name?: string } | null;
        platform?: string;
      },
    ) => {
      const currentTime = Date.now();
      const senderName = account?.displayName || account?.bot?.name || "Me";
      const pendingId = `pending-${currentTime}-${Math.random().toString(36).slice(2, 9)}`;

      const pendingMessage: PendingMessage = {
        pendingId,
        status: "sending",
        time: currentTime,
        person: senderName,
        platform: account?.platform ?? undefined,
        channel: recipient || undefined,
        content,
        originalParams: { content, recipient, accountId },
      };

      // Add to global manager
      pendingManagerRef.current.add(pendingMessage);

      // Optimistically update insight list
      mutateInsightList((currentPages) => {
        if (!currentPages) return currentPages;
        return currentPages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (item.id === insight.id) {
              return {
                ...item,
                details: [
                  ...(item.details || []),
                  pendingMessage as DetailData,
                ],
              };
            }
            return item;
          }),
        }));
      }, false);

      // Optimistically update global cache
      addReply(insight.id, pendingMessage as DetailData, {
        time: currentTime,
        label: "💬",
        summary: `Sending: ${content.slice(0, 50)}`,
      });

      return pendingId;
    },
    [insight.id, mutateInsightList, addReply],
  );

  /**
   * Retry sending a failed message
   */
  const retryMessage = useCallback(
    async (pendingId: string): Promise<SendResult> => {
      const pendingMessage = pendingManagerRef.current.get(pendingId);
      if (!pendingMessage || !pendingMessage.originalParams) {
        return { success: false, error: "Message not found" };
      }

      // Mark as sending
      pendingManagerRef.current.update(pendingId, {
        status: "sending",
        error: undefined,
      });

      return sendReplyInternal(pendingMessage.originalParams, pendingId);
    },
    [sendReplyInternal],
  );

  const sendReply = useCallback(
    async (params: SendInsightReplyParams): Promise<SendResult> => {
      const { content, recipient, accountId } = params;
      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        toast.error(
          t("common.missingPlatform", "Select an account to send from."),
        );
        return { success: false, error: "Account not found" };
      }

      setIsSending(true);

      try {
        // Add optimistic update and get pendingId
        const pendingId = addOptimisticMessage(
          content,
          recipient,
          accountId,
          account,
        );

        // Send message
        const result = await sendReplyInternal({ ...params }, pendingId);

        if (result.success) {
          toast.success(
            result.mock
              ? t(
                  "insight.replySentSuccessMock",
                  "Reply sent successfully (mock mode).",
                )
              : t("insight.replySentSuccess", "Reply sent successfully."),
          );
        } else if (!pendingManagerRef.current.get(pendingId ?? "")) {
          // If the message has already been removed, show error notification
          toast.error(
            t("insight.replySentFailed", "We couldn't send that reply."),
            {
              description: result.error,
            },
          );
        }

        return result;
      } finally {
        setIsSending(false);
      }
    },
    [accounts, t, addOptimisticMessage, sendReplyInternal],
  );

  return { sendReply, isSending, retryMessage };
}
