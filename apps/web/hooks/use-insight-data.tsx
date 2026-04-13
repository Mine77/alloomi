/**
 * Custom hook for Insight data processing
 * Includes data processing logic such as filtering, sorting, grouping
 */

import {
  useMemo,
  useCallback,
  createContext,
  type ReactNode,
  useState,
  useEffect,
  useContext,
} from "react";
import type { Insight } from "@/lib/db/schema";
import {
  deduplicateInsights,
  groupInsightsByDay,
  getInsightTime,
} from "@/components/agent/events-panel-utils";
import { insightIsImportOrUrgent } from "@/lib/insights/focus-classifier";
import { insightMatchesFilterDefinition } from "@/lib/insights/filter-utils";
import type { InsightFilterContext } from "@/lib/insights/filter-utils";
import type { InsightFilterDefinition } from "@/lib/insights/filter-schema";
import useSWRInfinite, { type SWRInfiniteKeyedMutator } from "swr/infinite";
import type { InsightResponse } from "@/components/insight-card";
import { fetcher } from "@/lib/utils";

const PAGE_SIZE = 100;

/**
 * Parameters for Insight data processing Hook
 */
interface UseInsightDataParams {
  insightList: Insight[];
  isViewingArchived: boolean;
  quickFilter: string;
  allowedFilterValues: Set<string>;
  customFilters: Array<{
    id: string;
    definition: unknown;
    isArchived: boolean;
  }>;
  filterContext: InsightFilterContext;
  language: string;
  insightHasMyNickname: (insight: Insight) => boolean;
  insightGetActions: (
    insight: Insight,
  ) => Array<{ id?: string; title?: string }>;
}

/**
 * Return value of Insight data processing Hook
 */
interface UseInsightDataReturn {
  uniqueInsights: Insight[];
  baseInsights: Insight[];
  filteredInsights: Insight[];
  sortedInsights: Insight[];
  groupedInsights: ReturnType<typeof groupInsightsByDay>;
  filterCounts: Record<string, number>;
}

// Data types required by Brief Panel
export interface BriefData {
  weights: Record<string, number>;
  lastViewedAt: Record<string, string>;
  overrides: Record<string, string>;
  unpinnedIds: string[];
  pinnedInsights: any[];
}

interface InsightsPaginationContextValue {
  error: any;
  pages: InsightResponse[] | undefined;
  insightData: { items: any[]; sessions: any[]; percent: number | null };
  progress: number | null;
  hasMore: boolean;
  isValidating: boolean;
  isLoading: boolean;
  hasReachedEnd: boolean;
  mutateInsightList: SWRInfiniteKeyedMutator<InsightResponse[]>;
  setGlobalSize: (size: number) => void;
  globalSize: number;
  incrementSize: () => void;
  resetSize: () => void;
  // Time filter parameter: days=0 means all time, days=1 means today, days>0 means specified number of days
  days: number | null;
  setDays: (days: number | null) => void;
  // Force refresh data
  refresh: () => void;
  // Data required by Brief Panel (fetched from API in one go)
  briefData: BriefData | null;
  setIncludeBriefData: (include: boolean) => void;
}

const InsightsPaginationContext = createContext<
  InsightsPaginationContextValue | undefined
>(undefined);

export function getInsightsPaginationKey(
  pageIndex: number,
  previousPageData: InsightResponse,
  days?: number | null,
  includeBriefData?: boolean,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  // Build base URL with days parameter and includeBriefData
  const params = new URLSearchParams();
  if (days !== null && days !== undefined) {
    params.set("days", String(days));
  }
  if (includeBriefData) {
    params.set("includeBriefData", "true");
  }
  const paramsStr = params.toString();
  // Note: first page uses ?, subsequent pages use &
  const prefix =
    pageIndex === 0
      ? paramsStr
        ? `?${paramsStr}`
        : ""
      : paramsStr
        ? `&${paramsStr}`
        : "";

  if (pageIndex === 0) return `/api/insights?limit=${PAGE_SIZE}${prefix}`;

  const item = previousPageData.items.at(-1);
  if (!item) return null;

  return `/api/insights?ending_before=${item.id}&limit=${PAGE_SIZE}${prefix}`;
}

