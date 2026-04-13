/**
 * Global task and Insight optimistic update Context
 * Used to share optimistic update state across multiple components
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  InsightTaskItem,
  DetailData,
  TimelineData,
} from "@/lib/ai/subagents/insights";

// Define TaskBucketKey type
export type TaskBucketKey = "myTasks" | "waitingForMe" | "waitingForOthers";

/**
 * Temporarily created task
 */
export interface TempTask {
  insightId: string;
  bucketKey: TaskBucketKey;
  task: InsightTaskItem & { storageKey: string };
}

/**
 * Task optimistic update types
 */
export interface InsightOptimisticUpdates {
  // Title update (storageKey -> newTitle)
  titles: Record<string, string>;
  // Priority update (storageKey -> priority)
  priorities: Record<string, string | null>;
  // Bucket update (storageKey -> newBucketKey)
  buckets: Record<string, TaskBucketKey>;
  // Deadline update (storageKey -> deadline)
  deadlines: Record<string, string | null>;
  // Owner update (storageKey -> owner)
  owners: Record<string, string | null>;
  // Requester update (storageKey -> requester)
  requesters: Record<string, string | null>;
  // Description update (storageKey -> context)
  contexts: Record<string, string | null>;
  // Delete status (storageKey -> true)
  deletedTasks: Record<string, boolean>;
  // Completion status (storageKey -> isCompleted)
  completedTasks: Record<string, boolean>;
  // Newly created temporary tasks (insightId -> array of TempTask)
  tempTasks: Record<string, TempTask[]>;
  // Insight favorite status (insightId -> favorite)
  insightFavorites: Record<string, boolean>;
  // Insight categories (insightId -> categories)
  insightCategories: Record<string, string[] | null>;
  // Insight replies (insightId -> { details, timelines })
  insightReplies: Record<
    string,
    { details: DetailData[]; timelines: TimelineData[] }
  >;
}

/**
 * Context type
 */
interface InsightOptimisticContextValue {
  optimisticUpdates: InsightOptimisticUpdates;
  // Task operations
  updateTitle: (
    storageKey: string,
    newTitle: string,
    action: () => Promise<void>,
  ) => Promise<void>;
  updatePriority: (
    storageKey: string,
    newPriority: string | null,
    action: () => Promise<void>,
  ) => Promise<void>;
  updateDeadline: (
    storageKey: string,
    newDeadline: string | null,
    action: () => Promise<void>,
  ) => Promise<void>;
  updateOwner: (
    storageKey: string,
    newOwner: string | null,
    action: () => Promise<void>,
  ) => Promise<void>;
  updateRequester: (
    storageKey: string,
    newRequester: string | null,
    action: () => Promise<void>,
  ) => Promise<void>;
  updateContext: (
    storageKey: string,
    newContext: string | null,
    action: () => Promise<void>,
  ) => Promise<void>;
  updateBucket: (
    storageKey: string,
    newBucket: TaskBucketKey,
    action: () => Promise<void>,
  ) => Promise<void>;
  deleteTask: (
    storageKey: string,
    action: () => Promise<void>,
  ) => Promise<void>;
  toggleTaskCompletion: (
    storageKey: string,
    isCompleted: boolean,
    action: () => Promise<void>,
  ) => Promise<void>;
  addTempTask: <T>(
    insightId: string,
    bucketKey: TaskBucketKey,
    task: TempTask["task"],
    action: () => Promise<T>,
  ) => Promise<T | undefined>;
  // Insight operations
  updateInsightFavorite: (
    insightId: string,
    isFavorite: boolean,
    action: () => Promise<void>,
  ) => Promise<void>;
  updateInsightCategories: (
    insightId: string,
    categories: string[] | null,
    action: () => Promise<void>,
  ) => Promise<void>;
  // Getter methods (no need for useCallback, as they only read state)
  getTitle: (storageKey: string, originalTitle: string) => string;
  getPriority: (
    storageKey: string,
    originalPriority: string | null,
  ) => string | null;
  getDeadline: (
    storageKey: string,
    originalDeadline: string | null,
  ) => string | null;
  getOwner: (storageKey: string, originalOwner: string | null) => string | null;
  getRequester: (
    storageKey: string,
    originalRequester: string | null,
  ) => string | null;
  getContext: (
    storageKey: string,
    originalContext: string | null,
  ) => string | null;
  getBucket: (
    storageKey: string,
    originalBucket: TaskBucketKey,
  ) => TaskBucketKey;
  getFields: (
    storageKey: string,
    originalFields: InsightTaskItem,
  ) => InsightTaskItem;
  getTaskUpdates: (
    storageKey: string,
    task: InsightTaskItem,
    bucketKey: TaskBucketKey,
  ) => { task: InsightTaskItem; bucketKey: TaskBucketKey };
  isTaskDeleted: (storageKey: string) => boolean;
  isTaskCompleted: (storageKey: string, originalCompleted: boolean) => boolean;
  getTempTasks: (insightId: string) => TempTask[];
  getInsightFavorite: (insightId: string, originalFavorite: boolean) => boolean;
  getInsightCategories: (
    insightId: string,
    originalCategories: string[] | null,
  ) => string[] | null;
  getInsightReply: (
    insightId: string,
  ) => { details: DetailData[]; timelines: TimelineData[] } | undefined;
  addInsightReply: (
    insightId: string,
    detail: DetailData,
    timeline: TimelineData,
  ) => void;
  clearUpdates: (storageKey?: string) => void;
}

