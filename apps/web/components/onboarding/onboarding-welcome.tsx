"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "@alloomi/ui";
import { useOnboarding } from "./onboarding-context";
import "../../i18n";

/**
 * Onboarding welcome page
 * Shown when first entering onboarding, jumps to Hub after clicking "Enter Focus"
 */
export function OnboardingWelcome() {
  const { t } = useTranslation();
  const { setCurrentView } = useOnboarding();

  /** Click "Enter Focus": mark welcome page as seen and switch to Hub */
  const handleEnter = () => {
    setCurrentView("hub");
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-8 py-12">
      <div className="flex flex-col items-center gap-6 max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <Image
            src="/images/logo_web.png"
            alt="Alloomi Logo"
            width={64}
            height={64}
            className="rounded-2xl"
            priority
          />
        </div>

        {/* Main title (serif font) */}
        <h1 className="text-2xl font-semibold font-serif tracking-tight text-foreground">
          {t("onboarding.welcome.title", "Welcome to Alloomi")}
        </h1>

        {/* Subtitle: two lines of description */}
        <div className="space-y-3">
          <p className="text-base text-muted-foreground">
            {t(
              "onboarding.welcome.description1",
              "Your proactive AI workspace.",
            )}
          </p>
          <p className="text-base text-muted-foreground">
            {t(
              "onboarding.welcome.description2",
              "Sense signals, coordinate tasks, track results.",
            )}
          </p>
        </div>

        {/* Enter button */}
        <Button
          size="lg"
          className="w-full max-w-xs bg-primary-gradient text-primary-foreground hover:opacity-90 transition-opacity gap-2 mt-2"
          onClick={handleEnter}
        >
          <RemixIcon name="focus_3" size="size-4" />
          {t("onboarding.welcome.continueButton", "Enter focus")}
        </Button>
      </div>
    </div>
  );
}
