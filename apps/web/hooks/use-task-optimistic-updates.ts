import { useState, useCallback } from "react";
import type { InsightTaskItem } from "@/lib/ai/subagents/insights";

// Define TaskBucketKey type
type TaskBucketKey = "myTasks" | "waitingForMe" | "waitingForOthers";

/**
 * Task optimistic update types
 */
export interface TaskOptimisticUpdates {
  // Title updates (storageKey -> newTitle)
  titles: Record<string, string>;
  // Priority updates (storageKey -> priority)
  priorities: Record<string, string | null>;
  // Bucket updates (storageKey -> newBucketKey)
  buckets: Record<string, TaskBucketKey>;
  // Field updates (storageKey -> { field: value })
  fields: Record<string, Partial<InsightTaskItem>>;
}

/**
 * Global task optimistic update management hook
 * Provides unified optimistic update state management, avoids writing duplicate optimistic update code in multiple components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     optimisticUpdates,
 *     updateTitle,
 *     updatePriority,
 *     updateBucket,
 *     clearUpdates
 *   } = useTaskOptimisticUpdates(todoBuckets);
 *
 *   // Use optimistic values when displaying
 *   const displayTitle = optimisticUpdates.titles[storageKey] || task.title;
 *   const displayPriority = optimisticUpdates.priorities[storageKey] || task.priority;
 *
 *   // Set optimistic value when updating
 *   const handleTitleChange = async (newTitle) => {
 *     await updateTitle(storageKey, newTitle, async () => {
 *       await apiCall(...);
 *       await refresh();
 *     });
 *   };
 * }
 * ```
 */
export function useTaskOptimisticUpdates(
  todoBuckets: Array<{
    key: TaskBucketKey;
    tasks: Array<{
      storageKey: string;
      bucketKey: TaskBucketKey;
      task: InsightTaskItem;
    }>;
  }>,
) {
  // Optimistic update state
  const [optimisticUpdates, setOptimisticUpdates] =
    useState<TaskOptimisticUpdates>({
      titles: {},
      priorities: {},
      buckets: {},
      fields: {},
    });

  /**
   * Update task title (optimistic)
   */
  const updateTitle = useCallback(
    async (
      storageKey: string,
      newTitle: string,
      action: () => Promise<void>,
    ) => {
      // Immediately display new title
      setOptimisticUpdates((prev) => ({
        ...prev,
        titles: { ...prev.titles, [storageKey]: newTitle },
      }));

      try {
        await action();
        // Will be automatically cleared when todoBuckets updates on success
      } catch (error) {
        // Clear optimistic update on failure
        setOptimisticUpdates((prev) => {
          const titles = { ...prev.titles };
          delete titles[storageKey];
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
      // Immediately display new priority
      setOptimisticUpdates((prev) => ({
        ...prev,
        priorities: { ...prev.priorities, [storageKey]: newPriority },
      }));

      try {
        await action();
        // Will be automatically cleared when todoBuckets updates on success
      } catch (error) {
        // Clear optimistic update on failure
        setOptimisticUpdates((prev) => {
          const priorities = { ...prev.priorities };
          delete priorities[storageKey];
          return { ...prev, priorities };
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
      // Immediately display new bucket
      setOptimisticUpdates((prev) => ({
        ...prev,
        buckets: { ...prev.buckets, [storageKey]: newBucket },
      }));

      try {
        await action();
        // Will be automatically cleared when todoBuckets updates on success
      } catch (error) {
        // Clear optimistic update on failure
        setOptimisticUpdates((prev) => {
          const buckets = { ...prev.buckets };
          delete buckets[storageKey];
          return { ...prev, buckets };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Update task fields (optimistic)
   */
  const updateField = useCallback(
    async (
      storageKey: string,
      fields: Partial<InsightTaskItem>,
      action: () => Promise<void>,
    ) => {
      // Immediately display new field values
      setOptimisticUpdates((prev) => ({
        ...prev,
        fields: { ...prev.fields, [storageKey]: fields },
      }));

      try {
        await action();
        // Will be automatically cleared when todoBuckets updates on success
      } catch (error) {
        // Clear optimistic update on failure
        setOptimisticUpdates((prev) => {
          const fieldUpdates = { ...prev.fields };
          delete fieldUpdates[storageKey];
          return { ...prev, fields: fieldUpdates };
        });
        throw error;
      }
    },
    [],
  );

  /**
   * Get optimistic update title for a task
   */
  const getTitle = useCallback(
    (storageKey: string, originalTitle: string) => {
      return optimisticUpdates.titles[storageKey] || originalTitle;
    },
    [optimisticUpdates.titles],
  );

  /**
   * Get optimistic update priority for a task
   */
  const getPriority = useCallback(
    (storageKey: string, originalPriority: string | null) => {
      if (storageKey in optimisticUpdates.priorities) {
        return optimisticUpdates.priorities[storageKey];
      }
      return originalPriority;
    },
    [optimisticUpdates.priorities],
  );

  /**
   * Get optimistic update bucket for a task
   */
  const getBucket = useCallback(
    (storageKey: string, originalBucket: TaskBucketKey) => {
      return optimisticUpdates.buckets[storageKey] || originalBucket;
    },
    [optimisticUpdates.buckets],
  );

  /**
   * Get optimistic update fields for a task
   */
  const getFields = useCallback(
    (storageKey: string, originalFields: InsightTaskItem) => {
      const updates = optimisticUpdates.fields[storageKey];
      if (!updates) return originalFields;
      return { ...originalFields, ...updates };
    },
    [optimisticUpdates.fields],
  );

  /**
   * Batch get optimistic update values for a task
   */
  const getTaskUpdates = useCallback(
    (storageKey: string, task: InsightTaskItem, bucketKey: TaskBucketKey) => {
      return {
        task: getFields(storageKey, task),
        bucketKey: getBucket(storageKey, bucketKey),
      };
    },
    [getFields, getBucket],
  );

  return {
    /** All current optimistic updates */
    optimisticUpdates,
    /** Update title (optimistic) */
    updateTitle,
    /** Update priority (optimistic) */
    updatePriority,
    /** Move task (optimistic) */
    updateBucket,
    /** Update fields (optimistic) */
    updateField,
    /** Get title */
    getTitle,
    /** Get priority */
    getPriority,
    /** Get bucket */
    getBucket,
    /** Get field updates */
    getFields,
    /** Get complete task updates */
    getTaskUpdates,
  };
}
