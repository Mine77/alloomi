"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import useSWRInfinite from "swr/infinite";
import type { InsightResponse } from "@/components/insight-card";
import { fetcher } from "@/lib/utils";

// Independent pagination size configuration
const PAGE_SIZE = 100;

/**
 * Generate independent SWR key for events panel
 * Does not depend on global InsightsPaginationContext
 */
function getEventsPaginationKey(
  pageIndex: number,
  previousPageData: InsightResponse | null,
  days: number | null,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  // Build base URL with days parameter
  const daysParam = days !== null && days !== undefined ? `&days=${days}` : "";

  if (pageIndex === 0) {
    // Events data queried based on days parameter
    return `/api/insights/events?limit=${PAGE_SIZE}${daysParam}`;
  }

  const item = previousPageData?.items.at(-1);
  if (!item) return null;

  return `/api/insights/events?ending_before=${item.id}&limit=${PAGE_SIZE}${daysParam}`;
}

/**
 * Independent events panel data management hook
 * References design pattern of use-favorite-data.ts
 * Does not depend on main interface insight data
 */
export function useEventsData(days: number | null = null) {
  // Store previous days value for detecting changes
  const prevDaysRef = useRef(days);

  // Use independent SWR Infinite hook, not dependent on global context
  const {
    error,
    data: pages,
    setSize,
    isValidating,
    isLoading,
    mutate: mutateEventsList,
  } = useSWRInfinite<InsightResponse>(
    (pageIndex, previousPageData) =>
      getEventsPaginationKey(pageIndex, previousPageData, days),
    fetcher,
    {
      fallbackData: [],
      initialSize: 1,
      // When days changes, automatically revalidate
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Reset pagination to first page when days changes
  useEffect(() => {
    if (prevDaysRef.current !== days) {
      prevDaysRef.current = days;
      // Only reset page size, don't revalidate (SWR will auto-fetch due to key change)
      setSize(1);
    }
  }, [days, setSize]);

  // Calculate derived data
  const eventsData = useMemo(() => {
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

  const hasReachedEnd = useMemo(
    () => pages?.some((page) => page.hasMore === false) ?? false,
    [pages],
  );

  const incrementSize = useCallback(
    () => setSize((prev) => prev + 1),
    [setSize],
  );

  const resetSize = useCallback(() => setSize(1), [setSize]);

  const eventsInsights = eventsData?.items ?? [];

  // Calculate progress
  const progressScale = 100;
  const progress = eventsData.percent
    ? Math.min(95, Math.max(0, Math.round(eventsData.percent * progressScale)))
    : null;

  return {
    eventsInsights,
    eventsData,
    isLoading,
    error,
    mutateEventsList,
    pages,
    hasMore,
    incrementSize,
    resetSize,
    isValidating,
    hasReachedEnd,
    progress,
  };
}
