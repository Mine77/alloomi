/**
 * Global Insight operations utility
 * Provides unified utility functions and Hooks to update SWR cache across all panels
 * Supports optimistic updates for favorite, archive, delete, and other operations
 */

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { useTranslation } from "react-i18next";
import type { SWRInfiniteKeyedMutator } from "swr/infinite";
import type { Insight } from "@/lib/db/schema";
import type { InsightResponse } from "@/components/insight-card";
import type {
  InsightTaskItem,
  DetailData,
  TimelineData,
} from "@/lib/ai/subagents/insights";
import { toast } from "@/components/toast";
import { useInsightOptimisticUpdates } from "@/components/insight-optimistic-context";

// ============================================================================
// Helper functions: Cache Key matching
// ============================================================================

/**
 * Check if the cache key is for the favorites panel
 */
function isFavoriteCacheKey(key: unknown): boolean {
  if (typeof key === "string") {
    return key.includes("/api/insights/favorites");
  }
  if (Array.isArray(key) && key.length > 0 && key[0]) {
    const firstKey = key[0];
    if (typeof firstKey === "string") {
      return firstKey.includes("/api/insights/favorites");
    }
    if (Array.isArray(firstKey) && firstKey.length > 0) {
      const innerKey = firstKey[0];
      if (typeof innerKey === "string") {
        return innerKey.includes("/api/insights/favorites");
      }
    }
  }
  return false;
}

/**
 * Check if the cache key is for the insights API (excluding favorites panel)
 * Supports string, array, and function types of key (SWR Infinite)
 */
function isInsightsApiCacheKey(key: unknown): boolean {
  // String type key
  if (typeof key === "string") {
    return key.startsWith("/api/insights") && !key.includes("/favorites");
  }

  // Array type key (SWR Infinite format)
  if (Array.isArray(key) && key.length > 0) {
    const firstKey = key[0];

    // First element is string
    if (typeof firstKey === "string") {
      return (
        firstKey.startsWith("/api/insights") && !firstKey.includes("/favorites")
      );
    }

    // Nested array
    if (Array.isArray(firstKey) && firstKey.length > 0) {
      const innerKey = firstKey[0];
      if (typeof innerKey === "string") {
        return (
          innerKey.startsWith("/api/insights") &&
          !innerKey.includes("/favorites")
        );
      }
    }
  }

  // Function type key (SWR Infinite uses function as key)
  if (typeof key === "function") {
    return true;
  }

  // Object type key (SWR Infinite may use object as key)
  if (typeof key === "object" && key !== null) {
    const obj = key as Record<string, unknown>;
    if ("toString" in obj && typeof obj.toString === "function") {
      const keyStr = obj.toString();
      if (
        typeof keyStr === "string" &&
        keyStr.includes("getTodoPaginationKey")
      ) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Helper functions: Data updates
// ============================================================================

/**
 * Remove insight from list
 */
function removeInsightFromList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    // Multi-page data (SWR Infinite)
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.filter((item) => item.id !== insightId),
      };
    });
  } else {
    // Single page data
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.filter((item) => item.id !== insightId),
    };
  }
}

/**
 * Update archive status of insight in list
 */
function updateInsightArchiveStatusInList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  isArchived: boolean,
  archivedAt: Date | null,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) =>
          item.id === insightId ? { ...item, isArchived, archivedAt } : item,
        ),
      };
    });
  } else {
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) =>
        item.id === insightId ? { ...item, isArchived, archivedAt } : item,
      ),
    };
  }
}

/**
 * Update favorite status of a single Insight page
 */
function updateInsightPageFavoriteStatus(
  page: InsightResponse | undefined,
  insightId: string,
  isFavorited: boolean,
  fullInsight: Insight | null,
  isFavoritePanel: boolean,
): InsightResponse | undefined {
  if (!page || !page.items) return page;

  const existingItemIndex = page.items.findIndex(
    (item) => item.id === insightId,
  );

  if (existingItemIndex >= 0) {
    // Insight already exists
    if (isFavorited) {
      // Favoriting: update status
      return {
        ...page,
        items: page.items.map((item) =>
          item.id === insightId ? { ...item, isFavorited } : item,
        ),
      };
    } else if (isFavoritePanel) {
      // Unfavoriting and is favorite panel: remove from list
      return {
        ...page,
        items: page.items.filter((item) => item.id !== insightId),
      };
    } else {
      // Unfavoriting but not favorite panel: only update status
      return {
        ...page,
        items: page.items.map((item) =>
          item.id === insightId ? { ...item, isFavorited } : item,
        ),
      };
    }
  } else if (isFavorited && fullInsight && isFavoritePanel) {
    // Insight does not exist, being favorited, and is favorite panel, add to top of favorite list
    console.log(
      "[GlobalInsightOps] Adding insight to favorite panel:",
      insightId,
    );
    return {
      ...page,
      items: [{ ...fullInsight, isFavorited: true }, ...page.items],
    };
  }

  return page;
}

