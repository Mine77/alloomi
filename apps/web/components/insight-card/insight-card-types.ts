/**
 * Insight card component types and exports
 */

import type { Insight } from "@/lib/db/schema";
import type { InsightFilterSummary } from "@/lib/insights/filter-schema";

export interface InsightCardProps extends Insight {
  isSelected: boolean;
  isChecked?: boolean;
  isFocused?: boolean;
  isCheckDisabled?: boolean;
  isFocusDisabled?: boolean;
  onToggleCheck?: (
    insightId: string,
    checked: boolean,
    insight?: Insight,
  ) => void;
  onToggleFocus?: (insight: Insight) => void;
  hasMyNickname?: boolean;
  onMarkAsRead?: () => void;
  onSelect?: (insight: Insight) => void;
  onDelete?: (insight: Insight) => void;
  onArchive?: (insight: Insight) => void;
  onFavorite?: (insight: Insight) => void;
  isFavoriting?: boolean;
  /** Pin to today's focus / Unpin */
  onPin?: (insight: Insight) => void;
  isPinned?: boolean;
}

export type InsightOverlayMeta = {
  role: string;
  name: string;
  priority: number;
  fieldToggles: Record<string, boolean>;
};

export type InsightSessionResult = {
  id: string;
  msgCount?: number;
  platform?: string;
  status?: "initializing" | "fetching" | "insighting" | "finished";
};

export type InsightPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
};

export type InsightResponse = {
  items: Insight[];
  percent: number | null;
  sessions?: InsightSessionResult[];
  roles?: string[];
  overlays?: InsightOverlayMeta[];
  filter?: InsightFilterSummary;
  hasMore: boolean;
};
