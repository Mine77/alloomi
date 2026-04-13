"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@alloomi/ui";

const REFRESH_OPTIONS = [5, 15, 30, 60, 120];

/**
 * Props for the language and refresh interval selector component
 */
interface PersonalizationLanguageRefreshProps {
  /** Current language setting */
  language: string;
  /** Current refresh interval (in minutes) */
  refreshInterval: number;
  /** Language change callback */
  onLanguageChange: (language: string) => void;
  /** Refresh interval change callback */
  onRefreshIntervalChange: (interval: number) => void;
}

/**
 * Language and refresh interval selector component
 * Provides options for setting language and refresh frequency
 */
export function PersonalizationLanguageRefresh({
  language,
  refreshInterval,
  onLanguageChange,
  onRefreshIntervalChange,
}: PersonalizationLanguageRefreshProps) {
  const { t } = useTranslation();

  /**
   * Language options list
   */
  const languageOptions = useMemo(
    () => [
      { value: "auto", label: t("insightPreferences.language.auto") },
      { value: "en-US", label: t("insightPreferences.language.en") },
      { value: "zh-Hans", label: t("insightPreferences.language.zh") },
    ],
    [t],
  );

  /**
   * Refresh frequency options list
   */
  const refreshOptions = useMemo(
    () =>
      REFRESH_OPTIONS.map((minutes) => ({
        value: minutes,
        label: t("insightPreferences.refreshOption", {
          minutes,
        }),
      })),
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Language selection */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            {t("insightPreferences.languageLabel")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("insightPreferences.languageDescription")}
          </p>
        </div>
        <Select
          value={language === "" ? "auto" : language}
          onValueChange={(value) =>
            onLanguageChange(value === "auto" ? "" : value)
          }
        >
          <SelectTrigger className="h-11">
            <SelectValue
              placeholder={t("insightPreferences.languagePlaceholder")}
            />
          </SelectTrigger>
          <SelectContent className="z-[1010]">
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Refresh frequency selection */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            {t("insightPreferences.refreshLabel")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("insightPreferences.refreshDescription")}
          </p>
        </div>
        <Select
          value={refreshInterval.toString()}
          onValueChange={(value) =>
            onRefreshIntervalChange(Number.parseInt(value, 10))
          }
        >
          <SelectTrigger className="h-11">
            <SelectValue
              placeholder={t("insightPreferences.refreshPlaceholder")}
            />
          </SelectTrigger>
          <SelectContent className="z-[1010]">
            {refreshOptions.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