/**
 * Update favorite status of Insight list (may be single or multi-page)
 */
function updateInsightFavoriteStatusInList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  isFavorited: boolean,
  cacheKey: unknown,
  fullInsight: Insight | null,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  // Determine if this is a favorite panel cache
  const isFavoritePanel = isFavoriteCacheKey(cacheKey);

  console.log(
    "[GlobalInsightOps] isFavoritePanel:",
    isFavoritePanel,
    "for key:",
    cacheKey,
  );

  // Determine if this is single-page or multi-page data
  if (Array.isArray(data)) {
    // Multi-page data (SWR Infinite)
    return data
      .map((page) =>
        updateInsightPageFavoriteStatus(
          page,
          insightId,
          isFavorited,
          fullInsight,
          isFavoritePanel,
        ),
      )
      .filter((page): page is InsightResponse => page !== undefined);
  } else {
    // Single page data
    return updateInsightPageFavoriteStatus(
      data,
      insightId,
      isFavorited,
      fullInsight,
      isFavoritePanel,
    );
  }
}

/**
 * Add task to Insight
 */
function addTaskToList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  bucketKey: "myTasks" | "waitingForMe" | "waitingForOthers",
  task: InsightTaskItem,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) => {
          if (item.id === insightId) {
            const bucket = item[bucketKey] || [];
            return {
              ...item,
              [bucketKey]: [...bucket, task],
            };
          }
          return item;
        }),
      };
    });
  } else {
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        if (item.id === insightId) {
          const bucket = item[bucketKey] || [];
          return {
            ...item,
            [bucketKey]: [...bucket, task],
          };
        }
        return item;
      }),
    };
  }
}

/**
 * Remove task from Insight
 */
function removeTaskFromList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  storageKey: string,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) => {
          if (item.id === insightId) {
            return {
              ...item,
              myTasks: (item.myTasks || []).filter((t) => t.id !== storageKey),
              waitingForMe: (item.waitingForMe || []).filter(
                (t) => t.id !== storageKey,
              ),
              waitingForOthers: (item.waitingForOthers || []).filter(
                (t) => t.id !== storageKey,
              ),
            };
          }
          return item;
        }),
      };
    });
  } else {
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        if (item.id === insightId) {
          return {
            ...item,
            myTasks: (item.myTasks || []).filter((t) => t.id !== storageKey),
            waitingForMe: (item.waitingForMe || []).filter(
              (t) => t.id !== storageKey,
            ),
            waitingForOthers: (item.waitingForOthers || []).filter(
              (t) => t.id !== storageKey,
            ),
          };
        }
        return item;
      }),
    };
  }
}

/**
 * Update task status in Insight
 */
function updateTaskStatusInList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  storageKey: string,
  bucketKey: "myTasks" | "waitingForMe" | "waitingForOthers",
  isCompleted: boolean,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) => {
          if (item.id === insightId) {
            // Update task status in the specified bucket
            const bucket = item[bucketKey] || [];
            const updatedBucket = bucket.map((task) => {
              if (task.id === storageKey) {
                return {
                  ...task,
                  status: isCompleted ? "completed" : "pending",
                };
              }
              return task;
            });
            return {
              ...item,
              [bucketKey]: updatedBucket,
            };
          }
          return item;
        }),
      };
    });
  } else {
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        if (item.id === insightId) {
          const bucket = item[bucketKey] || [];
          const updatedBucket = bucket.map((task) => {
            if (task.id === storageKey) {
              return {
                ...task,
                status: isCompleted ? "completed" : "pending",
              };
            }
            return task;
          });
          return {
            ...item,
            [bucketKey]: updatedBucket,
          };
        }
        return item;
      }),
    };
  }
}

