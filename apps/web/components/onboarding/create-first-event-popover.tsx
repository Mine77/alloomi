"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { RemixIcon } from "@/components/remix-icon";
import { Button, Card } from "@alloomi/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@alloomi/ui";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@alloomi/hooks/use-is-mobile";
import { useSidePanel } from "@/components/agent/side-panel-context";
import { AgentChatPanel } from "@/components/agent/chat-panel";
import { PersonalizationLinkedAccounts } from "@/components/personalization/personalization-linked-accounts";
import { useIntegrations } from "@/hooks/use-integrations";
import { useChatContext } from "@/components/chat-context";
import type { OnboardingStepConfig } from "./onboarding-config";
import "../../i18n";

interface CreateFirstEventPopoverProps {
  step: OnboardingStepConfig;
  isCompleted: boolean;
  onComplete?: () => void;
}

/**
 * Card + centered small dialog for "Create your first tracking event" step
 * Opens centered dialog after clicking step, contains two card buttons in left-right layout: authorize platform and chat with AI
 */
/** Right-side Chat panel content: AgentChatPanel with title and close button */
function ChatSidePanelContent({ initialInput }: { initialInput?: string }) {
  const { t } = useTranslation();
  const { closeSidePanel } = useSidePanel();
  return (
    <div className="h-full flex flex-col bg-card">
      <div className="border-b border-border/60 bg-white/70 px-4 py-3 shrink-0 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground truncate">
          {t("common.chat", "Chat")}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={closeSidePanel}
          className="h-7 w-7 shrink-0"
          aria-label={t("common.close", "Close")}
        >
          <RemixIcon name="close" size="size-3" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <AgentChatPanel initialInput={initialInput} />
      </div>
    </div>
  );
}

