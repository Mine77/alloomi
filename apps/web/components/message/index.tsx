"use client";

import cx from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import type { Vote } from "@/lib/db/schema";
import { RemixIcon } from "../remix-icon";
import { MarkdownWithCitations } from "../markdown-with-citations";
import { MessageActions } from "../message-actions";
import equal from "fast-deep-equal";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { MessageEditor } from "../message-editor";
import { MessageReasoning } from "../message-reasoning";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatMessage } from "@alloomi/shared";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "usehooks-ts";
import { useIntegrations } from "@/hooks/use-integrations";
import { PreviewAttachment } from "../preview-attachment";
import type { Insight } from "@/lib/db/schema";
import { CitedInsightsDrawer } from "../cited-insights-drawer";
import InsightDetailDrawer from "../insight-detail-drawer";
import { useInsightPagination } from "@/hooks/use-insight-data";
import { useInsightActions } from "@/hooks/use-insight-actions";
import { getFileIcon, getFileColor } from "@/lib/utils/file-icons";
import { QuestionInput } from "../question-input";
import { useChatContext } from "../chat-context";
import type { ContentSegment } from "@alloomi/shared/ref";
import { parseContentWithRefs } from "@alloomi/shared/ref";
import { InlineRefBadge } from "../inline-ref-badge";

// Extracted components
import { ErrorMessageDisplay } from "./error-message-display";
import { NativeToolCall } from "./native-tool-call";
import { RawMessagesResult } from "./raw-messages-result";
import { ToolCallAccordion, type ToolCallPart } from "./tool-call-accordion";

// Global set to track processed insight IDs across all message components
// This prevents duplicate processing when components re-render
const globallyProcessedInsightIds = new Set<string>();

// Global state management - ensure only one floating panel is open at a time
const useFloatingPanelState = () => {
  const [currentOpenPanelId, setCurrentOpenPanelId] = useState<string | null>(
    null,
  );

  const openPanel = useCallback((panelId: string) => {
    setCurrentOpenPanelId(panelId);
  }, []);

  const closePanel = useCallback(() => {
    setCurrentOpenPanelId(null);
  }, []);

  const isPanelOpen = useCallback(
    (panelId: string) => currentOpenPanelId === panelId,
    [currentOpenPanelId],
  );

  return { openPanel, closePanel, isPanelOpen };
};