/**
 * Update Insight categories
 */
function updateInsightCategoriesInList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  categories: string[] | null,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) =>
          item.id === insightId
            ? { ...item, categories: categories ?? null }
            : item,
        ),
      } as any;
    });
  }
  if (!data.items) return data;
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === insightId
        ? { ...item, categories: categories ?? null }
        : item,
    ),
  } as any;
}

/**
 * Update task content in Insight
 */
function updateTaskInList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  storageKey: string,
  updates: Partial<InsightTaskItem>,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) => {
          if (item.id === insightId) {
            const updateBucket = (
              bucket: InsightTaskItem[] | null | undefined,
            ) => {
              if (!bucket) return bucket;
              return bucket.map((task) => {
                if (task.id === storageKey) {
                  return { ...task, ...updates };
                }
                return task;
              });
            };
            return {
              ...item,
              myTasks: updateBucket(item.myTasks ?? undefined),
              waitingForMe: updateBucket(item.waitingForMe ?? undefined),
              waitingForOthers: updateBucket(
                item.waitingForOthers ?? undefined,
              ),
            };
          }
          return item;
        }),
      } as any;
    });
  } else {
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        if (item.id === insightId) {
          const updateBucket = (
            bucket: InsightTaskItem[] | null | undefined,
          ) => {
            if (!bucket) return bucket;
            return bucket.map((task) => {
              if (task.id === storageKey) {
                return { ...task, ...updates };
              }
              return task;
            });
          };
          return {
            ...item,
            myTasks: updateBucket(item.myTasks ?? undefined),
            waitingForMe: updateBucket(item.waitingForMe ?? undefined),
            waitingForOthers: updateBucket(item.waitingForOthers ?? undefined),
          };
        }
        return item;
      }),
    } as any;
  }
}

/**
 * Add reply to Insight details and timeline
 */
function addReplyToList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  detail: DetailData,
  timeline: TimelineData,
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) => {
          if (item.id === insightId) {
            return {
              ...item,
              details: [...(item.details || []), detail],
              timeline: [...(item.timeline || []), timeline],
            };
          }
          return item;
        }),
      };
    });
  } else {
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        if (item.id === insightId) {
          return {
            ...item,
            details: [...(item.details || []), detail],
            timeline: [...(item.timeline || []), timeline],
          };
        }
        return item;
      }),
    };
  }
}

/**
 * Move task in Insight to another bucket
 */
function moveTaskInList(
  data: InsightResponse | InsightResponse[] | undefined,
  insightId: string,
  storageKey: string,
  fromBucket: "myTasks" | "waitingForMe" | "waitingForOthers",
  toBucket: "myTasks" | "waitingForMe" | "waitingForOthers",
): InsightResponse | InsightResponse[] | undefined {
  if (!data) return data;

  if (Array.isArray(data)) {
    // Multi-page data (SWR Infinite)
    return data.map((page) => {
      if (!page.items) return page;
      return {
        ...page,
        items: page.items.map((item) => {
          if (item.id === insightId) {
            // Find the task and move it
            const fromBucketTasks = item[fromBucket] || [];
            const taskToMove = fromBucketTasks.find((t) => t.id === storageKey);

            if (!taskToMove) {
              // Task is not in the source bucket, return original data
              return item;
            }

            return {
              ...item,
              [fromBucket]: fromBucketTasks.filter((t) => t.id !== storageKey),
              [toBucket]: [...(item[toBucket] || []), taskToMove],
            };
          }
          return item;
        }),
      };
    });
  } else {
    // Single page data
    if (!data.items) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        if (item.id === insightId) {
          // Find the task and move it
          const fromBucketTasks = item[fromBucket] || [];
          const taskToMove = fromBucketTasks.find((t) => t.id === storageKey);

          if (!taskToMove) {
            // Task is not in the source bucket, return original data
            return item;
          }

          return {
            ...item,
            [fromBucket]: fromBucketTasks.filter((t) => t.id !== storageKey),
            [toBucket]: [...(item[toBucket] || []), taskToMove],
          };
        }
        return item;
      }),
    };
  }
}

// ============================================================================
// Global Insight Operations Hook
// ============================================================================

/**
 * Return value of the Global Insight Operations Hook
 */
