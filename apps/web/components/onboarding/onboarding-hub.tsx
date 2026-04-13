"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { useOnboarding } from "./onboarding-context";
import {
  ONBOARDING_STEPS,
  ONBOARDING_GROUPS,
  type OnboardingGroup,
  type OnboardingStepConfig,
} from "./onboarding-config";
import { OnboardingStepCard } from "./onboarding-step-card";
import { CreateFirstEventPopover } from "./create-first-event-popover";
import { AlloomiFirstTaskPopover } from "./alloomi-first-task-popover";
import { OnboardingStepDialog } from "./onboarding-step-dialog";
import "../../i18n";

/**
 * Onboarding Hub main interface
 * Displays three groups of step lists, users click cards to start each step, progress updates after completion
 */
export function OnboardingHub() {
  const { t } = useTranslation();
  const { completedSteps, canFinish } = useOnboarding();

  /** Currently open step dialog */
  const [activeStep, setActiveStep] = useState<OnboardingStepConfig | null>(
    null,
  );
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);

  /** Open step dialog */
  const handleStartStep = (step: OnboardingStepConfig) => {
    setActiveStep(step);
    setIsStepDialogOpen(true);
  };

  /** Only show Experience Alloomi, Learn more sections after completing all "Start now" steps */
  const visibleGroups = canFinish
    ? ONBOARDING_GROUPS
    : ONBOARDING_GROUPS.filter((g) => g.id === "required");

  return (
    <div className="flex flex-col h-full">
      {/* Prompt card shown above list when "Start now" is incomplete; disappears after completion */}
      {!canFinish && (
        <div className="shrink-0 px-4 pb-3 pt-0">
          <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-2xl border border-border bg-primary-50">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold font-serif text-foreground">
                {t("onboarding.hub.startHereFirstTitle", "Start here")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "onboarding.hub.startHereFirstDescription",
                  "Take 2 minutes to complete these 3 steps and Alloomi will understand you better.",
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Group content area (scrollable) */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-0 mt-2">
        {visibleGroups.map((group, groupIdx) => {
          const groupSteps = ONBOARDING_STEPS.filter(
            (s) => s.group === group.id,
          );
          const groupCompleted = groupSteps.filter((s) =>
            completedSteps.includes(s.id),
          ).length;
          const isGroupDone = groupCompleted === groupSteps.length;

          return (
            <GroupSection
              key={group.id}
              group={group.id}
              titleKey={group.titleKey}
              steps={groupSteps}
              completedSteps={completedSteps}
              groupCompleted={groupCompleted}
              isGroupDone={isGroupDone}
              isFirst={groupIdx === 0}
              onStartStep={handleStartStep}
            />
          );
        })}
      </div>

      {/* Step dialog */}
      <OnboardingStepDialog
        step={activeStep}
        open={isStepDialogOpen}
        onOpenChange={setIsStepDialogOpen}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: OnboardingGroup;
  titleKey: string;
  steps: OnboardingStepConfig[];
  completedSteps: string[];
  groupCompleted: number;
  isGroupDone: boolean;
  isFirst: boolean;
  onStartStep: (step: OnboardingStepConfig) => void;
}

/**
 * Single group section: title + progress badge + step card list
 */
function GroupSection({
  titleKey,
  group,
  steps,
  completedSteps,
  groupCompleted,
  isGroupDone,
  isFirst,
  onStartStep,
}: GroupSectionProps) {
  const { t } = useTranslation();
  const { completeStep } = useOnboarding();
  const GROUP_ICONS: Record<OnboardingGroup, string> = {
    required: "rocket_2",
    recommended: "magic",
    explore: "compass_3",
  };
  // Background colors consistent with InsightBadge focusGroup
  const GROUP_BG_CLASSES: Record<OnboardingGroup, string> = {
    required: "bg-red-50 hover:bg-red-50",
    recommended: "bg-yellow-50 hover:bg-yellow-50",
    explore: "bg-[var(--primary-50)] hover:bg-[var(--primary-50)]",
  };

  return (
    <div className={cn("px-4", !isFirst && "mt-6")}>
      {/* Group title row */}
      <div
        className="flex items-center gap-2 px-2 mb-2"
        style={{ marginBottom: "8px" }}
      >
        <div
          className={cn(
            "inline-flex items-center justify-start gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium shrink-0 text-foreground border-border",
            GROUP_BG_CLASSES[group],
          )}
        >
          <RemixIcon
            name={GROUP_ICONS[group]}
            size="size-4"
            filled
            className="text-foreground"
          />
          <span>{t(titleKey)}</span>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {isGroupDone ? (
            <span className="flex items-center gap-1 text-success">
              <RemixIcon name="check_line" size="size-3.5" />
              {t("onboarding.hub.groupAllDone", "All done")}
            </span>
          ) : (
            <span>
              {groupCompleted}/{steps.length}
            </span>
          )}
        </span>
      </div>

      {/* Step card list: Create first tracking / Let Alloomi do first thing open small popover (card style), others open large dialog */}
      <div className="mt-0 space-y-0">
        {steps.map((step) =>
          step.id === "create-first-event" ? (
            <CreateFirstEventPopover
              key={step.id}
              step={step}
              isCompleted={completedSteps.includes(step.id)}
              onComplete={() => completeStep(step.id)}
            />
          ) : step.id === "alloomi-first-task" ? (
            <AlloomiFirstTaskPopover
              key={step.id}
              step={step}
              isCompleted={completedSteps.includes(step.id)}
              onComplete={() => completeStep(step.id)}
            />
          ) : (
            <OnboardingStepCard
              key={step.id}
              step={step}
              isCompleted={completedSteps.includes(step.id)}
              onStart={() => onStartStep(step)}
            />
          ),
        )}
      </div>
    </div>
  );
}
