"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface FocusedInsightAttachment {
  id: string;
  title: string;
  description?: string | null;
  groups?: string[] | null;
  platform?: string | null;
  details?: any[] | null;
}

/**
 * Focused Insight Badge component displayed inside message bubbles
 * Uses the same styles as FocusedInsightBadges, displayed as a simple badge
 */
export function FocusedInsightAttachment({
  insights,
}: {
  insights: FocusedInsightAttachment[];
}) {
  const { t } = useTranslation();

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {insights.map((insight) => (
        <span
          key={insight.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-[10px] px-3 py-1.5",
            "max-w-[160px] min-w-0",
            "bg-gray-100 dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "text-xs font-medium text-foreground",
          )}
          title={insight.title}
        >
          <span className="truncate flex-1 min-w-0 text-left">
            {insight.title}
          </span>
        </span>
      ))}
    </div>
  );
}
