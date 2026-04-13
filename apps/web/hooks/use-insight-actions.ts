/**
 * Custom hook for Insight operations
 * Handles state management and handler functions for favorite, archive, delete, understand operations
 */

import { useCallback, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Insight } from "@/lib/db/schema";
import { toast } from "@/components/toast";
import type { InsightResponse } from "@/components/insight-card";
import type { SWRInfiniteKeyedMutator } from "swr/infinite";
import { useInsightCache } from "@/hooks/use-insight-cache";
import { useInsightOptimisticUpdates } from "@/components/insight-optimistic-context";
import { getAuthToken } from "@/lib/auth/token-manager";

/**
 * Return type of Insight Actions hook
 */
interface UseInsightActionsReturn {
  // Operation state
  favoritingIds: Set<string>;
  archivingIds: Set<string>;
  deletingIds: Set<string>;
  understandingIds: Set<string>;
  insightToDelete: Insight | null;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  understandingInsightId: string | null;

  // Operation functions
  handleFavoriteInsight: (insight: Insight) => Promise<void>;
  handleArchiveInsight: (insight: Insight) => Promise<void>;
  handleDeleteInsight: (insight: Insight) => void;
  handleUnderstandInsight: (insight: Insight) => Promise<void>;
  deleteInsight: () => Promise<void>;
  setInsightToDelete: (insight: Insight | null) => void;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setUnderstandingInsightId: (id: string | null) => void;
}

/**
 * Custom hook for Insight operation related functionality
 * @param mutateInsightList - Function to update insight list
 * @param selectedInsight - Currently selected insight
 * @param setSelectedInsight - Function to set selected insight
 * @param setIsDrawerOpen - Function to set drawer open state
 * @returns Insight operation related state and functions
 */