// Global Provider component
export const InsightsPaginationProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  // Global pagination count (core shared state)
  const [globalSize, setGlobalSize] = useState(1);
  // Time range filter parameter (null means use default value, 0 means all time)
  const [days, setDays] = useState<number | null>(null);
  // Whether to include Brief Panel data in API requests
  const [includeBriefData, setIncludeBriefData] = useState(false);

  // Initialize SWR Infinite
  const {
    error,
    data: pages,
    setSize: setSWRSize,
    isValidating,
    isLoading,
    mutate: mutateInsightList,
  } = useSWRInfinite<InsightResponse>(
    (pageIndex, previousPageData) =>
      getInsightsPaginationKey(
        pageIndex,
        previousPageData,
        days,
        includeBriefData,
      ),
    fetcher,
    { fallbackData: [], initialSize: globalSize }, // Initial count synced with global size
  );

  useEffect(() => {
    setSWRSize(globalSize);
  }, [globalSize, setSWRSize]);

  // Calculate derived state
  const hasReachedEnd = useMemo(
    () => pages?.some((page) => page.hasMore === false) ?? false,
    [pages],
  );

  const insightData = useMemo(() => {
    if (!pages) return { items: [], sessions: [], percent: null };
    return {
      items: pages.flatMap((page) => page.items || []),
      sessions: pages.flatMap((page) => page.sessions || []),
      percent: pages[pages.length - 1]?.percent ?? null,
    };
  }, [pages]);

  const hasMore = useMemo(() => {
    if (!pages) return false;
    return pages[pages.length - 1]?.hasMore ?? false;
  }, [pages]);

  // Shortcut: load next page
  const incrementSize = useCallback(
    () => setGlobalSize((prev) => prev + 1),
    [],
  );
  // Reset pagination
  const resetSize = useCallback(() => setGlobalSize(1), []);

  // Force refresh data
  const refresh = useCallback(() => {
    mutateInsightList(undefined, { revalidate: true });
  }, [mutateInsightList]);

  // Wrap setGlobalSize as stable reference
  const setGlobalSizeStable = useCallback(
    (size: number | ((prev: number) => number)) => {
      setGlobalSize(size);
    },
    [],
  );

  const progressScale = 100;
  const progress = insightData.percent
    ? Math.min(95, Math.max(0, Math.round(insightData.percent * progressScale)))
    : null;

  // Wrap setDays as stable reference
  const setDaysStable = useCallback((newDays: number | null) => {
    setDays(newDays);
    // Reset pagination to first page when days changes
    setGlobalSize(1);
  }, []);

  // Extract Brief data from first page
  const briefData = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    const firstPage = pages[0] as any;
    return firstPage?.briefData || null;
  }, [pages]);

  // Wrap setIncludeBriefData as stable reference
  const setIncludeBriefDataStable = useCallback((include: boolean) => {
    setIncludeBriefData(include);
    // Reset pagination to first page when changed
    setGlobalSize(1);
  }, []);

  // Assemble Context value
  const contextValue = useMemo<InsightsPaginationContextValue>(
    () => ({
      error,
      pages,
      insightData,
      progress,
      hasMore,
      isValidating,
      isLoading,
      hasReachedEnd,
      mutateInsightList,
      setGlobalSize: setGlobalSizeStable,
      globalSize,
      incrementSize,
      resetSize,
      days,
      setDays: setDaysStable,
      refresh,
      briefData,
      setIncludeBriefData: setIncludeBriefDataStable,
    }),
    [
      error,
      pages,
      insightData,
      progress,
      hasMore,
      isValidating,
      isLoading,
      hasReachedEnd,
      mutateInsightList,
      setGlobalSizeStable,
      globalSize,
      incrementSize,
      resetSize,
      days,
      setDaysStable,
      refresh,
    ],
  );

  return (
    <InsightsPaginationContext.Provider value={contextValue}>
      {children}
    </InsightsPaginationContext.Provider>
  );
};

export const useInsightPagination = () => {
  const context = useContext(InsightsPaginationContext);
  // Instead of throwing an error, return a safe default value
  // This allows components to work gracefully even when not wrapped in InsightsPaginationProvider
  if (!context) {
    return {
      error: null,
      pages: [],
      insightData: { items: [], sessions: [], percent: null },
      progress: null,
      hasMore: false,
      isValidating: false,
      isLoading: false,
      hasReachedEnd: false,
      mutateInsightList: async () => undefined,
      setGlobalSize: () => {},
      globalSize: 1,
      incrementSize: () => {},
      resetSize: () => {},
      days: null,
      setDays: () => {},
      refresh: () => {},
      briefData: null,
      setIncludeBriefData: () => {},
    };
  }
  return context;
};

