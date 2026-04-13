/**
 * Custom hook for Insight filtering
 * Includes logic for quick filtering, unread/read filtering, tag filtering, etc.
 */

import { useMemo, useCallback, useState } from "react";
import type { Insight } from "@/lib/db/schema";
import { insightMatchesFilter } from "@/lib/insights/filter-utils";
import type { InsightFilterContext } from "@/lib/insights/filter-utils";
import {
  insightIsImport,
  insightIsUrgent,
} from "@/lib/insights/focus-classifier";
import type { InsightTab } from "@/hooks/use-insight-tabs";

/**
 * Parameters for Insight filtering Hook
 */
interface UseInsightFilteringParams {
  baseInsights: Insight[];
  sortedInsights: Insight[];
  tabs: InsightTab[];
  focusTab: InsightTab | undefined;
  filterContext: InsightFilterContext;
  insightHasMyNickname: (insight: Insight) => boolean;
  insightGetActions: (
    insight: Insight,
  ) => Array<{ id?: string; title?: string }>;
  insightIsUnread: (insightId: string) => boolean;
  insightIsFocus: (insight: Insight) => boolean;
}

/**
 * Return value of Insight filtering Hook
 */
interface UseInsightFilteringReturn {
  // Focus tab related
  focusInsights: Insight[];
  sortedFocusInsights: Insight[];
  focusUnreadCount: number;
  focusReadStatus: "unread" | "read" | "all";
  setFocusReadStatus: (status: "unread" | "read" | "all") => void;

  // Other tab related
  filteredOtherInsights: Insight[];
  otherUnreadCount: number;
  otherReadStatus: "unread" | "read" | "all";
  setOtherReadStatus: (status: "unread" | "read" | "all") => void;

  // Custom tab related
  getFilteredTabInsights: (tabId: string) => Insight[];
  getCustomTabTagCounts: (tabId: string) => Record<string, number>;
  customTabUnreadCounts: Map<string, number>;
  customTabReadStatus: Map<string, "unread" | "read" | "all">;
  setCustomTabReadStatus: (
    updater: (
      prev: Map<string, "unread" | "read" | "all">,
    ) => Map<string, "unread" | "read" | "all">,
  ) => void;
  customTabFilterTags: Map<string, Set<string>>;
  setCustomTabFilterTags: (
    updater: (prev: Map<string, Set<string>>) => Map<string, Set<string>>,
  ) => void;
}

/**
 * Custom hook for Insight filtering
 * @param params - Hook parameters
 * @returns Filtering-related state and functions
 */
