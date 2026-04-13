"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useRef,
} from "react";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "usehooks-ts";
import { fetcher, cn } from "@/lib/utils";
import { saveLanguage } from "@/i18n";
import { toast } from "@/components/toast";
import { RemixIcon } from "@/components/remix-icon";
import { PersonalizationLanguageRefresh } from "./personalization-language-refresh";
import { SoulPromptPanel } from "./soul-prompt-sheet";
import {
  SOUL_PRESETS,
  SOUL_PRESET_CUSTOM_ID,
  getSelectedSoulPresetId,
  getPresetPrompt,
} from "@alloomi/shared/soul";
import { TwoPaneSidebarLayout } from "@/components/layout/two-pane-sidebar-layout";

type InsightPreferencesResponse = {
  focusPeople: string[];
  focusTopics: string[];
  language: string;
  refreshIntervalMinutes: number;
  lastUpdated: string;
  aiSoulPrompt?: string | null;
  roles?: {
    manual: string[];
  };
};

type InsightPreferencesPayload = {
  focusPeople: string[];
  focusTopics: string[];
  language: string;
  refreshIntervalMinutes: number;
  roleKeys: string[];
  aiSoulPrompt?: string;
};

/**
 * Hook to get user basic preferences (exported for dialog sidebar to display lastUpdated, etc.)
 */
export function useBasicPreferences() {
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
    console.error("[Basic Preferences] Fetch failed", error);
  }

  return { data, isLoading, mutate };
}

/**
 * Basic settings component props
 */
interface PersonalizationBasicSettingsProps {
  /** Whether to display */
  open: boolean;
}

/**
 * Methods exposed by the basic settings component
 */
export interface PersonalizationBasicSettingsRef {
  /** Save settings */
  save: () => Promise<void>;
  /** Whether currently saving */
  isSaving: boolean;
}

/**
 * Basic settings component
 * Provides basic settings such as language and refresh frequency
 */
export const PersonalizationBasicSettings = forwardRef<
  PersonalizationBasicSettingsRef,
  PersonalizationBasicSettingsProps