export function useInsightActions(
  mutateInsightList: SWRInfiniteKeyedMutator<InsightResponse[]>,
  selectedInsight: Insight | null,
  setSelectedInsight: (insight: Insight | null) => void,
  setIsDrawerOpen: (open: boolean) => void,
): UseInsightActionsReturn {
  const { t } = useTranslation();

  // Global insight operation utilities
  const { removeFromAllPanels, updateArchiveStatus } = useInsightCache();

  // Global optimistic update management
  const {
    updateInsightFavorite: optimisticUpdateFavorite,
    getInsightFavorite,
    deleteTask: deleteTaskOptimistic,
    addTempTask: addTempTaskOptimistic,
  } = useInsightOptimisticUpdates();

  // Operation state tracking to prevent duplicate clicks
  const favoritingIdsRef = useRef<Set<string>>(new Set());
  const [favoritingIds, setFavoritingIdsState] = useState<Set<string>>(
    new Set(),
  );
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [understandingIds, setUnderstandingIds] = useState<Set<string>>(
    new Set(),
  );

  // Delete functionality related state
  const [insightToDelete, setInsightToDelete] = useState<Insight | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [understandingInsightId, setUnderstandingInsightId] = useState<
    string | null
  >(null);

  /**
   * API call to delete summary
   * Optimistic update + prevent duplicate deletes
   */
  const deleteInsight = useCallback(async () => {
    if (!insightToDelete) return;
    const insightId = insightToDelete.id;

    // Prevent duplicate deletes
    if (deletingIds.has(insightId)) return;
    setDeletingIds((prev) => new Set(prev).add(insightId));
    setIsDeleting(true);

    try {
      // Optimistic update: remove from all panels cache
      await removeFromAllPanels(insightId);

      // Send delete request
      const response = await fetch(`/api/insights/${insightId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete insight");
      }

      setIsDeleteDialogOpen(false);
      toast({
        type: "success",
        description: t("insight.deleteSuccess"),
      });

      if (selectedInsight?.id === insightId) {
        setSelectedInsight(null);
        setIsDrawerOpen(false);
      }
    } catch (error) {
      console.error("Error deleting insight:", error);
      // Request failed: rollback cache, reload data
      await mutateInsightList();
      toast({
        type: "error",
        description: t("insight.deleteError"),
      });
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(insightId);
        return newSet;
      });
      setInsightToDelete(null);
      setIsDeleting(false);
    }
  }, [
    insightToDelete,
    deletingIds,
    mutateInsightList,
    removeFromAllPanels,
    selectedInsight,
    setSelectedInsight,
    setIsDrawerOpen,
    t,
  ]);

  const handleDeleteInsight = useCallback((insight: Insight) => {
    setInsightToDelete(insight);
    setIsDeleteDialogOpen(true);
  }, []);

  /**
   * Understand summary
   * Optimistic update + loading state
   */
  const handleUnderstandInsight = useCallback(
    async (insight: Insight) => {
      if (!insight) return;
      const insightId = insight.id;

      // Prevent duplicate operations
      if (understandingIds.has(insightId)) return;
      setUnderstandingIds((prev) => new Set(prev).add(insightId));
      setUnderstandingInsightId(insightId);

      try {
        // Get cloud auth token (if exists)
        let cloudAuthToken: string | undefined;
        try {
          cloudAuthToken = getAuthToken() || undefined;
        } catch (error) {
          console.error(
            "[InsightActions] Failed to read cloud_auth_token:",
            error,
          );
        }

        const response = await fetch(`/api/insights/${insightId}/understand`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cloudAuthToken }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : typeof payload?.message === "string"
                ? payload.message
                : t(
                    "insightDetail.understandFailure",
                    "Failed to refresh understanding.",
                  );
          throw new Error(message);
        }

        if (payload?.insight) {
          // Optimistic update cache
          await mutateInsightList((currentData) => {
            if (!currentData) return currentData;

            return currentData.map((data) => {
              return {
                ...data,
                items: data.items.filter((item) => item.id !== insightId),
              };
            });
          }, false);
          setSelectedInsight(payload.insight as Insight);
        }

        toast({
          type: "success",
          description: t(
            "insightDetail.understandSuccess",
            "Understanding refreshed.",
          ),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t(
                "insightDetail.understandFailure",
                "Failed to refresh understanding.",
              );
        toast({
          type: "error",
          description: message,
        });
      } finally {
        setUnderstandingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(insightId);
          return newSet;
        });
        setUnderstandingInsightId(null);
      }
    },
    [t, mutateInsightList, setSelectedInsight, understandingIds],
  );

  /**
   * Archive or unarchive Insight
   * Optimistic update + prevent duplicate clicks
   */
  const handleArchiveInsight = useCallback(
    async (insight: Insight) => {
      const insightId = insight.id;
      const isCurrentlyArchived = insight.isArchived || false;
      const newArchivedState = !isCurrentlyArchived;

      // Prevent duplicate operations
      if (archivingIds.has(insightId)) return;
      setArchivingIds((prev) => new Set(prev).add(insightId));

      // Save original state for error rollback
      const originalArchivedState = isCurrentlyArchived;
      const originalArchivedAt = insight.archivedAt;
      const newArchivedAt = newArchivedState ? new Date() : null;

      try {
        // Optimistic update: update archive status in all panels cache
        await updateArchiveStatus(insightId, newArchivedState, newArchivedAt);

        // Immediately update currently selected insight state to ensure state sync
        if (selectedInsight?.id === insightId) {
          setSelectedInsight({
            ...selectedInsight,
            isArchived: newArchivedState,
            archivedAt: newArchivedAt,
          });
        }

        // Send archive request
        const response = await fetch(`/api/insights/${insightId}/archive`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ archived: newArchivedState }),
        });

        if (!response.ok) {
          throw new Error("Failed to archive insight");
        }

        // Get response data to display completed task count
        const payload = await response.json().catch(() => ({}));
        const completedCount = payload?.data?.completedCount ?? 0;

        toast({
          type: "success",
          description: newArchivedState
            ? completedCount > 0
              ? t("insight.muteWithTasksSuccess", {
                  count: completedCount,
                })
              : t("insight.muteSuccess")
            : t("insight.unmuteSuccess"),
        });

        // If currently selected insight is archived, close drawer
        if (selectedInsight?.id === insightId && newArchivedState) {
          setSelectedInsight(null);
          setIsDrawerOpen(false);
        }

        // Refresh cache to ensure archive list can see updates
        await mutateInsightList();
      } catch (error) {
        console.error("Error archiving insight:", error);

        // Request failed: rollback cache, restore original state
        await updateArchiveStatus(
          insightId,
          originalArchivedState,
          originalArchivedAt,
        );

        // If currently selected insight is rolled back, sync restore its state
        if (selectedInsight?.id === insightId) {
          setSelectedInsight({
            ...selectedInsight,
            isArchived: originalArchivedState,
            archivedAt: originalArchivedAt,
          });
        }

        toast({
          type: "error",
          description: t("insight.muteError"),
        });
      } finally {
        setArchivingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(insightId);
          return newSet;
        });
      }
    },
    [
      t,
      mutateInsightList,
      updateArchiveStatus,
      selectedInsight,
      setSelectedInsight,
      setIsDrawerOpen,
      archivingIds,
    ],
  );

  /**
   * Favorite or unfavorite Insight
   * Use global optimistic update + direct API call
   */
  const handleFavoriteInsight = useCallback(
    async (insight: Insight) => {
      const insightId = insight.id;
      console.log(
        "[handleFavoriteInsight] START - insightId:",
        insightId,
        "insight.isFavorited:",
        insight.isFavorited,
      );

      // Use Context's optimistic value to determine current state
      const isCurrentlyFavorited = getInsightFavorite(
        insightId,
        insight.isFavorited || false,
      );
      const newFavoritedState = !isCurrentlyFavorited;

      console.log(
        "[handleFavoriteInsight] isCurrentlyFavorited:",
        isCurrentlyFavorited,
        "newFavoritedState:",
        newFavoritedState,
      );

      // Prevent duplicate operations (check using ref)
      if (favoritingIdsRef.current.has(insightId)) {
        console.log(
          "[handleFavoriteInsight] Already favoriting, skipping. Current favoritingIds:",
          Array.from(favoritingIdsRef.current),
        );
        return;
      }
      console.log(
        "[handleFavoriteInsight] Adding",
        insightId,
        "to favoritingIds",
      );
      // Update ref and state
      favoritingIdsRef.current.add(insightId);
      setFavoritingIdsState(new Set(favoritingIdsRef.current));
      console.log(
        "[handleFavoriteInsight] Added to favoritingIds, now:",
        Array.from(favoritingIdsRef.current),
      );

      try {
        // Update selectedInsight first to ensure subsequent flow uses latest state
        if (selectedInsight?.id === insightId) {
          if (newFavoritedState) {
            setSelectedInsight({
              ...selectedInsight,
              isFavorited: newFavoritedState,
            });
          } else {
            // Close drawer when unfavoriting
            setSelectedInsight(null);
            setIsDrawerOpen(false);
          }
        }

        // Use global optimistic update
        await optimisticUpdateFavorite(
          insightId,
          newFavoritedState,
          async () => {
            // Directly call API
            const response = await fetch(
              `/api/insights/${insightId}/favorite`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ favorited: newFavoritedState }),
              },
            );

            if (!response.ok) {
              throw new Error("Failed to update favorite status");
            }

            // Show success message
            toast({
              type: "success",
              description: newFavoritedState
                ? t("insight.favoriteSuccess", "Favorited")
                : t("insight.unfavoriteSuccess", "Unfavorited"),
            });
          },
        );

        // After API success, dispatch global event to notify other components (e.g., drawer) to update state
        window.dispatchEvent(
          new CustomEvent("insightFavoriteChanged", {
            detail: { insightId, isFavorited: newFavoritedState },
          }),
        );

        console.log(
          "[handleFavoriteInsight] Completed successfully, keeping optimistic update",
        );
      } catch (error) {
        console.error("[handleFavoriteInsight] Error:", error);

        // If failed, dispatch global event to notify drawer to rollback state
        window.dispatchEvent(
          new CustomEvent("insightFavoriteChanged", {
            detail: { insightId, isFavorited: isCurrentlyFavorited },
          }),
        );

        // Show error message
        toast({
          type: "error",
          description: t(
            "insight.favoriteError",
            "Operation failed, please try again",
          ),
        });
      } finally {
        console.log(
          "[handleFavoriteInsight] Finally block - removing",
          insightId,
          "from favoritingIds",
        );
        favoritingIdsRef.current.delete(insightId);
        setFavoritingIdsState(new Set(favoritingIdsRef.current));
        console.log(
          "[handleFavoriteInsight] Removed from favoritingIds, remaining:",
          Array.from(favoritingIdsRef.current),
        );
      }
    },
    [
      optimisticUpdateFavorite,
      getInsightFavorite,
      selectedInsight,
      setSelectedInsight,
      setIsDrawerOpen,
      t,
    ],
  );

  return {
    favoritingIds,
    archivingIds,
    deletingIds,
    understandingIds,
    insightToDelete,
    isDeleteDialogOpen,
    isDeleting,
    understandingInsightId,
    handleFavoriteInsight,
    handleArchiveInsight,
    handleDeleteInsight,
    handleUnderstandInsight,
    deleteInsight,
    setInsightToDelete,
    setIsDeleteDialogOpen,
    setUnderstandingInsightId,
  };
}
