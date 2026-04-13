/**
 * Custom hook for batch Insight operations
 * Supports optimistic updates for batch favorite, archive, delete, unpin operations
 */

import { useCallback, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Insight } from "@/lib/db/schema";
import type { InsightResponse } from "@/components/insight-card/insight-card-types";
import { toast } from "@/components/toast";
import type { SWRInfiniteKeyedMutator } from "swr/infinite";
import { useInsightCache } from "@/hooks/use-insight-cache";
import { useInsightOptimisticUpdates } from "@/components/insight-optimistic-context";

/**
 * Batch operation type
 */
type BatchOperationType =
  | "archive"
  | "unarchive"
  | "favorite"
  | "unfavorite"
  | "delete"
  | "unpin"
  | "importance";

/**
 * Return value of batch operation Hook
 */
interface UseBatchInsightActionsReturn {
  // Operation state
  processingIds: Set<string>;
  selectedIds: Set<string>;
  isSelectionMode: boolean;

  // Selection operations
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectAllInCategory: (insights: Insight[]) => void;
  toggleSelectionMode: () => void;
  setSelectedIds: (ids: Set<string>) => void;

  // Batch operation functions
  batchArchive: (ids: string[], archived: boolean) => Promise<void>;
  batchFavorite: (ids: string[], favorited: boolean) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
  batchUnpin: (ids: string[]) => Promise<void>;
  batchUpdateImportance: (
    ids: string[],
    importance: "low" | "medium" | "high",
  ) => Promise<void>;

  // Convenience methods
  archiveSelected: () => Promise<void>;
  favoriteSelected: () => Promise<void>;
  unfavoriteSelected: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  unpinSelected: () => Promise<void>;
}

/**
 * Batch Insight operations Hook
 * @param mutateInsightList - Function to update insight list
 * @returns State and functions related to batch operations
 */