>(({ open: _open }, ref) => {
  const { t, i18n } = useTranslation();
  const {
    data: basicData,
    isLoading: isBasicLoading,
    mutate: basicMutate,
  } = useBasicPreferences();

  const [language, setLanguage] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [aiSoulPrompt, setAiSoulPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useLocalStorage(
    "alloomi-soul-custom-prompt",
    "",
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSelectedId, setSheetSelectedId] = useState<string>(
    SOUL_PRESET_CUSTOM_ID,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const lastSynced = useRef<{
    language: string;
    refreshInterval: number;
    aiSoulPrompt: string;
  } | null>(null);

  useEffect(() => {
    if (basicData) {
      const prompt = basicData.aiSoulPrompt ?? "";
      setLanguage(basicData.language ?? "");
      setRefreshInterval(basicData.refreshIntervalMinutes ?? 30);
      setAiSoulPrompt(prompt);
      if (getSelectedSoulPresetId(prompt) === SOUL_PRESET_CUSTOM_ID) {
        setCustomPrompt(prompt);
      }
      setHasHydrated(true);
      lastSynced.current = {
        language: basicData.language ?? "",
        refreshInterval: basicData.refreshIntervalMinutes ?? 30,
        aiSoulPrompt: prompt,
      };
    }
  }, [basicData]);

  const persistBasicPreferences = useCallback(
    async (
      nextLanguage: string,
      nextRefreshInterval: number,
      nextAiSoulPrompt: string,
    ) => {
      if (!hasHydrated) {
        return;
      }
      setIsSaving(true);

      try {
        const currentData = (await fetch("/api/preferences/insight").then((r) =>
          r.json(),
        )) as InsightPreferencesResponse;
        const payload: InsightPreferencesPayload = {
          focusPeople: currentData?.focusPeople ?? [],
          focusTopics: currentData?.focusTopics ?? [],
          language: nextLanguage,
          refreshIntervalMinutes: nextRefreshInterval,
          roleKeys: currentData?.roles?.manual ?? [],
          aiSoulPrompt: nextAiSoulPrompt || undefined,
        };

        const response = await fetch("/api/preferences/insight", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const next = (await response.json()) as InsightPreferencesResponse;
        lastSynced.current = {
          language: next.language ?? nextLanguage,
          refreshInterval: next.refreshIntervalMinutes ?? nextRefreshInterval,
          aiSoulPrompt: next.aiSoulPrompt ?? nextAiSoulPrompt,
        };
        await basicMutate(next, { revalidate: false });
      } catch (error) {
        console.error("[Basic Preferences] Update failed", error);
        toast({
          type: "error",
          description: t("insightPreferences.toast.failure"),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [hasHydrated, t],
  );

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    if (
      lastSynced.current &&
      lastSynced.current.language === language &&
      lastSynced.current.refreshInterval === refreshInterval &&
      lastSynced.current.aiSoulPrompt === aiSoulPrompt
    ) {
      return;
    }
    void persistBasicPreferences(language, refreshInterval, aiSoulPrompt);
  }, [language, refreshInterval, aiSoulPrompt, hasHydrated]);

  /**
   * Save basic settings (external fallback)
   */
  const handleSubmit = useCallback(async () => {
    await persistBasicPreferences(language, refreshInterval, aiSoulPrompt);
  }, [language, persistBasicPreferences, refreshInterval, aiSoulPrompt]);

  /**
   * Expose save method to parent component
   */
  useImperativeHandle(ref, () => ({
    save: handleSubmit,
    isSaving,
  }));

  if (isBasicLoading || !hasHydrated) {
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

  const leftColumn = (
    <div className="space-y-6 min-w-0 p-0">
      {/* Title and description + Soul card area: same container, spacing 8 */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="mb-0 text-sm font-medium text-foreground leading-tight">
            {t("common.aiSoulHeading", "Alloomi Soul")}
          </h3>
          <p className="text-sm text-muted-foreground leading-snug">
            {t(
              "common.aiSoulHint",
              "Define Alloomi's personality and style in a sentence, leave blank to use default settings",
            )}
          </p>
        </div>
        <div className="min-w-0 pr-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Default + other presets (Strategist, Executor, Connector, Stabilizer) */}
            {SOUL_PRESETS.map((preset) => {
              const selected =
                getSelectedSoulPresetId(aiSoulPrompt) === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSheetSelectedId(preset.id);
                    setSheetOpen(true);
                    setAiSoulPrompt(getPresetPrompt(preset.id, i18n.language));
                  }}
                  className={cn(
                    "min-w-0 w-full rounded-lg border px-4 py-3 text-left transition-colors flex flex-col items-start",
                    "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-[var(--primary-50)]"
                      : "border-border bg-card",
                  )}
                >
                  <span className="font-serif text-sm font-semibold">
                    {t(preset.titleKey)}
                  </span>
                  <p className="mt-1.5 text-xs text-muted-foreground min-w-0 leading-snug">
                    {t(preset.descriptionKey)}
                  </p>
                </button>
              );
            })}
            {/* Custom: last one */}
            <button
              type="button"
              onClick={() => {
                setSheetSelectedId(SOUL_PRESET_CUSTOM_ID);
                setSheetOpen(true);
                setAiSoulPrompt(customPrompt);
              }}
              className={cn(
                "min-w-0 w-full rounded-lg border px-4 py-3 text-left transition-colors flex flex-col items-start",
                "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                // On open, judge by sheet state; on close, judge by whether custom prompt was selected
                (sheetOpen && sheetSelectedId === SOUL_PRESET_CUSTOM_ID) ||
                  getSelectedSoulPresetId(aiSoulPrompt) ===
                    SOUL_PRESET_CUSTOM_ID
                  ? "border-primary bg-[var(--primary-50)]"
                  : "border-border bg-card",
              )}
            >
              <span className="font-serif text-sm font-semibold">
                {t("common.soulPreset.custom")}
              </span>
              <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground min-w-0">
                {customPrompt.trim()
                  ? customPrompt.replace(/\s+/g, " ").trim()
                  : t("common.aiSoulPromptPlaceholder")}
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Language and refresh frequency */}
      <PersonalizationLanguageRefresh
        language={language}
        refreshInterval={refreshInterval}
        onLanguageChange={(code) => {
          setLanguage(code);
          if (code) {
            i18n.changeLanguage(code);
            saveLanguage(code);
          }
        }}
        onRefreshIntervalChange={setRefreshInterval}
      />
    </div>
  );

  const promptPanelProps = {
    sheetSelectedId,
    presetPrompt:
      sheetSelectedId !== SOUL_PRESET_CUSTOM_ID
        ? getPresetPrompt(sheetSelectedId, i18n.language) || null
        : null,
    customPrompt,
    onCustomPromptChange: (value: string) => {
      setCustomPrompt(value);
    },
    onClose: () => setSheetOpen(false),
    onSave: () => {
      setAiSoulPrompt(customPrompt);
      setSheetOpen(false);
    },
    onCancel: () => {
      setCustomPrompt(aiSoulPrompt);
      setSheetOpen(false);
    },
  };

  /** Always use "Multi-Column" inline panel, consistent with personalization dialog and Onboarding dialog */
  return (
    <TwoPaneSidebarLayout
      isSidebarOpen={sheetOpen}
      breakpoint="lg"
      sidebar={<SoulPromptPanel {...promptPanelProps} />}
      mainClassName={sheetOpen ? "max-lg:flex" : undefined}
      sidebarClassName="lg:min-w-[540px] lg:max-w-[540px] lg:absolute lg:right-6 lg:top-6 lg:bottom-6 lg:h-auto lg:z-40 lg:rounded-xl lg:border lg:shadow-md max-lg:absolute max-lg:left-6 max-lg:right-6 max-lg:top-6 max-lg:bottom-6 max-lg:w-auto max-lg:min-w-0 max-lg:max-w-none max-lg:z-40 max-[800px]:left-0 max-[800px]:right-0"
    >
      <div className="flex-1 min-h-0 overflow-y-auto">{leftColumn}</div>
    </TwoPaneSidebarLayout>
  );
});

PersonalizationBasicSettings.displayName = "PersonalizationBasicSettings";