const PurePreviewMessage = ({
  chatId,
  message,
  isAgentRunning,
  vote,
  isLoading,
  sendMessage,
  setMessages,
  onRefresh,
  requiresScrollPadding,
  isHighlighted = false,
  inVisibleLoadingIds,
}: {
  chatId: string;
  message: ChatMessage;
  isAgentRunning?: boolean;
  vote: Vote | undefined;
  isLoading: boolean;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  onRefresh: () => Promise<void>;
  requiresScrollPadding: boolean;
  isHighlighted?: boolean;
  inVisibleLoadingIds?: Set<string>;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = `reply-panel-${message.id}`;
  const { openPanel, isPanelOpen } = useFloatingPanelState();
  const { t } = useTranslation();
  const { accounts } = useIntegrations();
  const hasConnectedAccounts = accounts.length > 0;
  const previousPanelIdRef = useRef(panelId);

  const [isHighlighting, setIsHighlighting] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSourcesDrawerOpen, setIsSourcesDrawerOpen] = useState(false);
  const {
    openFilePreviewPanel,
    messages: contextMessages,
    setMessages: contextSetMessages,
  } = useChatContext();
  const [, copyToClipboard] = useCopyToClipboard();

  const { insightData, mutateInsightList } = useInsightPagination();

  // Insight operations hook
  const { handleFavoriteInsight, handleArchiveInsight } = useInsightActions(
    mutateInsightList,
    selectedInsight,
    setSelectedInsight,
    setIsDrawerOpen,
  );

  // Store pending insight for optimistic update (processed in useEffect)
  const [pendingInsight, setPendingInsight] = useState<{
    insight: Insight;
    insightId: string;
  } | null>(null);

  // Handle optimistic update in useEffect to avoid setting state during render
  useEffect(() => {
    if (pendingInsight) {
      const { insight, insightId } = pendingInsight;

      // Check if already processed to prevent duplicates (using global set)
      if (globallyProcessedInsightIds.has(insightId)) {
        console.log(
          "[Optimistic update] Skipping already processed insight:",
          insightId,
        );
        setPendingInsight(null);
        return;
      }

      // Mark as processed globally
      globallyProcessedInsightIds.add(insightId);

      // Optimistically update the insight list
      mutateInsightList((currentPages) => {
        if (!currentPages || currentPages.length === 0) {
          return currentPages;
        }

        // Add the new insight to the first page
        const updatedPages = currentPages.map((page, index) => {
          if (index === 0) {
            return {
              ...page,
              items: [insight, ...(page.items || [])],
            };
          }
          return page;
        });

        return updatedPages;
      }, false);

      // Clear pending insight after processing
      setPendingInsight(null);
    }
  }, [pendingInsight, mutateInsightList]);

  /**
   * Extract all Insight IDs referenced in the message
   */
  const citedInsightIds = useMemo(() => {
    const textFromParts = message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!textFromParts) return [];

    const citationRegex = /\^\[([^\]]+)\]\^/g;
    const ids: string[] = [];
    let match: RegExpExecArray | null = citationRegex.exec(textFromParts);

    while (match !== null) {
      const insightId = match[1].toString();
      if (insightId && !ids.includes(insightId)) {
        ids.push(insightId);
      }
      match = citationRegex.exec(textFromParts);
    }

    return ids;
  }, [message.parts]);

  /**
   * Get all referenced Insights
   */
  const citedInsights = useMemo(() => {
    if (citedInsightIds.length === 0) return [];

    return citedInsightIds
      .map((id) => insightData.items.find((i: Insight) => i.id === id))
      .filter((insight): insight is Insight => insight !== undefined);
  }, [citedInsightIds, insightData.items]);

  /**
   * Handle citation badge click event
   */
  const handleCitationClick = useCallback(
    (insightId: string) => {
      const insight = insightData.items.find(
        (i: Insight) => i.id === insightId,
      );
      if (insight) {
        setSelectedInsight(insight);
        setIsDrawerOpen(true);
      }
    },
    [insightData.items],
  );

  /**
   * Handle source badge click event - open cited Insights drawer
   */
  const handleSourcesClick = useCallback(() => {
    if (citedInsights.length > 0) {
      setIsSourcesDrawerOpen(true);
    }
  }, [citedInsights]);

  /**
   * Close drawer
   */
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedInsight(null);
  }, []);

  /**
   * Close sources drawer
   */
  const handleCloseSourcesDrawer = useCallback(() => {
    setIsSourcesDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!isHighlighted) return;
    setIsHighlighting(true);
    const timeout = window.setTimeout(() => setIsHighlighting(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [isHighlighted]);

  useEffect(() => {
    if (previousPanelIdRef.current !== panelId) {
      if (isPanelOpen(previousPanelIdRef.current)) {
        openPanel(panelId);
      }
      previousPanelIdRef.current = panelId;
    }
  }, [isPanelOpen, openPanel, panelId]);

  // Track processed insight refresh parts to prevent duplicate processing
  const processedInsightRefreshPartsRef = useRef<Set<string>>(new Set());

  // Process data-insightsRefresh parts in useEffect to avoid infinite re-renders
  useEffect(() => {
    if (!message.parts) return;

    message.parts.forEach((part, index) => {
      const partId = `${message.id}-${index}`;
      const type = (part as any).type;

      if (type === "data-insightsRefresh") {
        // Skip if already processed
        if (processedInsightRefreshPartsRef.current.has(partId)) {
          return;
        }

        const data = (part as any).data;

        if (data?.action === "create" && data?.insight) {
          const { insight, insightId } = data;

          // Skip if already processed to prevent duplicates (using global set)
          if (!globallyProcessedInsightIds.has(insightId)) {
            setPendingInsight({ insight, insightId });
          }
        } else if (data?.action === "delete" && data?.insightId) {
          // Optimistic update: remove deleted insight from list
          const { insightId } = data;
          mutateInsightList((currentData) => {
            if (!currentData) return currentData;

            return currentData.map((page) => ({
              ...page,
              items: page.items.filter(
                (item: Insight) => item.id !== insightId,
              ),
            }));
          }, false);

          console.log(`[Message] Optimistically deleted insight: ${insightId}`);
        }

        // Mark this part as processed
        processedInsightRefreshPartsRef.current.add(partId);

        // Still call onRefresh for compatibility
        if (onRefresh && typeof onRefresh === "function") {
          onRefresh();
        }
      }
    });
  }, [message.id, message.parts, mutateInsightList, onRefresh]);

  // Filter duplicate agent plan messages, keep only the latest one
  // If message contains error and plan not executed (currentStep=0), hide the plan
  const filteredParts = useMemo(() => {
    if (!message.parts) return message.parts;

    const agentPlans: Array<{
      part: any;
      index: number;
      planId: string;
      currentStep?: number;
    }> = [];
    const otherParts: Array<{ part: any; index: number }> = [];

    // Check if message contains error indicators
    const messageContent = message.parts
      .filter((part) => part.type === "text" || typeof part === "string")
      .map((part) =>
        typeof part === "string" ? part : (part as any).text || "",
      )
      .join(" ")
      .toLowerCase();

    const hasError =
      messageContent.includes("error") ||
      messageContent.includes("failed") ||
      messageContent.includes("service unavailable");

    message.parts.forEach((part, index) => {
      const { type } = part;
      if (type === "data-agentPlan" || type === "data-agentPlanUpdate") {
        const planPart = part as any;
        const currentStep = planPart.data?.currentStep ?? 0;
        agentPlans.push({
          part,
          index,
          planId: planPart.data?.id || "",
          currentStep,
        });
      } else {
        otherParts.push({ part, index });
      }
    });

    // Hide plans that haven't started (currentStep=0) if message has error
    if (hasError) {
      const plansWithProgress = agentPlans.filter(
        (p) => (p.currentStep ?? 0) > 0,
      );
      if (plansWithProgress.length === 0) {
        // All plans are at step 0, hide them all
        console.log(
          `[Message] Message ${message.id.substring(0, 8)}... has error, hiding all unstarted plans`,
        );
        return otherParts.map((item) => item.part);
      }
      // Keep only plans with progress
      console.log(
        `[Message] Message ${message.id.substring(0, 8)}... has error, keeping only plans with progress`,
      );
      return [...otherParts, ...plansWithProgress]
        .sort((a, b) => a.index - b.index)
        .map((item) => item.part);
    }

    // Group agent plans by planId, and for each planId, keep only the latest update
    // ALWAYS filter to show only ONE plan (the most progressed one)
    if (agentPlans.length > 0) {
      // Sort all plans by currentStep descending, then by index descending
      const sortedPlans = agentPlans.sort((a, b) => {
        const stepA = a.currentStep ?? 0;
        const stepB = b.currentStep ?? 0;
        if (stepA !== stepB) return stepB - stepA; // Higher currentStep first
        return b.index - a.index; // Later index first if same step
      });

      // Keep only the FIRST plan (the one with highest currentStep and latest index)
      const latestPlan = sortedPlans[0];
      const filtered = [...otherParts, latestPlan]
        .sort((a, b) => a.index - b.index)
        .map((item) => item.part);

      console.log(
        `[Message] Found ${agentPlans.length} agent plans in message ${message.id.substring(0, 8)}...`,
        `Keeping only 1 plan with highest progress (step: ${latestPlan.currentStep ?? 0}, planId: ${latestPlan.planId.substring(0, 8)}...)`,
      );

      return filtered;
    }

    // Even with only one plan, still log it
    if (agentPlans.length === 1) {
      console.log(
        `[Message] Message ${message.id.substring(0, 8)}... has 1 agent plan: ${agentPlans[0].planId.substring(0, 8)}...`,
      );
    }

    return message.parts;
  }, [message.id, message.parts]);

  // Helper function to group consecutive tool-native parts
  const groupToolNativeParts = useMemo(() => {
    if (!filteredParts) return [];

    const groups: Array<{
      type: "tool-group" | "single-part";
      parts?: ToolCallPart[];
      part?: any;
      index: number;
    }> = [];

    let currentToolGroup: ToolCallPart[] = [];

    filteredParts.forEach((part, index) => {
      const { type } = part;

      if (type === "tool-native") {
        currentToolGroup.push({
          key: `message-${message.id}-part-${index}`,
          toolName: part.toolName,
          status: part.status,
          toolOutput: part.toolOutput,
          generatedFile: part.generatedFile,
          codeFile: part.codeFile,
          toolInput: part.toolInput,
        });
      } else {
        // End current tool group if any
        if (currentToolGroup.length > 0) {
          groups.push({
            type: "tool-group",
            parts: currentToolGroup,
            index: index - currentToolGroup.length,
          });
          currentToolGroup = [];
        }

        // Add non-tool part
        groups.push({
          type: "single-part",
          part,
          index,
        });
      }
    });

    // Add remaining tool group if any
    if (currentToolGroup.length > 0) {
      groups.push({
        type: "tool-group",
        parts: currentToolGroup,
        index: filteredParts.length - currentToolGroup.length,
      });
    }

    return groups;
  }, [filteredParts, message.id]);

  // Detect if the last tool call is executing
  const isLastToolExecuting = useMemo(() => {
    if (!filteredParts) return false;

    // Find the position of the last tool-native
    let lastToolIndex = -1;
    let lastToolStatus = "completed";
    filteredParts.forEach((part, index) => {
      if (part.type === "tool-native") {
        lastToolIndex = index;
        lastToolStatus = part.status || "completed";
      }
    });

    // If no tool calls, return false
    if (lastToolIndex === -1) return false;

    // If agent is not running, no tool can be executing
    if (!isAgentRunning) return false;

    // If the last tool status is executing, return true
    if (lastToolStatus === "executing") return true;

    // Check if there's any content after the last tool call
    const hasContentAfter = filteredParts.length > lastToolIndex + 1;

    // If there's nothing after, it means it's executing
    return !hasContentAfter;
  }, [filteredParts, isAgentRunning]);

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        data-testid={`message-${message.role}`}
        data-message-id={message.id}
        className={cx(
          "w-full px-0 sm:px-0 group/message",
          isHighlighting &&
            "outline outline-2 outline-primary/35 outline-offset-4",
        )}
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        data-role={message.role}
        style={{ scrollMarginTop: "96px", scrollMarginBottom: "72px" }}
      >
        <div
          className={cn(
            "flex gap-2 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
            // Add "pl-1" here to prevent list components from being obscured.
            message.role === "assistant" && "pl-1",
            {
              "w-full": mode === "edit",
              "group-data-[role=user]/message:w-fit": mode !== "edit",
            },
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-2 w-full min-w-0",
              message.role === "assistant" && "relative",
            )}
          >
            {(() => {
              // Collect image parts for separate rendering
              const imageParts: Array<{
                part: any;
                index: number;
                key: string;
              }> = [];

              filteredParts?.forEach((part, index) => {
                const { type } = part;
                if (type === "file") {
                  const filePart = part as any;
                  const { mediaType } = filePart;
                  if (mediaType?.startsWith("image/")) {
                    const key = `message-${message.id}-part-${index}`;
                    imageParts.push({ part, index, key });
                  }
                }
              });

              return (
                <>
                  {/* Render all content in original parts order */}
                  {groupToolNativeParts.map((group, groupIndex) => {
                    // Render tool group using accordion
                    if (group.type === "tool-group" && group.parts) {
                      // Check if this is the last tool group
                      const isLastGroup =
                        groupIndex === groupToolNativeParts.length - 1;
                      return (
                        <div key={`tool-group-${group.index}`} className="mt-3">
                          <ToolCallAccordion
                            parts={group.parts}
                            isExecuting={isLastGroup && isLastToolExecuting}
                            hasConnectedAccounts={hasConnectedAccounts}
                            renderToolCall={(toolPart, options) => (
                              <NativeToolCall
                                key={toolPart.key}
                                toolName={toolPart.toolName}
                                status={toolPart.status}
                                toolOutput={toolPart.toolOutput}
                                generatedFile={toolPart.generatedFile}
                                codeFile={toolPart.codeFile}
                                toolInput={toolPart.toolInput}
                                isExecuting={toolPart.isExecuting}
                                embeddedInAccordion={
                                  options?.embeddedInAccordion
                                }
                                hasConnectedAccounts={
                                  options?.hasConnectedAccounts ??
                                  hasConnectedAccounts
                                }
                                taskId={chatId}
                                onPreviewFile={(file) => {
                                  openFilePreviewPanel(file);
                                }}
                              />
                            )}
                          />
                        </div>
                      );
                    }

                    // Render single part (non-tool-native)
                    const part = group.part;
                    if (!part) return null;
                    const { type } = part;
                    const index = group.index;
                    const key = `message-${message.id}-part-${index}`;

                    // Handle text type
                    if (type === "text") {
                      const textContent =
                        (part as any).text ?? (part as any).content ?? "";
                      const isUserMessage = message.role === "user";

                      // Check if buttons need to be displayed (only show once, in the first text part)
                      const isFirstTextPart =
                        index === 0 ||
                        !filteredParts
                          ?.slice(0, index)
                          .some((p, i) => i < index && p.type === "text");

                      // In edit mode, don't show user bubble, only show edit box (rendered by Edit mode block below)
                      if (isUserMessage && mode === "edit") return null;

                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex flex-row w-full min-w-0",
                            message.role === "assistant" && "relative",
                          )}
                        >
                          {/* Text area: bubble + action bar below (user messages only) */}
                          <div
                            className={cn(
                              "flex flex-col gap-1 min-w-0 flex-1",
                              isUserMessage && "items-end",
                            )}
                          >
                            {/* Text content bubble */}
                            <div
                              data-testid="message-content"
                              className={cn(
                                "flex flex-col gap-1 min-w-0 max-w-full break-words",
                                isUserMessage &&
                                  "rounded-2xl p-4 bg-[var(--primary-50)] text-slate-900 border-0 dark:bg-[#1e3a5f]/30 dark:text-slate-100",
                                !isUserMessage && "font-serif",
                              )}
                            >
                              {(() => {
                                if (!isUserMessage)
                                  return (
                                    <MarkdownWithCitations
                                      onCitationClick={handleCitationClick}
                                      insights={insightData.items}
                                      onPreviewFile={openFilePreviewPanel}
                                    >
                                      {textContent}
                                    </MarkdownWithCitations>
                                  );
                                const segments: ContentSegment[] =
                                  parseContentWithRefs(
                                    String(textContent ?? ""),
                                  );
                                const hasRefs = segments.some(
                                  (s) => s.type === "ref",
                                );
                                if (!hasRefs)
                                  return (
                                    <MarkdownWithCitations
                                      onCitationClick={handleCitationClick}
                                      insights={insightData.items}
                                      onPreviewFile={openFilePreviewPanel}
                                    >
                                      {textContent}
                                    </MarkdownWithCitations>
                                  );
                                return (
                                  <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5">
                                    {segments.map((seg) =>
                                      seg.type === "text" ? (
                                        <span
                                          key={`text-${seg.value.length}-${seg.value.slice(0, 40)}`}
                                          className="whitespace-pre-wrap break-words"
                                        >
                                          {seg.value}
                                        </span>
                                      ) : (
                                        <InlineRefBadge
                                          key={`ref-${seg.kind}-${seg.label}`}
                                          kind={seg.kind}
                                          label={seg.label}
                                          t={t}
                                        />
                                      ),
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* User message action bar: edit, retry, copy - displayed below bubble */}
                            {isFirstTextPart &&
                              isUserMessage &&
                              mode === "view" && (
                                <div
                                  className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity"
                                  data-testid="message-user-actions"
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        data-testid="message-edit-button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-muted-foreground"
                                        onClick={() => setMode("edit")}
                                      >
                                        <RemixIcon name="edit" size="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {t("common.editMessage")}
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        data-testid="message-retry-button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-muted-foreground"
                                        onClick={() => {
                                          // Only regenerate previous AI reply: first remove current user message and subsequent assistant reply, then send with same content
                                          const idx = contextMessages.findIndex(
                                            (m) => m.id === message.id,
                                          );
                                          if (idx === -1) return;
                                          const next = contextMessages[idx + 1];
                                          const removeCount =
                                            next?.role === "assistant" ? 2 : 1;
                                          (
                                            contextSetMessages as (
                                              updater: (
                                                prev: ChatMessage[],
                                              ) => ChatMessage[],
                                              id?: string | null,
                                            ) => void
                                          )(
                                            (prev) => [
                                              ...prev.slice(0, idx),
                                              ...prev.slice(idx + removeCount),
                                            ],
                                            chatId,
                                          );
                                          sendMessage({
                                            role: "user",
                                            parts: [
                                              {
                                                type: "text",
                                                text: String(textContent ?? ""),
                                              },
                                            ],
                                          });
                                        }}
                                      >
                                        <RemixIcon
                                          name="refresh"
                                          size="size-4"
                                        />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {t("common.retry")}
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        data-testid="message-copy-button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-muted-foreground"
                                        onClick={() =>
                                          copyToClipboard(
                                            String(textContent ?? ""),
                                          )
                                        }
                                      >
                                        <RemixIcon name="copy" size="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {t("common.copy")}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    }

                    // Handle file type (images rendered uniformly in imageParts later, skip here)
                    if (type === "file") {
                      const filePart = part as any;
                      const { mediaType } = filePart;

                      if (mediaType?.startsWith("image/")) {
                        // Image rendering - convert mediaType to contentType
                        const attachment = {
                          ...filePart,
                          contentType: mediaType, // Convert field name
                        };
                        return (
                          <PreviewAttachment
                            key={key}
                            attachment={attachment}
                          />
                        );
                      }
                      // Other file types
                      return null;
                    }

                    // Handle reasoning type
                    if (type === "reasoning" && part.text?.trim().length > 0) {
                      return (
                        <MessageReasoning
                          key={key}
                          isLoading={isLoading}
                          reasoning={part.text}
                        />
                      );
                    }

                    // Handle data-loadingText type
                    if (type === "data-loadingText") {
                      const { data } = part;

                      if (inVisibleLoadingIds?.has(data.id)) {
                        return null;
                      }

                      return (
                        <motion.div
                          key={key}
                          data-testid="message-assistant-loading"
                          className="w-full mx-auto max-w-3xl px-0 group/message"
                          initial={{ y: 5, opacity: 0 }}
                          animate={{
                            y: 0,
                            opacity: 1,
                            transition: { delay: 1 },
                          }}
                        >
                          <div
                            className={cx(
                              "rounded-lg border border-border bg-card/50 mt-2 mb-2",
                              "group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
                            )}
                          >
                            <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground">
                              <span className="min-w-0 truncate whitespace-pre-wrap">
                                {data.content}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    // Handle error messages from Native Agent
                    if (type === "error") {
                      return (
                        <ErrorMessageDisplay
                          key={key}
                          errorContent={
                            (part as any).content || "Unknown error"
                          }
                        />
                      );
                    }

                    // Handle question messages from Agent (AskUserQuestion)
                    if (type === "data-question") {
                      const { data } = part;
                      if (data?.question) {
                        return (
                          <QuestionInput
                            key={key}
                            question={data.question}
                            onSubmit={(answers) => {
                              // Send answers back to agent as a user message
                              const answersText = Object.entries(answers)
                                .map(
                                  ([question, answer]) =>
                                    `${question}: ${answer}`,
                                )
                                .join("\n");
                              sendMessage({
                                role: "user",
                                parts: [
                                  {
                                    type: "text",
                                    text: answersText,
                                  },
                                ],
                              });
                            }}
                          />
                        );
                      }
                    }

                    // Handle Native Agent tool calls (now handled by accordion, return null)
                    if (type === "tool-native") {
                      return null;
                    }

                    // Note: data-insightsRefresh parts are now processed in useEffect
                    // to avoid infinite re-renders during component render

                    // Handle getRawMessages tool calls
                    if (type === "tool-getRawMessages") {
                      const toolPart = part as any;

                      // Only render if we have input parameters
                      if (toolPart.input) {
                        const { toolCallId, input } = toolPart;

                        // Always render - React's key prop handles deduplication
                        return (
                          <RawMessagesResult
                            key={key}
                            toolCallId={toolCallId}
                            input={input}
                            sendMessage={sendMessage}
                          />
                        );
                      }
                    }

                    return null;
                  })}

                  {/* Edit mode for text messages */}
                  {mode === "edit" &&
                    message.parts?.some((p) => p.type === "text") && (
                      <div className="flex w-full flex-row gap-2 items-start p-3 rounded-2xl bg-primary-50">
                        <MessageEditor
                          key={message.id}
                          message={message}
                          setMode={setMode}
                          setMessages={setMessages}
                        />
                      </div>
                    )}

                  {/* 3. Render image attachments - only for assistant messages to avoid duplicate display of user messages */}
                  {message.role === "assistant" && imageParts.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      {imageParts.map(({ part, key }) => {
                        const { url, name, mediaType } = part;
                        return (
                          <PreviewAttachment
                            key={key}
                            attachment={{ url, name, contentType: mediaType }}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Display RAG document attachments (read from metadata) */}
            {message.role === "user" &&
              (message.metadata as any)?.ragDocuments &&
              Array.isArray((message.metadata as any).ragDocuments) &&
              (message.metadata as any).ragDocuments.length > 0 && (
                <div className="flex flex-row gap-2 items-end justify-end">
                  <div className="flex flex-wrap gap-2 p-2 rounded-2xl bg-[var(--primary-50)] dark:bg-[#1e3a5f]/30 border-0">
                    <div className="flex flex-wrap gap-1">
                      {(message.metadata as any).ragDocuments.map(
                        (doc: { id: string; name: string }) => {
                          const FileIcon = getFileIcon(doc.name);
                          const fileColor = getFileColor(doc.name);

                          return (
                            <span
                              key={doc.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-900/30 text-xs hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors"
                              title={doc.name}
                            >
                              <FileIcon className={`w-3 h-3 ${fileColor}`} />
                              <span className="max-w-[150px] truncate font-medium">
                                {doc.name}
                              </span>
                            </span>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              )}

            <MessageActions
              key={`action-${message.id}`}
              chatId={chatId}
              message={message}
              vote={vote}
              isLoading={isLoading}
              onSourcesClick={handleSourcesClick}
            />
          </div>
        </div>

        {/* Cited Insights drawer */}
        <CitedInsightsDrawer
          insights={citedInsights}
          isOpen={isSourcesDrawerOpen}
          onClose={handleCloseSourcesDrawer}
          onSelectInsight={(insight) => {
            setSelectedInsight(insight);
            setIsDrawerOpen(true);
            setIsSourcesDrawerOpen(false);
          }}
        />

        {/* Single Insight detail drawer - use Portal for fullscreen display */}
        {isDrawerOpen &&
          ReactDOM.createPortal(
            <InsightDetailDrawer
              insight={selectedInsight}
              isOpen={isDrawerOpen}
              onClose={() => {
                setIsDrawerOpen(false);
                setSelectedInsight(null);
              }}
              onArchive={handleArchiveInsight}
              onFavorite={handleFavoriteInsight}
            />,
            document.body,
          )}
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (prevProps.isHighlighted !== nextProps.isHighlighted) return false;
    if (prevProps.isAgentRunning !== nextProps.isAgentRunning) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);
