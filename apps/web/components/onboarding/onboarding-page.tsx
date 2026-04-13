"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentSectionHeader } from "@/components/agent/section-header";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "@alloomi/ui";
import { toast } from "@/components/toast";
import { useOnboarding } from "./onboarding-context";
import {
  AvatarDisplay,
  getAvatarConfigByState,
} from "@/components/agent-avatar";
import { OnboardingWelcome } from "./onboarding-welcome";
import { OnboardingHub } from "./onboarding-hub";
import "../../i18n";

/**
 * Dev environment reset onboarding state for repeated testing
 */
function useDebugResetOnboarding() {
  return () => {
    if (typeof window === "undefined") return;
    const anyWindow = window as typeof window & {
      alloomiDebugResetOnboarding?: () => void;
    };
    if (anyWindow.alloomiDebugResetOnboarding) {
      anyWindow.alloomiDebugResetOnboarding();
      return;
    }
    localStorage.removeItem("alloomi_onboarding_steps");
    window.location.reload();
  };
}

/**
 * Onboarding page component
 * Renders as a full page panel, visually consistent with Brief, Workspace, etc.
 * Replaces normal page content when opened by SidePanelShell
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const { currentView, canFinish, finishOnboarding, closeOnboarding } =
    useOnboarding();
  const [isFinishing, setIsFinishing] = useState(false);
  /** Controls bottom prompt card visibility after completing "Start now" steps */
  const [showFinishAlert, setShowFinishAlert] = useState(false);
  const handleDebugReset = useDebugResetOnboarding();

  const isWelcomeView = currentView === "welcome";

  /**
   * Show bottom completion prompt card after user completes all steps in "Start now" group
   */
  useEffect(() => {
    if (canFinish) {
      setShowFinishAlert(true);
    }
  }, [canFinish]);

  /**
   * Dev environment close onboarding panel for quick return to normal page
   */
  const handleDebugClose = () => {
    closeOnboarding();
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await finishOnboarding();
    } catch {
      toast({
        type: "error",
        description: t(
          "onboarding.hub.finishError",
          "Failed to complete onboarding, please retry",
        ),
      });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Welcome view: no header, full-height centered layout */}
      {isWelcomeView ? (
        <OnboardingWelcome />
      ) : (
        <>
          {/* Hub view: title + right-side action buttons */}
          <AgentSectionHeader title={t("onboarding.hub.title", "Meet Alloomi")}>
            {/* Right of title: complete guide + reset (dev) */}
            {canFinish && (
              <Button
                className="bg-primary-gradient text-primary-foreground hover:opacity-90 transition-opacity gap-2"
                onClick={handleFinish}
                disabled={isFinishing}
              >
                {isFinishing ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    {t("onboarding.hub.finishing", "Finishing up...")}
                  </>
                ) : (
                  <>
                    <RemixIcon name="check_double" size="size-4" />
                    {t("onboarding.hub.finishButton", "Enter Alloomi")}
                  </>
                )}
              </Button>
            )}
            {process.env.NODE_ENV !== "production" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleDebugReset}
                >
                  {t("onboarding.hub.debugReset", "reset(dev)")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleDebugClose}
                >
                  {t("onboarding.hub.debugClose", "close onboarding(dev)")}
                </Button>
              </>
            )}
          </AgentSectionHeader>

          {/* Hub content: groups and step list */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <OnboardingHub />
          </div>

          {/* Bottom prompt card shown after completing "Start now" */}
          {canFinish && showFinishAlert && (
            <div className="shrink-0 px-4 pb-4 pt-1">
              <div
                className="flex items-start justify-between gap-3 px-4 py-[15px] rounded-2xl border border-border"
                style={{
                  background:
                    "linear-gradient(45deg, rgba(253, 246, 239, 1) 0%, rgba(241, 245, 249, 0.6) 100%)",
                }}
              >
                <div className="flex items-start justify-start gap-3 w-full">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm font-semibold font-serif text-foreground">
                      {t(
                        "onboarding.hub.finishAlertTitle",
                        "Basic setup complete!",
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      {t(
                        "onboarding.hub.finishAlertDescription",
                        "You can now enter Alloomi, or continue with the steps below.\nWant to come back later? Onboarding is always available in the bottom menu.",
                      )}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <AvatarDisplay
                      config={getAvatarConfigByState()}
                      className="w-[120px] h-[120px]"
                      enableInteractions={true}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFinishAlert(false)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                      aria-label={t("common.close", "Close")}
                    >
                      <RemixIcon name="close" size="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
