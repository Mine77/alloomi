/**
 * Custom hook for Insight grouping
 * Includes logic for grouping by date, etc.
 */

import { useMemo } from "react";
import { groupInsightsByDay } from "@/components/agent/events-panel-utils";
import type { GroupedInsights } from "@/components/agent/events-panel-utils";
import type { Insight } from "@/lib/db/schema";

/**
 * Parameters for Insight grouping Hook
 */
interface UseInsightGroupingParams {
  insights: Insight[];
  language: string;
}

/**
 * Return value of Insight grouping Hook
 */
interface UseInsightGroupingReturn {
  groupedInsights: GroupedInsights[];
}

/**
 * Custom hook for Insight grouping
 * @param params - Hook parameters
 * @returns Grouped data
 */
export function useInsightGrouping({
  insights,
  language,
}: UseInsightGroupingParams): UseInsightGroupingReturn {
  const groupedInsights = useMemo(
    () => groupInsightsByDay(insights, language),
    [insights, language],
  );

  return {
    groupedInsights,
  };
}
