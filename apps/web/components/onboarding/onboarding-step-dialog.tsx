"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@alloomi/ui";
import { Button } from "@alloomi/ui";
import { RemixIcon } from "@/components/remix-icon";
import { useOnboarding } from "./onboarding-context";
import type { OnboardingStepConfig } from "./onboarding-config";
import { openUrl } from "@/lib/tauri";
import {
  OnboardingStepDialogProvider,
  useStepDialogBeforeComplete,
} from "./onboarding-step-dialog-context";
import {
  SetupProfileContent,
  ConfigureAlloomiPersonalityContent,
  CreateFirstEventContent,
  FirstChatContent,
  TrackingsByContextContent,
  AlloomiFirstTaskContent,
  LetAlloomiKnowYouCareContent,
  ExploreAgentsContent,
  ExploreLibraryContent,
} from "./onboarding-step-contents";
import "../../i18n";

interface OnboardingStepDialogProps {
  step: OnboardingStepConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Step ID to content component registry */
const STEP_CONTENT_MAP: Record<
  string,
  React.ComponentType<{ onComplete: () => void }>
> = {
  "setup-profile": SetupProfileContent,
  "configure-alloomi-personality": ConfigureAlloomiPersonalityContent,
  "create-first-event": CreateFirstEventContent,
  "tracking-by-context": TrackingsByContextContent,
  "alloomi-first-task": AlloomiFirstTaskContent,
  "let-alloomi-know-you-care": LetAlloomiKnowYouCareContent,
  "first-chat": FirstChatContent,
  "explore-agents": ExploreAgentsContent,
  "explore-library": ExploreLibraryContent,
};

/**
 * Dialog inner: header with cancel/complete buttons, content area
 * Used by non-learnMore groups; learnMore groups use a compact small dialog in the outer layer
 */
function OnboardingStepDialogInner({
  step,
  onOpenChange,
}: {
  step: OnboardingStepConfig;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { completeStep } = useOnboarding();
  const stepDialog = useStepDialogBeforeComplete();

  const StepContent = STEP_CONTENT_MAP[step.id];

  const handleComplete = async () => {
    if (stepDialog?.runBeforeComplete) {
      await stepDialog.runBeforeComplete();
    }
    completeStep(step.id);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader className="px-3 pt-3 pb-4 border-b md:px-6 md:pt-4 gap-0 shrink-0 flex flex-row items-center justify-between">
        <DialogTitle className="text-base font-semibold md:text-lg mb-0">
          {t(step.titleKey)}
        </DialogTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => void handleComplete()}
          >
            <RemixIcon name="check" size="size-3.5" className="mr-1.5" />
            {t("onboarding.hub.stepDone", "Done")}
          </Button>
        </div>
      </DialogHeader>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {StepContent ? (
          <StepContent onComplete={handleComplete} />
        ) : (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            {t("onboarding.hub.stepContentComingSoon", "Content coming soon")}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Onboarding step dialog
 * Opens after clicking "Start" on a step card, embeds the corresponding step content component
 * No footer, cancel/complete on right side of header; no X close button
 */
export function OnboardingStepDialog({
  step,
  open,
  onOpenChange,
}: OnboardingStepDialogProps) {
  const { t } = useTranslation();
  const { completeStep } = useOnboarding();

  // Sub-step state (only used for explore-agents, but hook needs to be called at top level)
  const isExploreAgents = step?.id === "explore-agents";
  const [subStep, setSubStep] = useState<"automation" | "skill">("automation");

  // When dialog reopens or step changes, reset to Automation sub-step
  useEffect(() => {
    if (open && isExploreAgents) {
      setSubStep("automation");
    }
  }, [open, isExploreAgents, step?.id]);

  if (!step) return null;

  // learnMore group: use compact card-style dialog, no outer large container header
  if (step.group === "explore") {
    const handleComplete = () => {
      completeStep(step.id);
      onOpenChange(false);
    };

    const videoSrc = isExploreAgents
      ? subStep === "automation"
        ? "/images/onboarding/automation.mp4"
        : "/images/onboarding/skills.mp4"
      : "/images/onboarding/library.mp4";

    const isFirstChat = step.id === "first-chat";

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(90vw,480px)] rounded-2xl border border-border bg-card p-0 shadow-lg gap-0">
          <DialogTitle className="sr-only">{t(step.titleKey)}</DialogTitle>
          <div className="flex flex-col overflow-hidden">
            {isFirstChat ? (
              <img
                src="/images/onboarding/IM.png"
                alt=""
                className="w-full aspect-video object-cover"
                aria-hidden
              />
            ) : (
              <video
                src={videoSrc}
                className="w-full aspect-video object-cover"
                muted
                autoPlay
                loop
                playsInline
                aria-hidden
              />
            )}
            <div className="px-8 pt-6 pb-6 flex flex-col gap-2">
              <div className="space-y-2">
                <h3 className="text-lg font-serif font-semibold text-foreground">
                  {isExploreAgents
                    ? subStep === "automation"
                      ? t(
                          "onboarding.hub.steps.exploreAgents.learnMoreAutomation",
                          "Learn about Automation",
                        )
                      : t(
                          "onboarding.hub.steps.exploreAgents.learnMoreSkills",
                          "Learn about Skill",
                        )
                    : t(step.titleKey)}
                </h3>
                <p
                  className={
                    isExploreAgents || step.id === "first-chat"
                      ? "text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                      : "text-sm text-muted-foreground leading-relaxed"
                  }
                >
                  {isExploreAgents
                    ? subStep === "automation"
                      ? t(
                          "onboarding.hub.steps.exploreAgents.descAutomation",
                          "In Automation, you manage all your scheduled tasks.\nHand off anything you need to repeat or plan for later to Alloomi — it runs them for you at the time you set.",
                        )
                      : t(
                          "onboarding.hub.steps.exploreAgents.descSkill",
                          "In Skills, you give Alloomi the right abilities for different scenarios.\nThese Skills help it handle specific tasks with better context and more precise execution.",
                        )
                    : t(step.descKey)}
                </p>
                {step.id === "first-chat" && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        openUrl(
                          "https://alloomi.ai/docs/alloomi/messaging-apps",
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          openUrl(
                            "https://alloomi.ai/docs/alloomi/messaging-apps",
                          );
                        }
                      }}
                      className="underline underline-offset-4 hover:text-primary cursor-pointer"
                    >
                      {t("onboarding.hub.learnMore.link", "Learn more →")}
                    </span>
                  </p>
                )}
                {step.id === "explore-agents" && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        openUrl(
                          subStep === "automation"
                            ? "https://alloomi.ai/docs/alloomi/automation"
                            : "https://alloomi.ai/docs/alloomi/skills",
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          openUrl(
                            subStep === "automation"
                              ? "https://alloomi.ai/docs/alloomi/automation"
                              : "https://alloomi.ai/docs/alloomi/skills",
                          );
                        }
                      }}
                      className="underline underline-offset-4 hover:text-primary cursor-pointer"
                    >
                      {t("onboarding.hub.learnMore.link", "Learn more →")}
                    </span>
                  </p>
                )}
                {step.id === "explore-library" && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        openUrl("https://alloomi.ai/docs/alloomi/library")
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          openUrl("https://alloomi.ai/docs/alloomi/library");
                        }
                      }}
                      className="underline underline-offset-4 hover:text-primary cursor-pointer"
                    >
                      {t("onboarding.hub.learnMore.link", "Learn more →")}
                    </span>
                  </p>
                )}
              </div>
              {isExploreAgents ? (
                <div className="mt-3 flex justify-end gap-2">
                  {subStep === "automation" ? (
                    <Button
                      size="sm"
                      className="min-w-[92px] bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setSubStep("skill")}
                    >
                      {t("onboarding.hub.steps.exploreAgents.next", "Next")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubStep("automation")}
                        className="gap-1.5"
                      >
                        <RemixIcon name="arrow_left" size="size-3.5" />
                        {t(
                          "onboarding.hub.steps.exploreAgents.previous",
                          "Previous",
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="min-w-[92px] bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={handleComplete}
                      >
                        {t("onboarding.hub.learnMore.gotIt")}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    className="min-w-[92px] bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleComplete}
                  >
                    {t("onboarding.hub.learnMore.gotIt")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <OnboardingStepDialogProvider>
        <DialogContent
          className="!fixed !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[95vw] sm:!w-[90vw] md:!w-[90vw] md:!max-w-[1000px] lg:!w-[95vw] lg:!max-w-[1200px] !h-[90vh] !max-h-[800px] overflow-hidden flex flex-col p-0 gap-0 !z-[1000] !opacity-100 !visibility-visible rounded-[16px]"
          overlayClassName="!z-[999]"
          hideCloseButton
        >
          <OnboardingStepDialogInner step={step} onOpenChange={onOpenChange} />
        </DialogContent>
      </OnboardingStepDialogProvider>
    </Dialog>
  );
}
