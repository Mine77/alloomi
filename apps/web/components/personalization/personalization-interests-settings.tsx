"use client";

/**
 * "My Interests" unified page
 * Single page contains both "People I follow" and "Topics I follow" sections, one request, unified layout and save
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { TagEditor } from "./personalization-tag-editor";
import { fetcher } from "@/lib/utils";
import { toast } from "@/components/toast";

type InsightPreferencesResponse = {
  focusPeople: string[];
  focusTopics: string[];
  language: string;
  refreshIntervalMinutes: number;
  lastUpdated: string;
};

type InsightPreferencesPayload = {
  focusPeople: string[];
  focusTopics: string[];
  language: string;
  refreshIntervalMinutes: number;
};

/**
 * Fetch "My Interests" preferences (People + Topics share the same source)
 */
function useInterestsPreferences() {
  const { data, isLoading, mutate, error } = useSWR<InsightPreferencesResponse>(
    "/api/preferences/insight",
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: true,
      dedupingInterval: 5000,
    },
  );

  if (error) {
    console.error("[Interests Preferences] Fetch failed", error);
  }

  return { data, isLoading, mutate };
}

export interface PersonalizationInterestsSettingsProps {
  /** Whether to display */
  open: boolean;
  /** When true, omit top description and outer padding (e.g. About me page with shared scroll padding) */
  hideDescription?: boolean;
}

export interface PersonalizationInterestsSettingsRef {
  /** Save settings (People + Topics persisted together) */
  save: () => Promise<void>;
  /** Whether currently saving */
  isSaving: boolean;
}

/**
 * "My Interests" single-page component
 * Top section: People I follow; Bottom section: Topics I follow (with template cards), same data source, same save logic
 */
export const PersonalizationInterestsSettings = forwardRef<
  PersonalizationInterestsSettingsRef,
  PersonalizationInterestsSettingsProps
