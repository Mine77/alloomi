"use client";

import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import type { InsightResponse } from "@/components/insight-card";
import { fetcher } from "@/lib/utils";

// Independent page size config
const PAGE_SIZE = 100;

/**
 * Generate independent SWR key for favorites panel
 * Does not depend on global InsightsPaginationContext
 */
function getFavoritePaginationKey(
  pageIndex: number,
  previousPageData: InsightResponse | null,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    // Favorites query all time ranges (days=0)
    return `/api/insights/favorites?limit=${PAGE_SIZE}&days=0`;
  }

  const item = previousPageData?.items.at(-1);
  if (!item) return null;

  return `/api/insights/favorites?ending_before=${item.id}&limit=${PAGE_SIZE}&days=0`;
}

/**
 * Independent favorites data management hook
 * Refer to use-todo-data.ts design pattern
 * Does not depend on main interface insight data
 */
export function useFavoriteData() {
  // Use independent SWR Infinite hook, does not depend on global context
  const {
    error,
    data: pages,
    setSize,
    isValidating,
    isLoading,
    mutate: mutateFavoriteList,
  } = useSWRInfinite<InsightResponse>(
    (pageIndex, previousPageData) =>
      getFavoritePaginationKey(pageIndex, previousPageData),
    fetcher,
    { fallbackData: [], initialSize: 1 },
  );

  // Compute derived data
  const favoriteData = useMemo(() => {
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

  const favoriteInsights = favoriteData?.items ?? [];

  return {
    favoriteInsights,
    favoriteData,
    isLoading,
    error,
    mutateFavoriteList,
    pages,
    hasMore,
    incrementSize,
    isValidating,
    hasReachedEnd,
  };
}
