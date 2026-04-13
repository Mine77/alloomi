"use client";

import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { useChatContext } from "./chat-context";
import { cn } from "@/lib/utils";

/**
 * Focused Insight Badge component displayed inside the input box
 * Displayed as rounded badge, showing only title, width limited to 80px, click to unfocus
 */
export function FocusedInsightBadges() {
  const { t } = useTranslation();
  const { focusedInsights, removeFocusedInsight } = useChatContext();

  if (focusedInsights.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-1">
      {focusedInsights.map((insight) => (
        <button
          key={insight.id}
          type="button"
          onClick={() => removeFocusedInsight(insight.id)}
          className={cn(
            "inline-flex items-center gap-1 rounded-[10px] px-3 py-1.5",
            "max-w-[160px] min-w-0",
            "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
            "border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
            "text-xs font-medium text-foreground",
            "transition-colors cursor-pointer",
            "group",
          )}
          title={insight.title}
          aria-label={t("insight.removeFocus", "Remove this focus")}
        >
          <span className="truncate flex-1 min-w-0 text-left">
            {insight.title}
          </span>
          <RemixIcon
            name="close"
            size="size-3"
            className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
          />
        </button>
      ))}
    </div>
  );
}
