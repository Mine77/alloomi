"use client";

/**
 * Dialog for "Let Alloomi help you with your first task" step
 * Consistent with Learn about Agents: top aspect-video image carousel (left/right arrows on image sides),
 * current card title and description below, "Try it" button in bottom-right fills current prompt into right chat panel.
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { RemixIcon } from "@/components/remix-icon";
import { Button, Dialog, DialogContent, DialogTitle } from "@alloomi/ui";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@alloomi/hooks/use-is-mobile";
import { useSidePanel } from "@/components/agent/side-panel-context";
import { AgentChatPanel } from "@/components/agent/chat-panel";
import { useChatContext } from "@/components/chat-context";
import type { OnboardingStepConfig } from "./onboarding-config";
import "../../i18n";

const TOTAL_CARDS = 8;

interface AlloomiFirstTaskPopoverProps {
  step: OnboardingStepConfig;
  isCompleted: boolean;
  onComplete?: () => void;
}

const CARD_IMAGES: string[] = [
  "/images/onboarding/Draft a Message.png",
  "/images/onboarding/Co-create with Alloomi.png",
  "/images/onboarding/Break It Down.png",
  "/images/onboarding/Plan Your Content.png",
  "/images/onboarding/Spark Marketing Ideas.png",
  "/images/onboarding/Build a Deck.png",
  "/images/onboarding/AI News Brief.png",
  "/images/onboarding/New to Alloomi.png",
];

/** Right-side Chat panel content: AgentChatPanel with title and close button, supports prefill input */
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

/**
 * Configuration for rendering individual task cards (i18n key suffix)
 */
function getCardKeys(index: number) {
  const n = index + 1;
  return {
    titleKey: `onboarding.hub.steps.alloomiFirstTask.action${n}Title` as const,
    descKey: `onboarding.hub.steps.alloomiFirstTask.action${n}Desc` as const,
    promptKey:
      `onboarding.hub.steps.alloomiFirstTask.action${n}Prompt` as const,
  };
}

/**
 * Open right chat panel and fill in preset text; mobile jumps to chat page with send param.
 * Desktop first switches to a new chatId, then prefills prompt in input (does not auto-send).
 */
function openChatWithPreset(
  messageToSend: string,
  isMobile: boolean,
  router: ReturnType<typeof useRouter>,
  openSidePanel: ReturnType<typeof useSidePanel>["openSidePanel"],
  switchChatId: ReturnType<typeof useChatContext>["switchChatId"],
) {
  if (isMobile) {
    router.push(`/?page=chat&send=${encodeURIComponent(messageToSend)}`);
    return;
  }
  // Desktop: switch to a brand new chat first
  switchChatId(null);
  openSidePanel({
    id: "onboarding-first-task-chat-panel",
    content: <ChatSidePanelContent initialInput={messageToSend} />,
    width: 400,
  });
}

export function AlloomiFirstTaskPopover({
  step,
  isCompleted,
  onComplete,
}: AlloomiFirstTaskPopoverProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { openSidePanel } = useSidePanel();
  const { switchChatId } = useChatContext();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const goToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_CARDS - 1, index));
    setActiveIndex(clamped);
  }, []);

  const goPrev = useCallback(() => {
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex]);

  const goNext = useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  /** Click Try it: fill current card's prompt into right chat panel and close dialog */
  const handleTryIt = () => {
    const { promptKey } = getCardKeys(activeIndex);
    const messageToSend = t(promptKey);
    setOpen(false);
    openChatWithPreset(
      messageToSend,
      isMobile,
      router,
      openSidePanel,
      switchChatId,
    );
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
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(90vw,480px)] rounded-2xl border border-border bg-card p-0 shadow-lg gap-0">
          <DialogTitle className="sr-only">{t(step.titleKey)}</DialogTitle>
          <div className="flex flex-col overflow-hidden">
            {/* Top: image fills aspect-video, left/right arrows overlaid on image */}
            <div className="w-full aspect-video relative overflow-hidden">
              <div className="absolute inset-0">
                <Image
                  src={CARD_IMAGES[activeIndex]}
                  alt={t(getCardKeys(activeIndex).titleKey)}
                  fill
                  className="object-cover"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 shrink-0 text-primary hover:text-primary hover:bg-primary/20 disabled:opacity-30 rounded-full"
                onClick={goPrev}
                disabled={activeIndex === 0}
                aria-label={t("common.prev", "Previous")}
              >
                <RemixIcon name="chevron_left" size="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 shrink-0 text-primary hover:text-primary hover:bg-primary/20 disabled:opacity-30 rounded-full"
                onClick={goNext}
                disabled={activeIndex === TOTAL_CARDS - 1}
                aria-label={t("common.next", "Next")}
              >
                <RemixIcon name="chevron_right" size="size-5" />
              </Button>
            </div>
            {/* Dot indicator: right below image */}
            <div className="flex justify-center gap-1.5 py-2">
              {Array.from({ length: TOTAL_CARDS }, (_, i) => `dot-${i}`).map(
                (dotId, index) => (
                  <button
                    key={dotId}
                    type="button"
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      activeIndex === index
                        ? "w-4 bg-primary"
                        : "w-1.5 bg-border/60",
                    )}
                    aria-label={t("common.paginationDot", {
                      defaultValue: "Go to item {{index}}",
                      index: index + 1,
                    })}
                    onClick={() => goToIndex(index)}
                  />
                ),
              )}
            </div>
            {/* Consistent with Learn about Agents: title, description, bottom-right button */}
            <div className="px-8 pt-6 pb-6 flex flex-col gap-2">
              <div className="space-y-2">
                <h3 className="text-lg font-serif font-semibold text-foreground">
                  {t(getCardKeys(activeIndex).titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(getCardKeys(activeIndex).descKey)}
                </p>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  className="min-w-[92px] bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleTryIt}
                >
                  {t("onboarding.hub.steps.alloomiFirstTask.tryIt", "Try it")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
