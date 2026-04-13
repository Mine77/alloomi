"use client";

import { useMemo } from "react";
import type { Insight } from "@/lib/db/schema";
import { useIntegrations } from "@/hooks/use-integrations";
import {
  dedupeOptions,
  normalizeBasicOption,
  normalizeImportanceOption,
  normalizePlatformOption,
  normalizeUrgencyOption,
} from "@/lib/insights/option-normalizers";

/**
 * Extract available filter options from insights data
 */
export function useInsightFilterOptions(insights: Insight[] = []) {
  const { accounts } = useIntegrations();

  /**
   * Extract all unique platform values
   */
  const platforms = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (insight.platform) {
        values.push(insight.platform);
      }
    });
    return dedupeOptions(values, normalizePlatformOption);
  }, [insights]);

  /**
   * Extract all unique account values
   */
  const accountOptions = useMemo(() => {
    const accountMap = new Map<string, string>();
    accounts.forEach((account) => {
      accountMap.set(account.externalId, account.displayName);
      accountMap.set(account.displayName, account.displayName);
    });

    const values: string[] = [];

    insights.forEach((insight) => {
      if (insight.account) {
        const displayName = accountMap.get(insight.account) || insight.account;
        values.push(displayName);
      }
    });

    return dedupeOptions(values, normalizeBasicOption);
  }, [insights, accounts]);

  /**
   * Extract all unique groups (channels/groups) values
   */
  const groups = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (Array.isArray(insight.groups)) {
        insight.groups.forEach((group) => {
          if (group && typeof group === "string") {
            values.push(group);
          }
        });
      }
    });
    return dedupeOptions(values, normalizeBasicOption);
  }, [insights]);

  /**
   * Extract all unique people values
   */
  const people = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (Array.isArray(insight.people)) {
        insight.people.forEach((person) => {
          if (person && typeof person === "string") {
            values.push(person);
          }
        });
      }
    });
    return dedupeOptions(values, normalizeBasicOption);
  }, [insights]);

  /**
   * Extract all unique categories values
   */
  const categories = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (Array.isArray(insight.categories)) {
        insight.categories.forEach((category) => {
          if (category && typeof category === "string") {
            values.push(category);
          }
        });
      }
    });
    return dedupeOptions(values, normalizeBasicOption);
  }, [insights]);

  /**
   * Extract all unique taskLabel values
   */
  const taskLabels = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (insight.taskLabel) {
        values.push(insight.taskLabel);
      }
    });
    return dedupeOptions(values, normalizeBasicOption);
  }, [insights]);

  /**
   * Extract all unique importance values
   */
  const importanceOptions = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (insight.importance) {
        values.push(insight.importance);
      }
    });
    return dedupeOptions(values, normalizeImportanceOption);
  }, [insights]);

  /**
   * Extract all unique urgency values
   */
  const urgencyOptions = useMemo(() => {
    const values: string[] = [];
    insights.forEach((insight) => {
      if (insight.urgency) {
        values.push(insight.urgency);
      }
    });
    return dedupeOptions(values, normalizeUrgencyOption);
  }, [insights]);

  return {
    platforms,
    accountOptions,
    groups,
    people,
    categories,
    taskLabels,
    importanceOptions,
    urgencyOptions,
  };
}