interface UseInsightCachesReturn {
  /**
   * Update archive status of the specified insight in all panels
   */
  updateArchiveStatus: (
    insightId: string,
    isArchived: boolean,
    archivedAt: Date | null,
  ) => Promise<void>;

  /**
   * Remove the specified insight from all panels
   */
  removeFromAllPanels: (insightId: string) => Promise<void>;

  /**
   * Favorite or unfavorite an Insight
   */
  favoriteInsight: (insight: Insight) => Promise<void>;

  /**
   * Check if the specified Insight is currently being favorited
   */
  isFavoriting: (insightId: string) => boolean;

  /**
   * Update task status of the specified insight in all panels
   */
  updateTaskStatus: (
    insightId: string,
    storageKey: string,
    bucketKey: "myTasks" | "waitingForMe" | "waitingForOthers",
    isCompleted: boolean,
  ) => Promise<void>;

  /**
   * Update task content of the specified insight in all panels
   */
  updateTask: (
    insightId: string,
    storageKey: string,
    updates: Partial<InsightTaskItem>,
  ) => Promise<void>;

  /**
   * Remove task from the specified insight in all panels
   */
  removeTask: (insightId: string, storageKey: string) => Promise<void>;

  /**
   * Add task to the specified insight in all panels
   */
  addTask: (
    insightId: string,
    bucketKey: "myTasks" | "waitingForMe" | "waitingForOthers",
    task: InsightTaskItem,
  ) => Promise<void>;

  /**
   * Move task to another bucket
   */
  moveTask: (
    insightId: string,
    storageKey: string,
    fromBucket: "myTasks" | "waitingForMe" | "waitingForOthers",
    toBucket: "myTasks" | "waitingForMe" | "waitingForOthers",
  ) => Promise<void>;

  /**
   * Update categories of the specified insight in all panels
   */
  updateCategories: (insightId: string, categories: string[]) => Promise<void>;

  /**
   * Add reply to the specified insight in all panels
   */
  addReply: (
    insightId: string,
    detail: DetailData,
    timeline: TimelineData,
  ) => Promise<void>;

  /**
   * Get cached detail and timeline for an insight
   */
  getInsightReply: (
    insightId: string,
  ) => { details: DetailData[]; timelines: TimelineData[] } | undefined;
}

/**
 * Parameters of the Global Insight Operations Hook
 */
interface UseInsightCacheParams {
  /**
   * Favorite panel's mutate function (optional)
   * If provided, will be used to update the favorite panel cache
   */
  mutateFavoriteList?: SWRInfiniteKeyedMutator<InsightResponse[]>;
}

/**
 * Global Insight Operations Hook
 * Provides unified utility functions to update cache across all panels
 *
 * @example
 * ```tsx
 * // Usage in panels
 * const { updateArchiveStatus, removeFromAllPanels, favoriteInsight, isFavoriting } = useGlobalInsightOperations();
 *
 * // Usage in favorites panel (provide mutateFavoriteList for better performance)
 * const { favoriteInsight } = useGlobalInsightOperations({ mutateFavoriteList });
 * ```
 */