export function CreateFirstEventPopover({
  step,
  isCompleted,
  onComplete,
}: CreateFirstEventPopoverProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { openSidePanel, sidePanel, closeSidePanel } = useSidePanel();
  const [open, setOpen] = useState(false);
  const [sourcesDialogOpen, setSourcesDialogOpen] = useState(false);

  // Track if we've already called onComplete to avoid duplicates
  const onCompleteCalledRef = useRef(false);

  // Check if the chat panel is the onboarding chat panel
  const isOnboardingChatPanelOpen = sidePanel?.id === "onboarding-chat-panel";

  // Get chat context to detect Tracking creation
  const { messages } = useChatContext();

  // Get integrations to detect platform authorization
  const { accounts } = useIntegrations();

  // Track initial account count for detecting new authorizations
  const initialAccountCountRef = useRef<number | null>(null);

  // Initialize account count on first render
  useEffect(() => {
    if (initialAccountCountRef.current === null) {
      initialAccountCountRef.current = accounts.length;
    }
  }, [accounts]);

  // Detect Tracking creation from chat messages
  useEffect(() => {
    if (
      !onComplete ||
      onCompleteCalledRef.current ||
      !isOnboardingChatPanelOpen ||
      isCompleted
    ) {
      return;
    }

    // Look for assistant messages that indicate successful Tracking creation
    // The AI typically confirms creation with phrases like "created" or "created successfully"
    const hasCreatedTracking = messages.some((msg) => {
      if (msg.role !== "assistant") return false;
      const text = JSON.stringify(msg).toLowerCase();
      return (
        text.includes("创建成功") ||
        text.includes("已创建") ||
        text.includes("created successfully") ||
        text.includes("tracking created") ||
        text.includes("created a tracking") ||
        text.includes("创建完成")
      );
    });

    if (hasCreatedTracking) {
      onCompleteCalledRef.current = true;
      onComplete();
    }
  }, [messages, isOnboardingChatPanelOpen, onComplete, isCompleted]);

  // Detect platform authorization - track when accounts increase
  const prevAccountCountRef = useRef(accounts.length);
  useEffect(() => {
    if (!onComplete || onCompleteCalledRef.current || isCompleted) {
      return;
    }

    // Check if any new account was added
    const hasNewAuthorization = accounts.length > prevAccountCountRef.current;

    if (hasNewAuthorization) {
      prevAccountCountRef.current = accounts.length;
      onCompleteCalledRef.current = true;
      onComplete();
    }
  }, [accounts, onComplete, isCompleted]);

  // TODO: Enable when points reward feature is implemented
  // const points =
  //   step.group === "required" ? 500 : step.group === "recommended" ? 300 : 200;

  /** Authorize platform: open "Sources" dialog and close current small dialog */
  const handleAuthorizePlatform = () => {
    setOpen(false);
    setSourcesDialogOpen(true);
    // Mark step as completed
    if (onComplete && !isCompleted) {
      onComplete();
    }
  };

  /** Chat with AI: close dialog and send "create tracking" message; desktop opens right chat panel, mobile jumps to chat page */
  const handleChatWithAI = () => {
    const messageToSend = t(
      "onboarding.hub.steps.createFirstEvent.createTrackingPrompt",
    );
    setOpen(false);
    // Mark step as completed
    if (onComplete && !isCompleted) {
      onComplete();
    }
    if (isMobile) {
      router.push(`/?page=chat&send=${encodeURIComponent(messageToSend)}`);
      return;
    }
    openSidePanel({
      id: "onboarding-chat-panel",
      content: <ChatSidePanelContent initialInput={messageToSend} />,
      width: 400,
    });
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center gap-0 pt-0 pb-0 pl-0 pr-0 rounded-none bg-transparent min-w-0",
        )}
      >
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-4 md:items-center md:gap-6 rounded-none pt-2 pb-2 pl-2 pr-2 transition-colors hover:bg-primary-50 cursor-pointer",
          )}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <div className="relative z-0 flex min-w-0 flex-1 flex-row items-center gap-1">
            <div
              className={cn(
                "flex-shrink-0 flex items-center justify-center size-8 rounded-lg",
                isCompleted ? "text-primary" : "text-muted-foreground",
              )}
            >
              {isCompleted ? (
                <RemixIcon name="circle_check" size="size-4" filled />
              ) : (
                <RemixIcon name="checkbox_blank" size="size-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  "font-medium text-sm block w-full min-w-0 line-clamp-1 break-words",
                  isCompleted
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {t(step.titleKey)}
              </span>
            </div>
            {/* TODO: Uncomment when points reward feature is implemented
            <div className="flex-shrink-0 flex items-center self-center">
              <Badge
                variant="outline"
                className="text-[11px] h-5 px-2 rounded-full font-medium border-0 bg-accent-50 text-accent-brand"
              >
                {t("onboarding.integration.rewardClaimedBadge", {
                  credits: points,
                })}
              </Badge>
            </div>
            */}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(90vw,560px)] rounded-2xl border border-border bg-card p-0 shadow-lg gap-0">
          <DialogHeader className="px-6 pt-4 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-lg font-semibold">
              {t(step.titleKey)}
            </DialogTitle>
          </DialogHeader>
          <p className="px-8 pt-6 pb-0 text-sm text-muted-foreground">
            {t(
              "onboarding.hub.steps.createFirstEvent.popoverSubtitle",
              "Tell Alloomi what to track — it'll monitor updates and surface what matters.",
            )}
          </p>
          <div className="px-8 pt-6 pb-8">
            <div className="flex flex-row gap-6">
              <Card
                role="button"
                tabIndex={0}
                className={cn(
                  "min-w-0 flex-1 p-0 rounded-lg border border-border bg-card cursor-pointer overflow-hidden shadow-none",
                  "hover:bg-surface-hover hover:border-primary/20 transition-colors",
                  "flex flex-col items-center gap-0 text-center",
                )}
                onClick={handleAuthorizePlatform}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAuthorizePlatform();
                  }
                }}
              >
                <div className="relative flex w-full aspect-[16/9] shrink-0 items-center justify-center rounded-none bg-primary-50 text-primary overflow-hidden">
                  <Image
                    src="/images/onboarding/Auto Track.png"
                    alt={t(
                      "onboarding.hub.steps.createFirstEvent.actionAuthorizePlatform",
                      "Auto-tracking",
                    )}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="mt-auto w-full flex flex-col gap-1 px-4 py-3">
                  <p className="font-serif font-semibold text-sm text-left w-full text-foreground">
                    {t(
                      "onboarding.hub.steps.createFirstEvent.actionAuthorizePlatform",
                      "Auto-tracking",
                    )}
                  </p>
                  <p className="text-xs text-left w-full text-muted-foreground">
                    {t(
                      "onboarding.hub.steps.createFirstEvent.actionAuthorizePlatformDesc",
                      "Connect your accounts and Alloomi will automatically discover content worth tracking",
                    )}
                  </p>
                  <div className="mt-1 w-full flex justify-end">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-primary h-auto p-0 font-medium font-serif"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuthorizePlatform();
                      }}
                    >
                      {t("common.tryIt", "Try it")}
                    </Button>
                  </div>
                </div>
              </Card>
              <Card
                role="button"
                tabIndex={0}
                className={cn(
                  "min-w-0 flex-1 p-0 rounded-lg border border-border bg-card cursor-pointer overflow-hidden shadow-none",
                  "hover:bg-surface-hover hover:border-primary/20 transition-colors",
                  "flex flex-col items-center gap-0 text-center",
                )}
                onClick={handleChatWithAI}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleChatWithAI();
                  }
                }}
              >
                <div className="relative flex w-full aspect-[16/9] shrink-0 items-center justify-center rounded-none bg-primary-50 text-primary overflow-hidden">
                  <Image
                    src="/images/onboarding/Chat with Alloomi.png"
                    alt={t(
                      "onboarding.hub.steps.createFirstEvent.actionChatWithAI",
                      "Chat with Alloomi",
                    )}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="mt-auto w-full flex flex-col gap-1 px-4 py-3">
                  <p className="font-serif font-semibold text-sm text-left w-full text-foreground">
                    {t(
                      "onboarding.hub.steps.createFirstEvent.actionChatWithAI",
                      "Chat with Alloomi",
                    )}
                  </p>
                  <p className="text-xs text-left w-full text-muted-foreground">
                    {t(
                      "onboarding.hub.steps.createFirstEvent.actionChatWithAIDesc",
                      "Use conversation or upload files to let Alloomi understand and create tracking events",
                    )}
                  </p>
                  <div className="mt-1 w-full flex justify-end">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-primary h-auto p-0 font-medium font-serif"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatWithAI();
                      }}
                    >
                      {t("common.tryIt", "Try it")}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sourcesDialogOpen} onOpenChange={setSourcesDialogOpen}>
        <DialogContent
          className="!fixed !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[95vw] sm:!w-[90vw] md:!w-[90vw] md:!max-w-[1000px] lg:!w-[95vw] lg:!max-w-[1200px] !h-[90vh] !max-h-[800px] overflow-hidden flex flex-col p-0 gap-0 !z-[1000] !opacity-100 !visibility-visible rounded-[16px]"
          overlayClassName="!z-[999]"
          hideCloseButton
        >
          <DialogHeader className="px-3 pt-3 pb-4 border-b md:px-6 md:pt-4 gap-0 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-semibold md:text-lg mb-0">
              {t(
                "onboarding.hub.steps.createFirstEvent.actionAuthorizePlatform",
                "Auto-tracking",
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSourcesDialogOpen(false)}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setSourcesDialogOpen(false)}
              >
                <RemixIcon name="check" size="size-3.5" className="mr-1.5" />
                {t("onboarding.hub.stepDone", "Done")}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <PersonalizationLinkedAccounts open={sourcesDialogOpen} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
