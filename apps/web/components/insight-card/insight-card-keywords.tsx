"use client";

/**
 * Insight card third row: tags (keywords) + time
 * Uses design tokens: bg-surface-muted, text-muted-foreground
 */

import { RemixIcon } from "@/components/remix-icon";

export interface InsightCardKeywordsProps {
  topKeywords: string[];
  /** Time text; displayed at the end of the row if present */
  timeDisplay?: string;
}

export function InsightCardKeywords({
  topKeywords,
  timeDisplay,
}: InsightCardKeywordsProps) {
  const hasKeywords = topKeywords && topKeywords.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        {hasKeywords && (
          <div className="flex flex-wrap items-center gap-1">
            {topKeywords.slice(0, 3).map((keyword, index) => (
              <span
                key={`keyword-${index}-${keyword}`}
                className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground max-w-[80px] min-w-0"
              >
                <RemixIcon name="hashtag" size="size-3" className="shrink-0" />
                <span className="truncate min-w-0">{keyword}</span>
              </span>
            ))}
            {topKeywords.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                +{topKeywords.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      {timeDisplay && (
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {timeDisplay}
        </span>
      )}
    </div>
  );
}