export function useInsightCache(
  params?: UseInsightCacheParams,
): UseInsightCachesReturn {
  const { t } = useTranslation();
  const { mutate, cache } = useSWRConfig();
  const { mutateFavoriteList } = params || {};

  // Global optimistic update management
  const { updateInsightFavorite, getInsightFavorite, addInsightReply } =
    useInsightOptimisticUpdates();

  // Getter for insight reply cache
  const getInsightReply = useCallback((insightId: string) => {
    const updates = useInsightOptimisticUpdates();
    return updates.optimisticUpdates.insightReplies[insightId];
  }, []);

  // Set of Insight IDs currently being processed for favorite operations
  const [favoritingIds, setFavoritingIds] = useState<Set<string>>(
    () => new Set(),
  );

  /**
   * Update archive status of the specified insight in all panels
   */
  const updateArchiveStatus = useCallback(
    async (insightId: string, isArchived: boolean, archivedAt: Date | null) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return updateInsightArchiveStatusInList(
            currentData,
            insightId,
            isArchived,
            archivedAt,
          );
        },
        true, // Changed from false to true to trigger re-render in all components
      );
    },
    [mutate],
  );

  /**
   * Remove the specified insight from all panels
   */
  const removeFromAllPanels = useCallback(
    async (insightId: string) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return removeInsightFromList(currentData, insightId);
        },
        true, // Changed from false to true to trigger re-render in all components
      );
    },
    [mutate],
  );

  /**
   * Favorite or unfavorite an Insight
   */
  const favoriteInsight = useCallback(
    async (insight: Insight) => {
      const insightId = insight.id;
      // Use context's optimistic value to determine current state
      const isCurrentlyFavorited = getInsightFavorite(
        insightId,
        insight.isFavorited || false,
      );
      const newFavoritedState = !isCurrentlyFavorited;

      console.log("[GlobalInsightOps] Starting favorite operation:", {
        insightId,
        newFavoritedState,
        isCurrentlyFavorited,
        insightIsFavorited: insight.isFavorited,
      });

      // Prevent duplicate operations
      if (favoritingIds.has(insightId)) {
        console.log("[GlobalInsightOps] Already favoriting, skipping");
        return;
      }
      setFavoritingIds((prev) => new Set(prev).add(insightId));

      // Use context's optimistic update which sets optimistic state before operation and automatically rolls back on failure
      try {
        await updateInsightFavorite(insightId, newFavoritedState, async () => {
          // Step 1: Update main panel cache (excluding favorites panel)
          await mutate(
            (key: unknown) => {
              const result = isInsightsApiCacheKey(key);
              if (result) {
                console.log("[GlobalInsightOps] Matching cache key:", key);
              }
              return result;
            },
            (currentData: InsightResponse | InsightResponse[] | undefined) => {
              console.log(
                "[GlobalInsightOps] Updating data for key, current data items:",
                Array.isArray(currentData)
                  ? currentData.length
                  : currentData?.items?.length || 0,
              );
              return updateInsightFavoriteStatusInList(
                currentData,
                insightId,
                newFavoritedState,
                "",
                insight,
              );
            },
            false,
          );

          // Dispatch custom event to notify all components that favorite state has changed
          console.log(
            "[GlobalInsightOps] Dispatching insightFavoriteChanged event:",
            {
              insightId,
              isFavorited: newFavoritedState,
            },
          );
          window.dispatchEvent(
            new CustomEvent("insightFavoriteChanged", {
              detail: { insightId, isFavorited: newFavoritedState },
            }),
          );
          console.log("[GlobalInsightOps] Event dispatched");

          // Step 2: Update favorites panel cache
          if (mutateFavoriteList) {
            console.log(
              "[GlobalInsightOps] Updating favorite panel cache using mutateFavoriteList",
            );
            await mutateFavoriteList(
              (currentData: InsightResponse[] | undefined) => {
                console.log(
                  "[GlobalInsightOps] Favorite panel current data:",
                  currentData,
                );
                console.log(
                  "[GlobalInsightOps] New favorited state:",
                  newFavoritedState,
                );
                const result = updateInsightFavoriteStatusInList(
                  currentData,
                  insightId,
                  newFavoritedState,
                  `/api/insights/favorites`,
                  insight,
                );
                console.log(
                  "[GlobalInsightOps] Favorite panel update result:",
                  result,
                );
                // Ensure array type is returned
                return Array.isArray(result) ? result : currentData;
              },
              false,
            );
          } else {
            console.log(
              "[GlobalInsightOps] No mutateFavoriteList provided, using global mutate",
            );

            // Update directly using cache object, then trigger revalidation
            const favoriteKeys = Array.from(cache.keys()).filter((key) => {
              const keyStr = JSON.stringify(key);
              return keyStr.includes("/api/insights/favorites");
            });

            console.log(
              "[GlobalInsightOps] Found favorite panel keys:",
              favoriteKeys,
            );

            // Update for each matching key
            for (const key of favoriteKeys) {
              await (mutate as any)(
                key,
                (currentData: InsightResponse[] | undefined) => {
                  console.log(
                    "[GlobalInsightOps] Updating favorite cache via key:",
                    key,
                  );
                  console.log("[GlobalInsightOps] Current data:", currentData);
                  const result = updateInsightFavoriteStatusInList(
                    currentData,
                    insightId,
                    newFavoritedState,
                    key,
                    insight,
                  );
                  console.log("[GlobalInsightOps] Update result:", result);
                  // Ensure correct format is returned
                  return Array.isArray(result) ? result : currentData || [];
                },
                false,
              );
            }
          }

          console.log("[GlobalInsightOps] Optimistic update completed");

          // Step 3: Send favorite request to API
          const response = await fetch(`/api/insights/${insightId}/favorite`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ favorited: newFavoritedState }),
          });

          if (!response.ok) {
            throw new Error("Failed to favorite insight");
          }

          const result = await response.json();
          console.log(
            "[GlobalInsightOps] API request successful, returned data:",
            result.data,
          );

          // Show success toast
          toast({
            type: "success",
            description: newFavoritedState
              ? t("insight.favoriteSuccess", "Favorited")
              : t("insight.unfavoriteSuccess", "Removed from favorites"),
          });
        });
      } catch (error) {
        // Context will automatically roll back optimistic updates, just show error toast here
        console.error("Error favoriting insight:", error);
        toast({
          type: "error",
          description: t(
            "insight.favoriteError",
            "Failed to favorite, please try again",
          ),
        });
      } finally {
        // Remove loading state
        setFavoritingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(insightId);
          return newSet;
        });
      }
    },
    [
      t,
      mutate,
      mutateFavoriteList,
      favoritingIds,
      cache,
      updateInsightFavorite,
      getInsightFavorite,
    ],
  );

  /**
   * Check if the specified Insight is currently being favorited
   */
  const isFavoriting = useCallback(
    (insightId: string) => {
      return favoritingIds.has(insightId);
    },
    [favoritingIds],
  );

  /**
   * Update task status of the specified insight in all panels
   */
  const updateTaskStatus = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: "myTasks" | "waitingForMe" | "waitingForOthers",
      isCompleted: boolean,
    ) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return updateTaskStatusInList(
            currentData,
            insightId,
            storageKey,
            bucketKey,
            isCompleted,
          );
        },
        false,
      );
    },
    [mutate],
  );

  /**
   * Update task content of the specified insight in all panels
   */
  const updateTask = useCallback(
    async (
      insightId: string,
      storageKey: string,
      updates: Partial<InsightTaskItem>,
    ) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return updateTaskInList(currentData, insightId, storageKey, updates);
        },
        false,
      );
    },
    [mutate],
  );

  /**
   * Remove task from the specified insight in all panels
   */
  const removeTask = useCallback(
    async (insightId: string, storageKey: string) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return removeTaskFromList(currentData, insightId, storageKey);
        },
        false,
      );
    },
    [mutate],
  );

  /**
   * Add task to the specified insight in all panels
   */
  const addTask = useCallback(
    async (
      insightId: string,
      bucketKey: "myTasks" | "waitingForMe" | "waitingForOthers",
      task: InsightTaskItem,
    ) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return addTaskToList(currentData, insightId, bucketKey, task);
        },
        false,
      );
    },
    [mutate],
  );

  /**
   * Move task to another bucket
   */
  const moveTask = useCallback(
    async (
      insightId: string,
      storageKey: string,
      fromBucket: "myTasks" | "waitingForMe" | "waitingForOthers",
      toBucket: "myTasks" | "waitingForMe" | "waitingForOthers",
    ) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return moveTaskInList(
            currentData,
            insightId,
            storageKey,
            fromBucket,
            toBucket,
          );
        },
        false,
      );
    },
    [mutate],
  );

  /**
   * Update categories of the specified insight in all panels
   */
  const updateCategories = useCallback(
    async (insightId: string, categories: string[]) => {
      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return updateInsightCategoriesInList(
            currentData,
            insightId,
            categories,
          );
        },
        false,
      );
    },
    [mutate],
  );

  /**
   * Add reply to the specified insight in all panels
   */
  const addReply = useCallback(
    async (insightId: string, detail: DetailData, timeline: TimelineData) => {
      // Update global cache (ensures data persists when drawer closes and reopens)
      addInsightReply(insightId, detail, timeline);

      await mutate(
        (key: unknown) => isInsightsApiCacheKey(key),
        (currentData: InsightResponse | InsightResponse[] | undefined) => {
          return addReplyToList(currentData, insightId, detail, timeline);
        },
        false,
      );
    },
    [mutate, addInsightReply],
  );

  return {
    updateArchiveStatus,
    removeFromAllPanels,
    favoriteInsight,
    isFavoriting,
    updateTaskStatus,
    updateTask,
    removeTask,
    addTask,
    moveTask,
    updateCategories,
    addReply,
    getInsightReply,
  };
}