export function useInsightFiltering({
  baseInsights,
  sortedInsights,
  tabs,
  focusTab,
  filterContext,
  insightHasMyNickname,
  insightGetActions,
  insightIsUnread,
  insightIsFocus,
}: UseInsightFilteringParams): UseInsightFilteringReturn {
  // Focus tab's unread/read filtering, defaults to show all
  const [focusReadStatus, setFocusReadStatus] = useState<
    "unread" | "read" | "all"
  >("all");

  // Other tab's unread/read filtering, defaults to show only unread
  const [otherReadStatus, setOtherReadStatus] = useState<
    "unread" | "read" | "all"
  >("unread");

  // Custom tab's unread/read filtering status
  const [customTabReadStatus, setCustomTabReadStatus] = useState<
    Map<string, "unread" | "read" | "all">
  >(new Map());

  // Custom tab's quick filter tags
  const [customTabFilterTags, setCustomTabFilterTags] = useState<
    Map<string, Set<string>>
  >(new Map());

  /**
   * Filter out insights matching focus tab filter rules (for focus view)
   * Apply unread/read filtering
   */
  const focusInsights = useMemo(() => {
    // Use focus tab's filter rules
    let baseFocus: Insight[] = [];
    if (focusTab?.filter) {
      baseFocus = baseInsights.filter((insight) =>
        insightMatchesFilter(insight, focusTab.filter, filterContext),
      );
    } else {
      // If no focus tab is found, use default logic (backward compatible)
      baseFocus = baseInsights.filter((insight) => {
        const isImport = insightIsImport(insight);
        const isUrgent = insightIsUrgent(insight);
        return isImport && isUrgent;
      });
    }

    // Apply unread/read filtering
    if (focusReadStatus === "all") {
      return baseFocus;
    }

    return baseFocus.filter((insight) => {
      const isUnread = insightIsUnread(insight.id);
      if (focusReadStatus === "unread") {
        return isUnread;
      } else {
        return !isUnread;
      }
    });
  }, [baseInsights, focusTab, filterContext, focusReadStatus, insightIsUnread]);

  /**
   * Sort insights in the focus view
   * Sort rule: by time descending
   */
  const sortedFocusInsights = useMemo(
    () =>
      [...focusInsights].sort((a, b) => {
        // Sort by time descending
        const timeA =
          a.details && a.details.length > 0
            ? new Date(a.details[a.details.length - 1].time || a.time).getTime()
            : new Date(a.time).getTime();
        const timeB =
          b.details && b.details.length > 0
            ? new Date(b.details[b.details.length - 1].time || b.time).getTime()
            : new Date(b.time).getTime();
        return timeB - timeA;
      }),
    [focusInsights],
  );

  /**
   * Calculate number of unread insights in focus tab
   */
  const focusUnreadCount = useMemo(() => {
    let baseFocus: Insight[] = [];
    if (focusTab?.filter) {
      baseFocus = baseInsights.filter((insight) =>
        insightMatchesFilter(insight, focusTab.filter, filterContext),
      );
    } else {
      // Backward compatibility
      baseFocus = baseInsights.filter((insight) => {
        const isImport = insightIsImport(insight);
        const isUrgent = insightIsUrgent(insight);
        return isImport && isUrgent;
      });
    }
    return baseFocus.filter((insight) => insightIsUnread(insight.id)).length;
  }, [baseInsights, focusTab, filterContext, insightIsUnread]);

  /**
   * Filter other tab's insights based on unread/read status
   */
  const filteredOtherInsights = useMemo(() => {
    // Filter out non-focus insights
    const baseOther = sortedInsights.filter(
      (insight) => !insightIsFocus(insight),
    );

    // Apply unread/read filtering
    if (otherReadStatus === "all") {
      return baseOther;
    }

    return baseOther.filter((insight) => {
      const isUnread = insightIsUnread(insight.id);
      if (otherReadStatus === "unread") {
        return isUnread;
      } else {
        return !isUnread;
      }
    });
  }, [sortedInsights, insightIsFocus, otherReadStatus, insightIsUnread]);

  /**
   * Calculate number of unread insights in other tab
   */
  const otherUnreadCount = useMemo(() => {
    const baseOther = sortedInsights.filter(
      (insight) => !insightIsFocus(insight),
    );
    return baseOther.filter((insight) => insightIsUnread(insight.id)).length;
  }, [sortedInsights, insightIsFocus, insightIsUnread]);

  /**
   * Filter insights based on custom tab's filter rules and filtering conditions
   */
  const getFilteredTabInsights = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return [];

      // 1. Apply tab's filter rules
      const baseFiltered = baseInsights.filter((insight) =>
        insightMatchesFilter(insight, tab.filter, filterContext),
      );

      // 2. Apply unread/read filtering
      const readStatus = customTabReadStatus.get(tabId) || "unread";
      let filteredByReadStatus = baseFiltered;
      if (readStatus !== "all") {
        filteredByReadStatus = baseFiltered.filter((insight) => {
          const isUnread = insightIsUnread(insight.id);
          return readStatus === "unread" ? isUnread : !isUnread;
        });
      }

      // 3. Apply quick filter tags
      const filterTags = customTabFilterTags.get(tabId);
      if (!filterTags || filterTags.size === 0) {
        return filteredByReadStatus;
      }

      return filteredByReadStatus.filter((insight) => {
        const isImport = insightIsImport(insight);
        const isUrgent = insightIsUrgent(insight);
        const hasMyNickname = insightHasMyNickname(insight);
        const isUnreplied = insight.isUnreplied === true;
        const hasActions = insightGetActions(insight).length > 0;

        return (
          (filterTags.has("important") && isImport) ||
          (filterTags.has("urgent") && isUrgent) ||
          (filterTags.has("mentions") && hasMyNickname) ||
          (filterTags.has("unreplied") && isUnreplied) ||
          (filterTags.has("tasks") && hasActions)
        );
      });
    },
    [
      tabs,
      baseInsights,
      customTabReadStatus,
      customTabFilterTags,
      insightIsUnread,
      insightHasMyNickname,
      insightGetActions,
      filterContext,
    ],
  );

  /**
   * Calculate custom tab's tag count
   */
  const getCustomTabTagCounts = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return {};

      // Apply tab's filter rules and unread/read filtering
      const baseFiltered = baseInsights.filter((insight) =>
        insightMatchesFilter(insight, tab.filter, filterContext),
      );

      const readStatus = customTabReadStatus.get(tabId) || "unread";
      let filteredByReadStatus = baseFiltered;
      if (readStatus !== "all") {
        filteredByReadStatus = baseFiltered.filter((insight) => {
          const isUnread = insightIsUnread(insight.id);
          return readStatus === "unread" ? isUnread : !isUnread;
        });
      }

      const counts: Record<string, number> = {};
      for (const insight of filteredByReadStatus) {
        const isImport = insightIsImport(insight);
        const isUrgent = insightIsUrgent(insight);
        const hasMyNickname = insightHasMyNickname(insight);
        const isUnreplied = insight.isUnreplied === true;
        const hasActions = insightGetActions(insight).length > 0;

        if (isImport) counts.important = (counts.important || 0) + 1;
        if (isUrgent) counts.urgent = (counts.urgent || 0) + 1;
        if (hasMyNickname) counts.mentions = (counts.mentions || 0) + 1;
        if (isUnreplied) counts.unreplied = (counts.unreplied || 0) + 1;
        if (hasActions) counts.tasks = (counts.tasks || 0) + 1;
      }

      return counts;
    },
    [
      tabs,
      baseInsights,
      customTabReadStatus,
      insightIsUnread,
      insightHasMyNickname,
      insightGetActions,
      filterContext,
    ],
  );

  /**
   * Calculate unread count for each custom tab
   */
  const customTabUnreadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const enabledTabs = tabs.filter(
      (tab) => tab.type !== "system" && tab.enabled,
    );

    for (const tab of enabledTabs) {
      const filtered = baseInsights.filter((insight) =>
        insightMatchesFilter(insight, tab.filter, filterContext),
      );
      const unreadCount = filtered.filter((insight) =>
        insightIsUnread(insight.id),
      ).length;
      counts.set(tab.id, unreadCount);
    }

    return counts;
  }, [tabs, baseInsights, insightIsUnread, filterContext]);

  return {
    focusInsights,
    sortedFocusInsights,
    focusUnreadCount,
    focusReadStatus,
    setFocusReadStatus,
    filteredOtherInsights,
    otherUnreadCount,
    otherReadStatus,
    setOtherReadStatus,
    getFilteredTabInsights,
    getCustomTabTagCounts,
    customTabUnreadCounts,
    customTabReadStatus,
    setCustomTabReadStatus,
    customTabFilterTags,
    setCustomTabFilterTags,
  };
}
