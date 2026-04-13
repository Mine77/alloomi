"use client";

import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import type { OnboardingStepConfig } from "./onboarding-config";
import "../../i18n";

interface OnboardingStepCardProps {
  step: OnboardingStepConfig;
  isCompleted: boolean;
  /** Callback when clicking the "Start" button */
  onStart: () => void;
}

/**
 * Individual step card in Onboarding Hub
 * Shows step status (empty radio for incomplete, checkmark for complete), title, and completion status
 */
export function OnboardingStepCard({
  step,
  isCompleted,
  onStart,
}: OnboardingStepCardProps) {
  const { t } = useTranslation();
  // TODO: Enable when points reward feature is implemented
  // const points =
  //   step.group === "required" ? 500 : step.group === "recommended" ? 300 : 200;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-0 pt-0 pb-0 pl-0 pr-0 rounded-none bg-transparent min-w-0",
      )}
    >
      {/* Content area: style consistent with event rows in BriefCategoryBlock */}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-start gap-4 md:items-center md:gap-6 rounded-none pt-2 pb-2 pl-2 pr-2 transition-colors hover:bg-primary-50",
        )}
      >
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "relative z-0 flex min-w-0 flex-1 flex-row items-center gap-1 cursor-pointer",
          )}
          onClick={onStart}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStart();
            }
          }}
        >
          {/* Step status indicator: empty radio for incomplete, checkmark for complete (primary color, no background) */}
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

          {/* Text area: strikethrough when completed */}
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

          {/* Right action area: show points available for current task (accent-brand color, no hover effect) */}
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
  );
}
