"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/db/schema";
import type { DetailData } from "@/lib/ai/subagents/insights";

interface RecipientRecentMessagesProps {
  /**
   * Insight object, containing the details array
   */
  insight: Insight;
  /**
   * List of recipients (including to, cc, bcc)
   */
  recipients: string[];
  /**
   * Function to get recipient label
   */
  getRecipientLabel: (recipient: string) => string;
}

/**
 * Recipient recent messages card component
 * Displays the most recent message from each recipient within this Insight
 */
export function RecipientRecentMessages({
  insight,
  recipients,
  getRecipientLabel,
}: RecipientRecentMessagesProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.includes("zh") ? zhCN : enUS;
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  /**
   * Match recent messages based on recipient name
   * Matching logic:
   * 1. Match detail.person (individual)
   * 2. Match detail.channel (channel/group)
   * 3. Match insight.groups (group list)
   */
  const recipientMessages = useMemo(() => {
    if (!recipients.length || !insight.details?.length) {
      return [];
    }

    const messages: Array<{
      recipient: string;
      detail: DetailData;
      matchScore: number;
    }> = [];

    for (const recipient of recipients) {
      let bestMatch: DetailData | null = null;
      let bestScore = 0;
      let bestTime = 0;

      const recipientLower = recipient.toLowerCase().trim();

      for (const detail of insight.details) {
        if (!detail.content) continue;

        let score = 0;

        // 1. Match detail.person (individual)
        if (detail.person) {
          const personLower = detail.person.toLowerCase().trim();
          if (personLower === recipientLower) {
            score = 100;
          } else if (
            personLower.includes(recipientLower) ||
            recipientLower.includes(personLower)
          ) {
            score = 50;
          } else {
            // Partial match (e.g., "SmartBI - Project Team" matches "SmartBI")
            const recipientParts = recipientLower.split(/[\s\-_]+/);
            const personParts = personLower.split(/[\s\-_]+/);
            const commonParts = recipientParts.filter((part) =>
              personParts.some((p) => p.includes(part) || part.includes(p)),
            );
            if (commonParts.length > 0) {
              score = 30;
            }
          }
        }

        // 2. Match detail.channel (channel/group)
        if (score === 0 && detail.channel) {
          const channelLower = detail.channel.toLowerCase().trim();
          if (channelLower === recipientLower) {
            score = 90;
          } else if (
            channelLower.includes(recipientLower) ||
            recipientLower.includes(channelLower)
          ) {
            score = 40;
          } else {
            const recipientParts = recipientLower.split(/[\s\-_]+/);
            const channelParts = channelLower.split(/[\s\-_]+/);
            const commonParts = recipientParts.filter((part) =>
              channelParts.some((p) => p.includes(part) || part.includes(p)),
            );
            if (commonParts.length > 0) {
              score = 25;
            }
          }
        }

        // 3. Match insight.groups (group list)
        if (score === 0 && insight.groups?.length) {
          const matchedGroup = insight.groups.find((group) => {
            const groupLower = group.toLowerCase().trim();
            return (
              groupLower === recipientLower ||
              groupLower.includes(recipientLower) ||
              recipientLower.includes(groupLower)
            );
          });
          if (matchedGroup) {
            score = 35;
          }
        }

        if (score > 0) {
          const detailTime = detail.time ?? 0;
          // If score is higher, or score is the same but time is more recent, update the best match
          if (
            score > bestScore ||
            (score === bestScore && detailTime > bestTime)
          ) {
            bestMatch = detail;
            bestScore = score;
            bestTime = detailTime;
          }
        }
      }

      if (bestMatch) {
        messages.push({
          recipient,
          detail: bestMatch,
          matchScore: bestScore,
        });
      }
    }

    // Sort by time descending (newest first)
    return messages.sort((a, b) => (b.detail.time ?? 0) - (a.detail.time ?? 0));
  }, [recipients, insight.details, insight.groups]);

  /**
   * Toggle expand/collapse state for all cards
   * When clicking any button, all cards expand or collapse synchronously
   */
  const toggleAllCards = () => {
    setIsAllExpanded((prev) => !prev);
  };

  /**
   * Handle mouse drag start
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) return;

    // Only start dragging on left mouse button
    if (e.button !== 0) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      scrollLeft: container.scrollLeft,
    };

    // Prevent text selection
  };

  /**
   * Handle mouse movement (during drag)
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const container = scrollRef.current;
      if (!container) return;

      const deltaX = e.clientX - dragStartRef.current.x;

      // Update scroll position
      const newScrollLeft = dragStartRef.current.scrollLeft - deltaX;
      // Ensure scroll position is within valid range
      const maxScroll = container.scrollWidth - container.clientWidth;
      const clampedScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));
      container.scrollLeft = clampedScrollLeft;

      // Update dragStartRef for continuous dragging
      dragStartRef.current = {
        x: e.clientX,
        scrollLeft: clampedScrollLeft,
      };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (recipientMessages.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-2 px-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          {t("common.recentMessages", "Recent messages")}
        </h3>
      </div>
      <div
        ref={scrollRef}
        role="region"
        aria-label="Recent messages cards"
        onMouseDown={handleMouseDown}
        className={cn(
          "flex gap-2 mx-0 px-0",
          // Support horizontal scrolling
          "overflow-x-auto",
          // Prevent text selection during drag
          "select-none",
          // Cursor style during drag
          isDragging ? "cursor-grabbing" : "cursor-grab",
          // Always hide scrollbar (WebKit browsers)
          "[&::-webkit-scrollbar]:hidden",
        )}
        style={{
          // Firefox and Edge: always hide scrollbar
          scrollbarWidth: "none",
          // Allow horizontal pan gesture
          touchAction: "pan-x",
          // iOS smooth scrolling
          WebkitOverflowScrolling: "touch",
        }}
      >
        {recipientMessages.map(({ recipient, detail }) => {
          const content = detail.content ?? "";
          const isLongContent = content.length > 100;
          const displayContent = isAllExpanded
            ? content
            : isLongContent
              ? `${content.slice(0, 100)}...`
              : content;

          return (
            <div
              key={recipient}
              className={`flex-shrink-0 min-w-[260px] max-w-[380px] w-[260px] sm:min-w-[280px] sm:max-w-[400px] sm:w-[280px] bg-gray-100 rounded-lg border border-border/60 shadow-sm overflow-hidden transition-all duration-200 ${
                !isAllExpanded ? "h-[120px]" : ""
              }`}
            >
              {/* Card header */}
              <div className="px-3 py-2 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {getRecipientLabel(recipient)}
                    </div>
                    {detail.time && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(detail.time), "MM/dd HH:mm", {
                          locale,
                        })}
                      </div>
                    )}
                    {detail.person && detail.person !== recipient && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {detail.person}
                      </div>
                    )}
                  </div>
                  {isLongContent && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllCards();
                      }}
                      className="flex-shrink-0 p-1 hover:bg-gray-200/60 rounded transition-colors absolute top-2 right-2"
                      aria-label={
                        isAllExpanded
                          ? t("common.collapse")
                          : t("common.expand")
                      }
                    >
                      {isAllExpanded ? (
                        <RemixIcon
                          name="chevron_up"
                          size="size-3.5"
                          className="text-muted-foreground"
                        />
                      ) : (
                        <RemixIcon
                          name="chevron_down"
                          size="size-3.5"
                          className="text-muted-foreground"
                        />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Card content */}
              <div
                className={`px-3 pb-2 transition-all duration-200 overflow-y-auto ${
                  isAllExpanded ? "max-h-[240px]" : "overflow-hidden"
                }`}
              >
                <div className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {displayContent}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
