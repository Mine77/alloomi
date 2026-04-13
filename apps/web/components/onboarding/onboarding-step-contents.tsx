"use client";

/**
 * Onboarding step dialog content components
 * Each exported component corresponds to one step ID content in onboarding-config.ts
 * Reuses components with personalization dialog content, ensuring changes sync in both places; embedded layout can be reused for future steps
 */

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "@alloomi/ui";
import { useStepDialogBeforeComplete } from "./onboarding-step-dialog-context";
import { openUrl } from "@/lib/tauri";
import {
  PersonalizationRoleSettings,
  type PersonalizationRoleSettingsRef,
} from "@/components/personalization/personalization-role-settings";
import {
  PersonalizationBasicSettings,
  type PersonalizationBasicSettingsRef,
} from "@/components/personalization/personalization-basic-settings";
import { PersonalizationContextsSettings } from "@/components/personalization/personalization-contexts-settings";
import {
  PersonalizationInterestsSettings,
  type PersonalizationInterestsSettingsRef,
} from "@/components/personalization/personalization-interests-settings";
import "../../i18n";

interface StepContentProps {
  onComplete: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: embedded personalization content + complete button (reusable in future steps like contexts, people, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Common layout for embedding personalization panels in Onboarding step dialogs (no footer, complete/cancel in dialog header)
 * Content uses the same component as the corresponding tab in personalization dialog, same data source, changes sync immediately
 */
function OnboardingEmbeddedPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Required experience
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step: Set up profile
 * Uses the same content as "My Description" in personalization dialog (PersonalizationRoleSettings), same data source, changes sync immediately
 * Registers save via step-dialog context before completion, triggered by dialog header complete button
 */
export function SetupProfileContent({
  onComplete: _onComplete,
}: StepContentProps) {
  const roleSettingsRef = useRef<PersonalizationRoleSettingsRef>(null);
  const stepDialog = useStepDialogBeforeComplete();

  useEffect(() => {
    if (!stepDialog) return;
    stepDialog.registerBeforeComplete(async () => {
      await roleSettingsRef.current?.save();
    });
    return () => {
      stepDialog.registerBeforeComplete(null);
    };
  }, [stepDialog]);

  return (
    <OnboardingEmbeddedPanel>
      <PersonalizationRoleSettings open={true} ref={roleSettingsRef} />
    </OnboardingEmbeddedPanel>
  );
}

/**
 * Step: Auto-categorize tracking events by context
 * Uses the same content as "My Contexts" in personalization dialog (PersonalizationContextsSettings), same data source, changes sync immediately
 * Implementation logic reference: Help Alloomi Know You step (SetupProfileContent / ConfigureAlloomiPersonalityContent)
 */
export function TrackingsByContextContent({
  onComplete: _onComplete,
}: StepContentProps) {
  return (
    <OnboardingEmbeddedPanel>
      <PersonalizationContextsSettings />
    </OnboardingEmbeddedPanel>
  );
}

/**
 * Step: Configure your Alloomi personality
 * Uses the same content as "Basic Settings" in personalization dialog (PersonalizationBasicSettings), same data source, changes sync immediately
 * Registers save via step-dialog context before completion, triggered by dialog header complete button
 */
export function ConfigureAlloomiPersonalityContent({
  onComplete: _onComplete,
}: StepContentProps) {
  const basicSettingsRef = useRef<PersonalizationBasicSettingsRef>(null);
  const stepDialog = useStepDialogBeforeComplete();

  useEffect(() => {
    if (!stepDialog) return;
    stepDialog.registerBeforeComplete(async () => {
      await basicSettingsRef.current?.save();
    });
    return () => {
      stepDialog.registerBeforeComplete(null);
    };
  }, [stepDialog]);

  return (
    <OnboardingEmbeddedPanel>
      <PersonalizationBasicSettings open={true} ref={basicSettingsRef} />
    </OnboardingEmbeddedPanel>
  );
}

/**
 * Step: Create your first tracking event
 */
export function CreateFirstEventContent({ onComplete }: StepContentProps) {
  return (
    <SimpleGuideContent
      icon="calendar"
      titleKey="onboarding.hub.steps.createFirstEvent.guideTitle"
      bulletKeys={[
        "onboarding.hub.steps.createFirstEvent.bullet1",
        "onboarding.hub.steps.createFirstEvent.bullet2",
        "onboarding.hub.steps.createFirstEvent.bullet3",
      ]}
      onComplete={onComplete}
    />
  );
}

/**
 * Step: Let Alloomi help you with your first task
 */
export function AlloomiFirstTaskContent({ onComplete }: StepContentProps) {
  return (
    <SimpleGuideContent
      icon="list_checks"
      titleKey="onboarding.hub.steps.alloomiFirstTask.guideTitle"
      bulletKeys={[
        "onboarding.hub.steps.alloomiFirstTask.bullet1",
        "onboarding.hub.steps.alloomiFirstTask.bullet2",
        "onboarding.hub.steps.alloomiFirstTask.bullet3",
      ]}
      onComplete={onComplete}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommended & Explore (simple guide-type content)

interface SimpleGuideContentProps extends StepContentProps {
  icon: string;
  titleKey: string;
  bulletKeys: string[];
}

/**
 * Simple guide step content (common style for explore/guide-type steps)
 */
function SimpleGuideContent({
  icon,
  titleKey,
  bulletKeys,
  onComplete,
}: SimpleGuideContentProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary">
          <RemixIcon name={icon} size="size-8" />
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <h3 className="text-xl font-semibold text-foreground">
            {t(titleKey)}
          </h3>
          <ul className="space-y-3 text-left">
            {bulletKeys.map((key) => (
              <li
                key={key}
                className="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <RemixIcon
                  name="check_line"
                  size="size-4"
                  className="mt-0.5 text-success flex-shrink-0"
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-4">
        <Button
          className="w-full bg-primary-gradient text-primary-foreground hover:opacity-90"
          onClick={onComplete}
        >
          {t("onboarding.hub.stepGotIt", "Got it, mark as done")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Step: Let Alloomi know what you care about
 * Uses the same single-page component as "My Interests" in personalization dialog (People + Topics), same data source, changes sync immediately
 * Registers save via step-dialog context before completion, triggered by dialog header complete button
 */
export function LetAlloomiKnowYouCareContent({
  onComplete: _onComplete,
}: StepContentProps) {
  const interestsRef = useRef<PersonalizationInterestsSettingsRef>(null);
  const stepDialog = useStepDialogBeforeComplete();

  useEffect(() => {
    if (!stepDialog) return;
    stepDialog.registerBeforeComplete(async () => {
      await interestsRef.current?.save();
    });
    return () => {
      stepDialog.registerBeforeComplete(null);
    };
  }, [stepDialog]);

  return (
    <OnboardingEmbeddedPanel>
      <PersonalizationInterestsSettings open={true} ref={interestsRef} />
    </OnboardingEmbeddedPanel>
  );
}

/** Step: Start your first conversation (chat with Alloomi via messaging apps) */
export function FirstChatContent({ onComplete }: StepContentProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith("zh");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary">
          <RemixIcon name="chat_ai" size="size-8" />
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <h3 className="text-xl font-semibold text-foreground">
            {t("onboarding.hub.steps.firstChat.guideTitle")}
          </h3>
          <ul className="space-y-3 text-left">
            {[
              "onboarding.hub.steps.firstChat.bullet1",
              "onboarding.hub.steps.firstChat.bullet2",
              "onboarding.hub.steps.firstChat.bullet3",
              "onboarding.hub.steps.firstChat.bullet4",
            ].map((key) => (
              <li
                key={key}
                className="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <RemixIcon
                  name="check_line"
                  size="size-4"
                  className="mt-0.5 text-success flex-shrink-0"
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span
              role="button"
              tabIndex={0}
              onClick={() =>
                openUrl("https://alloomi.ai/docs/alloomi/messaging-apps")
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  openUrl("https://alloomi.ai/docs/alloomi/messaging-apps");
                }
              }}
              className="underline underline-offset-4 hover:text-primary cursor-pointer"
            >
              {isZh ? "了解如何接入 →" : "Learn how to connect →"}
            </span>
          </p>
        </div>
      </div>
      <div className="border-t border-border px-6 py-4">
        <Button
          className="w-full bg-primary-gradient text-primary-foreground hover:opacity-90"
          onClick={onComplete}
        >
          {t("onboarding.hub.stepGotIt", "Got it, mark as done")}
        </Button>
      </div>
    </div>
  );
}

/** Step: Explore Agents */
export function ExploreAgentsContent({ onComplete }: StepContentProps) {
  return (
    <SimpleGuideContent
      icon="robot_2"
      titleKey="onboarding.hub.steps.exploreAgents.guideTitle"
      bulletKeys={[
        "onboarding.hub.steps.exploreAgents.bullet1",
        "onboarding.hub.steps.exploreAgents.bullet2",
        "onboarding.hub.steps.exploreAgents.bullet3",
        "onboarding.hub.steps.exploreAgents.bullet4",
      ]}
      onComplete={onComplete}
    />
  );
}

/** Step: Explore Library */
export function ExploreLibraryContent({ onComplete }: StepContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary">
          <RemixIcon name="book_open" size="size-8" />
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <h3 className="text-xl font-semibold text-foreground">
            {t("onboarding.hub.steps.exploreLibrary.guideTitle")}
          </h3>
          <ul className="space-y-3 text-left">
            {[
              "onboarding.hub.steps.exploreLibrary.bullet1",
              "onboarding.hub.steps.exploreLibrary.bullet2",
              "onboarding.hub.steps.exploreLibrary.bullet3",
            ].map((key) => (
              <li
                key={key}
                className="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <RemixIcon
                  name="check_line"
                  size="size-4"
                  className="mt-0.5 text-success flex-shrink-0"
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span
              role="button"
              tabIndex={0}
              onClick={() => openUrl("https://alloomi.ai/docs/alloomi/library")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  openUrl("https://alloomi.ai/docs/alloomi/library");
                }
              }}
              className="underline underline-offset-4 hover:text-primary cursor-pointer"
            >
              {t("onboarding.hub.steps.exploreLibrary.learnMoreLibrary")}
            </span>
          </p>
        </div>
      </div>
      <div className="border-t border-border px-6 py-4">
        <Button
          className="w-full bg-primary-gradient text-primary-foreground hover:opacity-90"
          onClick={onComplete}
        >
          {t("onboarding.hub.stepGotIt", "Got it, mark as done")}
        </Button>
      </div>
    </div>
  );
}
