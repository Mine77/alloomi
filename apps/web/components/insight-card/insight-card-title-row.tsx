"use client";

/**
 * Insight card first row: title
 * Uses design tokens: text-foreground, text-muted-foreground
 */

import { cn } from "@/lib/utils";

export interface InsightCardTitleRowProps {
  title: string;
  isUnread: boolean;
}

export function InsightCardTitleRow({
  title,
  isUnread,
}: InsightCardTitleRowProps) {
  return (
    <div className="flex items-start gap-2 w-full min-w-0">
      <h3
        className={cn(
          "mt-1 mb-1 pt-0 text-sm leading-tight line-clamp-2 flex-1 min-w-0",
          isUnread
            ? "font-medium text-foreground"
            : "font-medium text-muted-foreground",
        )}
        title={title}
      >
        {title}
      </h3>
    </div>
  );
}
