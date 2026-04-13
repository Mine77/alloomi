"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@alloomi/ui";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";

/**
 * Onboarding step layout component props
 */
interface OnboardingStepLayoutProps {
  /** Title */
  title: string;
  /** Extra tag on right of title (optional) */
  titleTag?: ReactNode;
  /** Subtitle (optional) */
  subtitle?: string;
  /** Main content area */
  children: ReactNode;
  /** Whether to show back button */
  showBack?: boolean;
  /** Back button handler */
  onBack?: () => void;
  /** Next/Complete button text */
  actionButtonText: string;
  /** Next/Complete button handler */
  onAction: () => void;
  /** Whether next/complete button is disabled */
  actionButtonDisabled?: boolean;
  /** Whether submitting (show loading state) */
  isSubmitting?: boolean;
  /** Custom submitting text */
  submittingText?: string;
  /** Custom content area class name */
  contentClassName?: string;
  /** Skip button text (optional) */
  skipButtonText?: string;
  /** Skip button handler (optional) */
  onSkip?: () => void;
  /** Custom back button text (optional) */
  backButtonText?: string;
  /** Custom button variant (optional) */
  actionButtonVariant?:
    | "default"
    | "magic-primary"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive"
    | "brand"
    | "magic-secondary";
  /** Custom button icon (optional) */
  actionButtonIcon?: ReactNode;
}

/**
 * Onboarding step unified layout component
 * Provides consistent top header, middle content area, and bottom button area layout
 */
export function OnboardingStepLayout({
  title,
  titleTag,
  subtitle,
  children,
  showBack = true,
  onBack,
  actionButtonText,
  onAction,
  actionButtonDisabled = false,
  isSubmitting = false,
  submittingText,
  contentClassName,
  skipButtonText,
  onSkip,
  backButtonText,
  actionButtonVariant,
  actionButtonIcon,
}: OnboardingStepLayoutProps) {
  const { t } = useTranslation();
  const resolvedBackButtonText =
    backButtonText ??
    t("onboarding.common.back", { defaultValue: t("common.back") });

  return (
    <div className="w-full mx-auto flex h-full flex-col justify-start items-center">
      {/* Top Header */}
      <div className="text-center space-y-2 mb-8">
        <h2 className="flex items-center justify-center gap-3 text-2xl font-semibold md:text-3xl">
          <span>{title}</span>
          {titleTag}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground text-base md:text-lg whitespace-pre-line">
            {subtitle}
          </p>
        )}
      </div>

      {/* Main content area */}
      <div
        className={cn("flex-1 overflow-y-auto w-full h-full", contentClassName)}
      >
        {children}
      </div>

      {/* Bottom button area */}
      <div className="mt-auto !pt-12 w-full flex items-center justify-between">
        {showBack && onBack ? (
          <Button variant="outline" onClick={onBack} className="h-12 px-4">
            <RemixIcon name="chevron_left" size="size-4" className="mr-2" />
            {resolvedBackButtonText}
          </Button>
        ) : onSkip && skipButtonText ? (
          <Button variant="outline" onClick={onSkip} className="h-12 px-6">
            {skipButtonText}
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={onAction}
          disabled={actionButtonDisabled || isSubmitting}
          variant={actionButtonVariant}
          className="h-12 px-6"
        >
          {isSubmitting ? (
            <>
              <span className="mr-2 inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
              {submittingText ?? t("survey.buttons.submitting")}
            </>
          ) : (
            <>
              {actionButtonIcon}
              {actionButtonText}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