/**
 * Custom hook for Insight data processing
 * @param params - Hook parameters
 * @returns Processed data
 */
export function useInsightData({
  insightList,
  isViewingArchived,
  quickFilter,
  allowedFilterValues,
  customFilters,
  filterContext,
  language,
  insightHasMyNickname,
  insightGetActions,
}: UseInsightDataParams): UseInsightDataReturn {
  // Process summary data
  const uniqueInsights = useMemo(
    () => deduplicateInsights(insightList || [], "title"),
    [insightList],
  );

  // Filter insights based on archive mode
  const baseInsights = useMemo(() => {
    const insights = [...uniqueInsights];
    if (isViewingArchived) {
      // Archive mode: only show archived insights (use database field)
      return insights.filter((insight) => insight.isArchived === true);
    } else {
      // Normal mode: only show unarchived insights (use database field)
      return insights.filter((insight) => !insight.isArchived);
    }
  }, [uniqueInsights, isViewingArchived]);

  const insightIsImportOrUrgentCallback = useCallback(
    (insight: Insight) => insightIsImportOrUrgent(insight),
    [],
  );

  const filterCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {
      all: baseInsights.length,
      priority: baseInsights.filter((insight) =>
        insightIsImportOrUrgentCallback(insight),
      ).length,
      mentions: baseInsights.filter((insight) => insightHasMyNickname(insight))
        .length,
      actionItems: baseInsights.filter(
        (insight) => insightGetActions(insight).length > 0,
      ).length,
    };
    for (const filter of customFilters) {
      if (!filter.isArchived) {
        const filterKey = `filter:${filter.id}`;
        counts[filterKey] = baseInsights.filter((insight) =>
          insightMatchesFilterDefinition(
            insight,
            filter.definition as InsightFilterDefinition,
            filterContext,
          ),
        ).length;
      }
    }
    return counts;
  }, [
    baseInsights,
    insightHasMyNickname,
    insightIsImportOrUrgentCallback,
    insightGetActions,
    customFilters,
    filterContext,
  ]);

  const filteredInsights = useMemo(
    () =>
      baseInsights.filter((insight) => {
        if (quickFilter === "all") {
          return true;
        }
        switch (quickFilter) {
          case "priority":
            return insightIsImportOrUrgentCallback(insight);
          case "mentions":
            return insightHasMyNickname(insight);
          case "actionItems":
            return insightGetActions(insight).length > 0;
          default:
            if (!allowedFilterValues.has(quickFilter)) {
              return true;
            }
            if (quickFilter.startsWith("filter:")) {
              const filterId = quickFilter.replace("filter:", "");
              const filter = customFilters.find((f) => f.id === filterId);
              if (filter) {
                return insightMatchesFilterDefinition(
                  insight,
                  filter.definition as InsightFilterDefinition,
                  filterContext,
                );
              }
              return false;
            }
            return false;
        }
      }),
    [
      baseInsights,
      quickFilter,
      insightHasMyNickname,
      insightIsImportOrUrgentCallback,
      insightGetActions,
      allowedFilterValues,
      customFilters,
      filterContext,
    ],
  );

  const sortedInsights = useMemo(
    () =>
      [...filteredInsights].sort((a, b) => {
        const aIsImport = insightIsImportOrUrgentCallback(a);
        const bIsImport = insightIsImportOrUrgentCallback(b);
        const aHasMyNickname = insightHasMyNickname(a);
        const bHasMyNickname = insightHasMyNickname(b);

        if (aHasMyNickname && !bHasMyNickname) return -1;
        if (!aHasMyNickname && bHasMyNickname) return 1;

        if (aIsImport && !bIsImport) return -1;
        if (!aIsImport && bIsImport) return 1;

        const timeA = getInsightTime(a).getTime();
        const timeB = getInsightTime(b).getTime();
        return timeB - timeA;
      }),
    [filteredInsights, insightHasMyNickname, insightIsImportOrUrgentCallback],
  );

  const groupedInsights = useMemo(
    () => groupInsightsByDay(sortedInsights, language),
    [sortedInsights, language],
  );

  return {
    uniqueInsights,
    baseInsights,
    filteredInsights,
    sortedInsights,
    groupedInsights,
    filterCounts,
  };
}