export function useBatchInsightActions(
  mutateInsightList?: SWRInfiniteKeyedMutator<InsightResponse[]>,
): UseBatchInsightActionsReturn {
  const { t } = useTranslation();

  // Global insight operation utilities
  const { removeFromAllPanels, updateArchiveStatus } = useInsightCache();

  // Global optimistic update management
  const { updateInsightFavorite: optimisticUpdateFavorite } =
    useInsightOptimisticUpdates();

  // Selected ID set
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Whether in selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Currently processing ID set
  const processingIdsRef = useRef<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  /**
   * Toggle selection status of a single ID
   */
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  /**
   * Select all specified IDs
   */
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Select all insights in the specified category
   */
  const selectAllInCategory = useCallback((insights: Insight[]) => {
    setSelectedIds(new Set(insights.map((i) => i.id)));
  }, []);

  /**
   * Toggle selection mode
   */
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // Clear selection when exiting selection mode
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  /**
   * Add IDs to processing set
   */
  const addToProcessing = useCallback((ids: string[]) => {
    const newSet = new Set(processingIdsRef.current);
    ids.forEach((id) => newSet.add(id));
    processingIdsRef.current = newSet;
    setProcessingIds(new Set(newSet));
  }, []);

  /**
   * Remove IDs from processing set
   */
  const removeFromProcessing = useCallback((ids: string[]) => {
    const newSet = new Set(processingIdsRef.current);
    ids.forEach((id) => newSet.delete(id));
    processingIdsRef.current = newSet;
    setProcessingIds(new Set(newSet));
  }, []);

  /**
   * Batch archive/unarchive
   */
  const batchArchive = useCallback(
    async (ids: string[], archived: boolean) => {
      if (ids.length === 0) return;

      addToProcessing(ids);
      const now = new Date();

      try {
        // Optimistic update: update archive status in all panel caches
        await Promise.all(
          ids.map((id) =>
            updateArchiveStatus(id, archived, archived ? now : null),
          ),
        );

        // Send batch archive request
        const response = await fetch(`/api/insights/batch/archive`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids, archived }),
        });

        if (!response.ok) {
          throw new Error("Failed to batch archive insights");
        }

        // Trigger global event
        window.dispatchEvent(
          new CustomEvent("insightsBatchArchived", {
            detail: { ids, archived },
          }),
        );

        toast({
          type: "success",
          description: archived
            ? t("insight.batchArchiveSuccess", {
                count: ids.length,
                defaultValue: `${ids.length} items archived`,
              })
            : t("insight.batchUnarchiveSuccess", {
                count: ids.length,
                defaultValue: `${ids.length} items unarchived`,
              }),
        });

        // Refresh list
        if (mutateInsightList) {
          await mutateInsightList();
        }
      } catch (error) {
        console.error("Error batch archiving insights:", error);

        // Request failed: rollback cache
        await Promise.all(
          ids.map((id) =>
            updateArchiveStatus(id, !archived, !archived ? null : now),
          ),
        );

        toast({
          type: "error",
          description: t(
            "insight.batchArchiveError",
            "Batch operation failed, please try again",
          ),
        });
      } finally {
        removeFromProcessing(ids);
      }
    },
    [
      addToProcessing,
      removeFromProcessing,
      mutateInsightList,
      t,
      updateArchiveStatus,
    ],
  );

  /**
   * Batch favorite/unfavorite
   */
  const batchFavorite = useCallback(
    async (ids: string[], favorited: boolean) => {
      if (ids.length === 0) return;

      addToProcessing(ids);

      try {
        // Optimistic update: update favorite status in all panel caches
        await Promise.all(
          ids.map((id) =>
            optimisticUpdateFavorite(id, favorited, async () => {}),
          ),
        );

        // Send batch favorite request
        const response = await fetch(`/api/insights/batch/favorite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids, favorited }),
        });

        if (!response.ok) {
          throw new Error("Failed to batch favorite insights");
        }

        // Trigger global event
        window.dispatchEvent(
          new CustomEvent("insightsBatchFavorited", {
            detail: { ids, favorited },
          }),
        );

        toast({
          type: "success",
          description: favorited
            ? t("insight.batchFavoriteSuccess", {
                count: ids.length,
                defaultValue: `${ids.length} items favorited`,
              })
            : t("insight.batchUnfavoriteSuccess", {
                count: ids.length,
                defaultValue: `${ids.length} items unfavorited`,
              }),
        });

        // Refresh list
        if (mutateInsightList) {
          await mutateInsightList();
        }
      } catch (error) {
        console.error("Error batch favoriting insights:", error);

        // Trigger rollback event
        window.dispatchEvent(
          new CustomEvent("insightsBatchFavorited", {
            detail: { ids, favorited: !favorited },
          }),
        );

        toast({
          type: "error",
          description: t(
            "insight.batchFavoriteError",
            "Batch operation failed, please try again",
          ),
        });
      } finally {
        removeFromProcessing(ids);
      }
    },
    [
      addToProcessing,
      removeFromProcessing,
      mutateInsightList,
      t,
      optimisticUpdateFavorite,
    ],
  );

  /**
   * Batch delete
   */
  const batchDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;

      addToProcessing(ids);

      try {
        // Optimistic update: remove from all panel caches
        await Promise.all(ids.map((id) => removeFromAllPanels(id)));

        // Send batch delete request
        const response = await fetch(`/api/insights/batch/delete`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });

        if (!response.ok) {
          throw new Error("Failed to batch delete insights");
        }

        // Trigger global event
        window.dispatchEvent(
          new CustomEvent("insightsBatchDeleted", {
            detail: { ids },
          }),
        );

        toast({
          type: "success",
          description: t("insight.batchDeleteSuccess", {
            count: ids.length,
            defaultValue: `${ids.length} items deleted`,
          }),
        });

        // Clear selection
        clearSelection();

        // Refresh list
        if (mutateInsightList) {
          await mutateInsightList();
        }
      } catch (error) {
        console.error("Error batch deleting insights:", error);

        // Request failed: rollback cache
        if (mutateInsightList) {
          await mutateInsightList();
        }

        toast({
          type: "error",
          description: t(
            "insight.batchDeleteError",
            "Batch operation failed, please try again",
          ),
        });
      } finally {
        removeFromProcessing(ids);
      }
    },
    [
      addToProcessing,
      removeFromProcessing,
      mutateInsightList,
      t,
      removeFromAllPanels,
      clearSelection,
    ],
  );

  /**
   * Batch unpin (remove from Brief panel)
   */
  const batchUnpin = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;

      addToProcessing(ids);

      try {
        // Send batch unpin request
        const response = await fetch(`/api/insights/batch/unpin`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });

        if (!response.ok) {
          throw new Error("Failed to batch unpin insights");
        }

        // Trigger global event
        window.dispatchEvent(
          new CustomEvent("insightsBatchUnpinned", {
            detail: { ids },
          }),
        );

        toast({
          type: "success",
          description: t("insight.batchUnpinSuccess", {
            count: ids.length,
            defaultValue: `${ids.length} items removed from Today's Focus`,
          }),
        });

        // Refresh list
        if (mutateInsightList) {
          await mutateInsightList();
        }
      } catch (error) {
        console.error("Error batch unpinning insights:", error);

        toast({
          type: "error",
          description: t(
            "insight.batchUnpinError",
            "Batch operation failed, please try again",
          ),
        });
      } finally {
        removeFromProcessing(ids);
      }
    },
    [addToProcessing, removeFromProcessing, mutateInsightList, t],
  );

  /**
   * Batch update importance
   */
  const batchUpdateImportance = useCallback(
    async (ids: string[], importance: "low" | "medium" | "high") => {
      if (ids.length === 0) return;

      addToProcessing(ids);

      try {
        // Send batch update importance request
        const response = await fetch(`/api/insights/batch/importance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids, importance }),
        });

        if (!response.ok) {
          throw new Error("Failed to batch update importance");
        }

        // Trigger global event
        window.dispatchEvent(
          new CustomEvent("insightsBatchImportanceUpdated", {
            detail: { ids, importance },
          }),
        );

        toast({
          type: "success",
          description: t("insight.batchImportanceSuccess", {
            count: ids.length,
            defaultValue: `${ids.length} items importance updated`,
          }),
        });

        // Refresh list
        if (mutateInsightList) {
          await mutateInsightList();
        }
      } catch (error) {
        console.error("Error batch updating importance:", error);

        toast({
          type: "error",
          description: t(
            "insight.batchImportanceError",
            "Batch operation failed, please try again",
          ),
        });
      } finally {
        removeFromProcessing(ids);
      }
    },
    [addToProcessing, removeFromProcessing, mutateInsightList, t],
  );

  // Convenience methods: execute operations on selected items
  const archiveSelected = useCallback(async () => {
    await batchArchive(Array.from(selectedIds), true);
  }, [selectedIds, batchArchive]);

  const favoriteSelected = useCallback(async () => {
    await batchFavorite(Array.from(selectedIds), true);
  }, [selectedIds, batchFavorite]);

  const unfavoriteSelected = useCallback(async () => {
    await batchFavorite(Array.from(selectedIds), false);
  }, [selectedIds, batchFavorite]);

  const deleteSelected = useCallback(async () => {
    await batchDelete(Array.from(selectedIds));
  }, [selectedIds, batchDelete]);

  const unpinSelected = useCallback(async () => {
    await batchUnpin(Array.from(selectedIds));
  }, [selectedIds, batchUnpin]);

  return {
    processingIds,
    selectedIds,
    isSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    selectAllInCategory,
    toggleSelectionMode,
    setSelectedIds,
    batchArchive,
    batchFavorite,
    batchDelete,
    batchUnpin,
    batchUpdateImportance,
    archiveSelected,
    favoriteSelected,
    unfavoriteSelected,
    deleteSelected,
    unpinSelected,
  };
}