>(({ open: _open, hideDescription = false }, ref) => {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useInterestsPreferences();

  const [focusPeople, setFocusPeople] = useState<string[]>([]);
  const [focusTopics, setFocusTopics] = useState<string[]>([]);
  const [topicsInputValue, setTopicsInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  /** Whether template card area is expanded, defaults to expanded */
  const [templatesExpanded, setTemplatesExpanded] = useState(true);

  useEffect(() => {
    if (data) {
      setFocusPeople(data.focusPeople ?? []);
      setFocusTopics(data.focusTopics ?? []);
      setHasHydrated(true);
    }
  }, [data]);

  /**
   * Unified persistence: can update only people or topics, unspecified uses current state; also syncs memory
   */
  const persist = useCallback(
    async (updates: { focusPeople?: string[]; focusTopics?: string[] }) => {
      if (!hasHydrated) return;
      setIsSaving(true);
      const nextPeople = updates.focusPeople ?? focusPeople;
      const nextTopics = updates.focusTopics ?? focusTopics;
      const payload: InsightPreferencesPayload = {
        focusPeople: nextPeople,
        focusTopics: nextTopics,
        language: data?.language ?? "",
        refreshIntervalMinutes: data?.refreshIntervalMinutes ?? 30,
      };

      try {
        const response = await fetch("/api/preferences/insight", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await response.text());
        const next = (await response.json()) as InsightPreferencesResponse;
        await mutate(next, { revalidate: false });
      } catch (err) {
        console.error("[Interests Preferences] Update failed", err);
        toast({
          type: "error",
          description: t("insightPreferences.toast.failure"),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [data, hasHydrated, mutate, t, focusPeople, focusTopics],
  );

  const handlePeopleChange = useCallback(
    (next: string[]) => {
      setFocusPeople(next);
      void persist({ focusPeople: next });
    },
    [persist],
  );

  const handleTopicsChange = useCallback(
    (next: string[]) => {
      setFocusTopics(next);
      void persist({ focusTopics: next });
    },
    [persist],
  );

  const handleSave = useCallback(async () => {
    await persist({});
  }, [persist]);

  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  const templates = useMemo(() => {
    const keys = [
      "followPeople",
      "projectProgress",
      "pendingTasks",
      "hotTopics",
      "toolNotifications",
      "teamAssignments",
      "feedbackSummary",
      "teamAchievements",
    ] as const;
    return keys.map((key) => ({
      key,
      title: t(`onboarding.painPoints.templates.cards.${key}.title`),
      template: t(`onboarding.painPoints.templates.cards.${key}.template`),
      example: t(`onboarding.painPoints.templates.cards.${key}.example`),
    }));
  }, [t]);

  const handleTemplateClick = useCallback((template: string) => {
    setTopicsInputValue(template);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RemixIcon
          name="loader_2"
          size="size-4"
          className="mr-2 animate-spin"
        />
        {t("insightPreferences.loading")}
      </div>
    );
  }

  return (
    <div className={hideDescription ? "space-y-8" : "space-y-8 py-6 px-8"}>
      {!hideDescription && (
        <p className="text-sm text-muted-foreground">
          {t("settings.peopleDescription")}
        </p>
      )}

      {/* Section 1: People I follow */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="mb-0 text-sm font-medium text-foreground leading-tight">
            {t("insightPreferences.focusPeopleLabel")}
            <span className="text-sm font-medium text-muted-foreground ml-1">
              ({focusPeople.length})
            </span>
          </h3>
          <p className="text-sm text-muted-foreground leading-snug">
            {t("insightPreferences.focusPeopleDescription")}
          </p>
        </div>
        <TagEditor
          header={null}
          label=""
          description=""
          values={focusPeople}
          placeholder={t("insightPreferences.focusPlaceholder")}
          inlineExamplePhrases={[
            t(
              "insightPreferences.focusPeopleExamplePhrase1",
              "Jess from Finance",
            ),
            t(
              "insightPreferences.focusPeopleExamplePhrase2",
              "Content from the @founder channel",
            ),
          ]}
          inlineExampleIntro={t(
            "insightPreferences.focusPeopleExampleIntro",
            "(e.g.,",
          )}
          inlineExampleOutro={t(
            "insightPreferences.focusPeopleExampleOutro",
            "）",
          )}
          onChange={handlePeopleChange}
        />
      </section>

      {/* Section 2: Topics I follow (with templates) */}
      <section className="space-y-3 mt-6">
        <div className="space-y-1">
          <h3 className="mb-0 text-sm font-medium text-foreground leading-tight">
            {t("insightPreferences.focusTopicsLabel")}
            <span className="text-sm font-medium text-muted-foreground ml-1">
              ({focusTopics.length})
            </span>
          </h3>
          <p className="text-sm text-muted-foreground leading-snug">
            {t("settings.topicsDescription")}
          </p>
        </div>
        <TagEditor
          label=""
          description=""
          values={focusTopics}
          inputValue={topicsInputValue}
          onInputChange={setTopicsInputValue}
          placeholder={t("insightPreferences.focusTopicsPlaceholder")}
          onChange={handleTopicsChange}
        />
        <div className="space-y-4 pt-0 mt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {t(
                "insightPreferences.templatesSubtitle",
                "Not sure what to write? Click an example to add it instantly",
              )}
            </p>
            <button
              type="button"
              onClick={() => setTemplatesExpanded((prev) => !prev)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-expanded={templatesExpanded}
              aria-label={
                templatesExpanded
                  ? t("insightPreferences.collapseTemplates")
                  : t("insightPreferences.expandTemplates")
              }
            >
              <RemixIcon
                name={templatesExpanded ? "arrow_up_s" : "arrow_down_s"}
                size="size-4"
              />
            </button>
          </div>
          {templatesExpanded && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 mt-0">
              {templates.map((template) => (
                <div
                  key={template.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTemplateClick(template.template)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTemplateClick(template.template);
                    }
                  }}
                  className="rounded-2xl border bg-background/70 py-3 px-4 shadow-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer relative h-[108px] flex flex-col hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-4 flex-1 min-h-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-semibold font-serif line-clamp-1">
                          {template.title}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.example}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

PersonalizationInterestsSettings.displayName =
  "PersonalizationInterestsSettings";
