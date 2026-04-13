"use client";

/**
 * Events Panel timeline list sub-component
 * Renders Insight card list grouped by date, unifies card styles and load-more placeholder, reduces duplicate code in main panel
 */

import { InsightCard } from "@/components/insight-card";
import type { Insight } from "@/lib/db/schema";
import { Spinner } from "@/components/spinner";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import "../../i18n";
import type { GroupedInsights } from "./events-panel-utils";

export type EventsPanelTimelineListProps = {
  /** Insights grouped by date */
  groupedInsights: GroupedInsights[];
  /** Currently selected insight (used for highlight) */
  effectiveSelectedInsight: Insight | null;
  /** Callback when selecting an item */
  onSelect: (insight: Insight) => void;
  /** Delete, archive, favorite callbacks */
  onDelete: (insight: Insight) => void;
  onArchive: (insight: Insight) => void;
  onFavorite: (insight: Insight) => void;
  /** Whether includes current user's nickname */
  hasMyNickname: (insight: Insight) => boolean;
  /** Pin to Today's Focus / unpin */
  onPin?: (insight: Insight) => void;
  /** Whether pinned to Today's Focus */
  isPinned?: (insight: Insight) => boolean;
  /** Optimistically updated favorite status */
  getInsightFavorite: (id: string, fallback: boolean) => boolean;
  /** Whether reached the end */
  hasReachedEnd: boolean;
  /** Load more */
  onLoadMore: () => void;
};

/**
 * Render date-grouped Insight list with load-more placeholder
 */
export function EventsPanelTimelineList({
  groupedInsights,
  effectiveSelectedInsight,
  onSelect,
  onDelete,
  onArchive,
  onFavorite,
  hasMyNickname,
  onPin,
  isPinned,
  getInsightFavorite,
  hasReachedEnd,
  onLoadMore,
}: EventsPanelTimelineListProps) {
  const { t } = useTranslation();

  return (
    <div>
      {groupedInsights.map((group) => (
        <div key={group.dateString} className="mb-6 last:mb-0">
          <div className="px-2 pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {group.date}
            </span>
          </div>

          <div className="space-y-0">
            {group.insights.map((item) => (
              <div key={item.id} className="rounded-2xl">
                <InsightCard
                  isSelected={item.id === effectiveSelectedInsight?.id}
                  hasMyNickname={hasMyNickname(item)}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onArchive={onArchive}
                  onFavorite={onFavorite}
                  onPin={onPin}
                  isPinned={isPinned?.(item)}
                  {...item}
                  isFavorited={getInsightFavorite(
                    item.id,
                    item.isFavorited || false,
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <motion.div
        viewport={{ once: true, amount: 0.1, margin: "100px" }}
        onViewportEnter={() => {
          if (!hasReachedEnd) onLoadMore();
        }}
        className="h-10 w-full"
      />
      {!hasReachedEnd && (
        <div className="flex flex-row items-center p-2 text-muted-foreground justify-center">
          <Spinner size={20} />
          <div>{t("common.loading")}</div>
        </div>
      )}
    </div>
  );
}