// Default empty state (use constant reference to avoid recreating)
const defaultUpdates: InsightOptimisticUpdates = {
  titles: {},
  priorities: {},
  buckets: {},
  deadlines: {},
  owners: {},
  requesters: {},
  contexts: {},
  deletedTasks: {},
  completedTasks: {},
  tempTasks: {},
  insightFavorites: {},
  insightCategories: {},
  insightReplies: {},
};

// Create Context
const InsightOptimisticContext =
  createContext<InsightOptimisticContextValue | null>(null);

/**
 * Provider component
 */
export function InsightOptimisticProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [optimisticUpdates, setOptimisticUpdates] =
    useState<InsightOptimisticUpdates>(defaultUpdates);

  // Use ref to store state reference for getter functions to access directly
  // This way getter functions don't depend on state changes, avoiding unnecessary rebuilds
  const updatesRef = useRef(optimisticUpdates);
  updatesRef.current = optimisticUpdates;

  /**
   * Update task title (optimistic)
   */
  const updateTitle = useCallback(
    async (
      storageKey: string,
      newTitle: string,
      action: () => Promise<void>,
    ) => {
      // Directly update specific property, avoid spreading the entire object
      setOptimisticUpdates((prev) => {
        const titles = { ...prev.titles, [storageKey]: newTitle };
        return { ...prev, titles };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...titles } = prev.titles;
          return { ...prev, titles };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update task priority (optimistic)
   */
  const updatePriority = useCallback(
    async (
      storageKey: string,
      newPriority: string | null,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const priorities = { ...prev.priorities, [storageKey]: newPriority };
        return { ...prev, priorities };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...priorities } = prev.priorities;
          return { ...prev, priorities };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update task deadline (optimistic)
   */
  const updateDeadline = useCallback(
    async (
      storageKey: string,
      newDeadline: string | null,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const deadlines = { ...prev.deadlines, [storageKey]: newDeadline };
        return { ...prev, deadlines };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...deadlines } = prev.deadlines;
          return { ...prev, deadlines };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Move task to new bucket (optimistic)
   */
  const updateBucket = useCallback(
    async (
      storageKey: string,
      newBucket: TaskBucketKey,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const buckets = { ...prev.buckets, [storageKey]: newBucket };
        return { ...prev, buckets };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...buckets } = prev.buckets;
          return { ...prev, buckets };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update task owner (optimistic)
   */
  const updateOwner = useCallback(
    async (
      storageKey: string,
      newOwner: string | null,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const owners = { ...prev.owners, [storageKey]: newOwner };
        return { ...prev, owners };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...owners } = prev.owners;
          return { ...prev, owners };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update task requester (optimistic)
   */
  const updateRequester = useCallback(
    async (
      storageKey: string,
      newRequester: string | null,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const requesters = { ...prev.requesters, [storageKey]: newRequester };
        return { ...prev, requesters };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...requesters } = prev.requesters;
          return { ...prev, requesters };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update task description (optimistic)
   */
  const updateContext = useCallback(
    async (
      storageKey: string,
      newContext: string | null,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const contexts = { ...prev.contexts, [storageKey]: newContext };
        return { ...prev, contexts };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...contexts } = prev.contexts;
          return { ...prev, contexts };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Delete task (optimistic)
   */
  const deleteTask = useCallback(
    async (storageKey: string, action: () => Promise<void>) => {
      setOptimisticUpdates((prev) => {
        const deletedTasks = { ...prev.deletedTasks, [storageKey]: true };
        return { ...prev, deletedTasks };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...deletedTasks } = prev.deletedTasks;
          return { ...prev, deletedTasks };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update Insight favorite status (optimistic)
   */
  const updateInsightFavorite = useCallback(
    async (
      insightId: string,
      isFavorite: boolean,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const insightFavorites = {
          ...prev.insightFavorites,
          [insightId]: isFavorite,
        };
        return { ...prev, insightFavorites };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [insightId]: _, ...insightFavorites } = prev.insightFavorites;
          return { ...prev, insightFavorites };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update Insight categories (optimistic)
   */
  const updateInsightCategories = useCallback(
    async (
      insightId: string,
      categories: string[] | null,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const insightCategories = {
          ...prev.insightCategories,
          [insightId]: categories,
        };
        return { ...prev, insightCategories };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [insightId]: _, ...insightCategories } =
            prev.insightCategories;
          return { ...prev, insightCategories };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Toggle task completion status (optimistic)
   */
  const toggleTaskCompletion = useCallback(
    async (
      storageKey: string,
      isCompleted: boolean,
      action: () => Promise<void>,
    ) => {
      setOptimisticUpdates((prev) => {
        const completedTasks = {
          ...prev.completedTasks,
          [storageKey]: isCompleted,
        };
        return { ...prev, completedTasks };
      });

      try {
        await action();
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const { [storageKey]: _, ...completedTasks } = prev.completedTasks;
          return { ...prev, completedTasks };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Add temporarily created task (optimistic)
   * @returns Returns the result of action, undefined if failed
   */
  const addTempTask = useCallback(
    async <T,>(
      insightId: string,
      bucketKey: TaskBucketKey,
      task: TempTask["task"],
      action: () => Promise<T>,
    ): Promise<T | undefined> => {
      const tempTask: TempTask = { insightId, bucketKey, task };
      setOptimisticUpdates((prev) => {
        const tempTasks = {
          ...prev.tempTasks,
          [insightId]: [...(prev.tempTasks[insightId] || []), tempTask],
        };
        return { ...prev, tempTasks };
      });

      try {
        const result = await action();
        return result;
      } catch (error) {
        setOptimisticUpdates((prev) => {
          const insightTasks =
            prev.tempTasks[insightId]?.filter(
              (t) => t.task.storageKey !== task.storageKey,
            ) || [];
          const tempTasks = { ...prev.tempTasks, [insightId]: insightTasks };
          return { ...prev, tempTasks };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Clear optimistic updates
   * @param storageKey Optional, if provided only clears updates for that task, otherwise clears all
   */
  const clearUpdates = useCallback((storageKey?: string) => {
    if (storageKey) {
      setOptimisticUpdates((prev) => ({
        titles: { ...prev.titles, [storageKey]: undefined as never },
        priorities: { ...prev.priorities, [storageKey]: undefined as never },
        buckets: { ...prev.buckets, [storageKey]: undefined as never },
        deadlines: { ...prev.deadlines, [storageKey]: undefined as never },
        owners: { ...prev.owners, [storageKey]: undefined as never },
        requesters: { ...prev.requesters, [storageKey]: undefined as never },
        contexts: { ...prev.contexts, [storageKey]: undefined as never },
        deletedTasks: {
          ...prev.deletedTasks,
          [storageKey]: undefined as never,
        },
        completedTasks: {
          ...prev.completedTasks,
          [storageKey]: undefined as never,
        },
        insightFavorites: { ...prev.insightFavorites },
        tempTasks: { ...prev.tempTasks },
        insightCategories: { ...prev.insightCategories },
        insightReplies: { ...prev.insightReplies },
      }));
    } else {
      // Clear all updates, reset to default constant reference
      setOptimisticUpdates(defaultUpdates);
    }
  }, []);

  // Getter functions - No useCallback needed as they only read state
  // Access latest state through ref, avoiding unnecessary rebuilds from dependencies

  /**
   * Get optimistic update title for task
   */
  const getTitle = (storageKey: string, originalTitle: string) => {
    return updatesRef.current.titles[storageKey] || originalTitle;
  };

  /**
   * Get optimistic update priority for task
   */
  const getPriority = (storageKey: string, originalPriority: string | null) => {
    if (storageKey in updatesRef.current.priorities) {
      return updatesRef.current.priorities[storageKey];
    }
    return originalPriority;
  };

  /**
   * Get optimistic update deadline for task
   */
  const getDeadline = (storageKey: string, originalDeadline: string | null) => {
    if (storageKey in updatesRef.current.deadlines) {
      return updatesRef.current.deadlines[storageKey];
    }
    return originalDeadline;
  };

  /**
   * Get optimistic update owner for task
   */
  const getOwner = (storageKey: string, originalOwner: string | null) => {
    if (storageKey in updatesRef.current.owners) {
      return updatesRef.current.owners[storageKey];
    }
    return originalOwner;
  };

  /**
   * Get optimistic update requester for task
   */
  const getRequester = (
    storageKey: string,
    originalRequester: string | null,
  ) => {
    if (storageKey in updatesRef.current.requesters) {
      return updatesRef.current.requesters[storageKey];
    }
    return originalRequester;
  };

  /**
   * Get optimistic update description for task
   */
  const getContext = (storageKey: string, originalContext: string | null) => {
    if (storageKey in updatesRef.current.contexts) {
      return updatesRef.current.contexts[storageKey];
    }
    return originalContext;
  };

  /**
   * Get optimistic update bucket for task
   */
  const getBucket = (storageKey: string, originalBucket: TaskBucketKey) => {
    return updatesRef.current.buckets[storageKey] || originalBucket;
  };

  /**
   * Get optimistic update fields for task (includes all fields)
   */
  const getFields = (
    storageKey: string,
    originalFields: InsightTaskItem,
  ): InsightTaskItem => {
    const updates = updatesRef.current;
    const titleUpdate = updates.titles[storageKey];
    const priorityUpdate = updates.priorities[storageKey];
    const deadlineUpdate = updates.deadlines[storageKey];
    const ownerUpdate = updates.owners[storageKey];
    const requesterUpdate = updates.requesters[storageKey];
    const contextUpdate = updates.contexts[storageKey];
    const completedUpdate = updates.completedTasks[storageKey];

    // If there are any updates, return the merged object
    if (
      titleUpdate ||
      priorityUpdate !== undefined ||
      deadlineUpdate !== undefined ||
      ownerUpdate !== undefined ||
      requesterUpdate !== undefined ||
      contextUpdate !== undefined ||
      completedUpdate !== undefined
    ) {
      const merged = { ...originalFields };

      if (titleUpdate) merged.title = titleUpdate;
      if (priorityUpdate !== undefined) merged.priority = priorityUpdate;
      if (deadlineUpdate !== undefined) merged.deadline = deadlineUpdate;
      if (ownerUpdate !== undefined) merged.owner = ownerUpdate;
      if (requesterUpdate !== undefined) merged.requester = requesterUpdate;
      if (contextUpdate !== undefined) merged.context = contextUpdate;
      if (completedUpdate !== undefined)
        merged.status = completedUpdate ? "completed" : "pending";

      return merged;
    }
    return originalFields;
  };

  /**
   * Batch get optimistic update values for task
   */
  const getTaskUpdates = (
    storageKey: string,
    task: InsightTaskItem,
    bucketKey: TaskBucketKey,
  ) => {
    return {
      task: getFields(storageKey, task),
      bucketKey: getBucket(storageKey, bucketKey),
    };
  };

  /**
   * Check if task is marked as deleted
   */
  const isTaskDeleted = (storageKey: string) => {
    return updatesRef.current.deletedTasks[storageKey] || false;
  };

  /**
   * Check if task is completed
   */
  const isTaskCompleted = (storageKey: string, originalCompleted: boolean) => {
    if (storageKey in updatesRef.current.completedTasks) {
      return updatesRef.current.completedTasks[storageKey];
    }
    return originalCompleted;
  };

  /**
   * Get list of temporarily created tasks
   */
  const getTempTasks = (insightId: string) => {
    return updatesRef.current.tempTasks[insightId] || [];
  };

  /**
   * Get optimistic update favorite status for Insight
   */
  const getInsightFavorite = (insightId: string, originalFavorite: boolean) => {
    if (insightId in updatesRef.current.insightFavorites) {
      return updatesRef.current.insightFavorites[insightId];
    }
    return originalFavorite;
  };

  /**
   * Get optimistic update categories status for Insight
   */
  const getInsightCategories = (
    insightId: string,
    originalCategories: string[] | null,
  ) => {
    if (insightId in updatesRef.current.insightCategories) {
      return updatesRef.current.insightCategories[insightId];
    }
    return originalCategories;
  };

  const getInsightReply = (insightId: string) => {
    return updatesRef.current.insightReplies[insightId];
  };

  const addInsightReply = (
    insightId: string,
    detail: DetailData,
    timeline: TimelineData,
  ) => {
    const existing = updatesRef.current.insightReplies[insightId] || {
      details: [],
      timelines: [],
    };
    setOptimisticUpdates((prev) => ({
      ...prev,
      insightReplies: {
        ...prev.insightReplies,
        [insightId]: {
          details: [...existing.details, detail],
          timelines: [...existing.timelines, timeline],
        },
      },
    }));
  };

  const value: InsightOptimisticContextValue = {
    optimisticUpdates,
    updateTitle,
    updatePriority,
    updateDeadline,
    updateOwner,
    updateRequester,
    updateContext,
    updateBucket,
    deleteTask,
    toggleTaskCompletion,
    addTempTask,
    updateInsightFavorite,
    updateInsightCategories,
    // Getter functions - New closure created on each render, but since there are no useCallback dependencies, they won't change due to state changes
    // Also access latest state through ref to ensure correct values are retrieved
    getTitle,
    getPriority,
    getDeadline,
    getOwner,
    getRequester,
    getContext,
    getBucket,
    getFields,
    getTaskUpdates,
    isTaskDeleted,
    isTaskCompleted,
    getTempTasks,
    getInsightFavorite,
    getInsightCategories,
    getInsightReply,
    addInsightReply,
    clearUpdates,
  };

  return (
    <InsightOptimisticContext.Provider value={value}>
      {children}
    </InsightOptimisticContext.Provider>
  );
}

/**
 * Hook for using global optimistic updates
 * Must be used within InsightOptimisticProvider
 */
export function useInsightOptimisticUpdates() {
  const context = useContext(InsightOptimisticContext);
  if (!context) {
    throw new Error(
      "useInsightOptimisticUpdates must be used within InsightOptimisticProvider",
    );
  }
  return context;
}

/**
 * Export types
 */
export type { InsightOptimisticContextValue };
