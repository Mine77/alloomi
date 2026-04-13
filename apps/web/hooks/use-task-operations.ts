/**
 * Hook for task operations
 * Centrally manages task state updates, API calls, and optimistic updates
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInsightCache } from "@/hooks/use-insight-cache";
import { useInsightOptimisticUpdates } from "@/components/insight-optimistic-context";
import type { InsightTaskItem } from "@/lib/ai/subagents/insights";
import { toast } from "@/components/toast";

/**
 * Return type for creating task (includes storageKey)
 */
type CreatedTask = InsightTaskItem & {
  storageKey: string;
};

type TaskBucketKey = "myTasks" | "waitingForMe" | "waitingForOthers";

/**
 * Return value of task operations Hook
 */
interface UseTaskOperationsReturn {
  /**
   * Update task title
   */
  updateTaskTitle: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    newTitle: string,
    originalTitle: string,
  ) => Promise<void>;

  /**
   * Update task context
   */
  updateTaskContext: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    newContext: string,
    originalContext: string,
  ) => Promise<void>;

  /**
   * Update task priority
   */
  updateTaskPriority: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    newPriority: string | null,
    originalPriority: string | null,
  ) => Promise<void>;

  /**
   * Update task priority (simplified version, doesn't need originalPriority)
   */
  updateTaskPrioritySimple: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    priority: "high" | "medium" | "low" | null,
  ) => Promise<void>;

  /**
   * Update common task fields
   */
  updateTaskFields: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    updates: Partial<InsightTaskItem>,
    originalValues: Partial<InsightTaskItem>,
    newBucket?: TaskBucketKey,
  ) => Promise<void>;

  /**
   * Move task to another bucket
   */
  moveTask: (
    insightId: string,
    storageKey: string,
    fromBucket: TaskBucketKey,
    toBucket: TaskBucketKey,
  ) => Promise<void>;

  /**
   * Update single field (simplified version, doesn't need originalValues)
   */
  patchTaskField: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    field: "owner" | "requester" | "deadline" | "context",
    value: string | null,
  ) => Promise<void>;

  /**
   * Create new task
   */
  createTask: (
    insightId: string,
    bucketKey: TaskBucketKey,
    taskData: {
      title: string;
      context?: string;
      deadline?: string;
      owner?: string;
      priority?: string | null;
    },
  ) => Promise<CreatedTask | null>;

  /**
   * Delete task
   */
  removeTask: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
  ) => Promise<void>;

  /**
   * Toggle task status (completed/incomplete)
   */
  toggleTaskCompletion: (
    insightId: string,
    storageKey: string,
    bucketKey: TaskBucketKey,
    isCompleted: boolean,
  ) => Promise<void>;

  /**
   * Loading state mapping
   */
  loadingMap: Record<string, boolean>;
}

/**
 * Hook for task operations
 *
 * @example
 * ```tsx
 * const { updateTaskTitle, updateTaskContext, createTask } = useTaskOperations();
 * ```
 */
export function useTaskOperations(): UseTaskOperationsReturn {
  const { t } = useTranslation();
  const {
    updateTask: updateCache,
    updateTaskStatus,
    removeTask: removeFromCache,
    moveTask: moveCacheTask,
  } = useInsightCache();

  // Global optimistic update management
  const {
    deleteTask: deleteTaskOptimistic,
    addTempTask: addTempTaskOptimistic,
    toggleTaskCompletion: toggleCompletionOptimistic,
    updateOwner: updateOwnerOptimistic,
    updateRequester: updateRequesterOptimistic,
    updateContext: updateContextOptimistic,
    updateDeadline: updateDeadlineOptimistic,
  } = useInsightOptimisticUpdates();

  // Loading state mapping
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  /**
   * Update common task fields
   */
  const updateTaskFields = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      updates: Partial<InsightTaskItem>,
      originalValues: Partial<InsightTaskItem>,
      newBucket?: TaskBucketKey,
    ) => {
      setLoadingMap((prev) => ({ ...prev, [storageKey]: true }));

      try {
        // Optimistic update: immediately update panel cache
        await updateCache(insightId, storageKey, updates);

        // Send API request
        const response = await fetch(
          `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              newBucket ? { ...updates, newBucket } : updates,
            ),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update task");
        }

        toast({
          type: "success",
          description: t("insightDetail.updateTask.success", "Task updated"),
        });
      } catch (error) {
        // Request failed, rollback cache
        await updateCache(insightId, storageKey, originalValues);

        toast({
          type: "error",
          description: t(
            "insightDetail.updateTask.error",
            error instanceof Error ? error.message : "Failed to update task",
          ),
        });
        throw error;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[storageKey];
          return newLoadingMap;
        });
      }
    },
    [updateCache, t],
  );

  /**
   * Update task title
   */
  const updateTaskTitle = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      newTitle: string,
      originalTitle: string,
    ) => {
      await updateTaskFields(
        insightId,
        storageKey,
        bucketKey,
        { title: newTitle },
        { title: originalTitle },
      );
    },
    [updateTaskFields],
  );

  /**
   * Update task context
   */
  const updateTaskContext = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      newContext: string,
      originalContext: string,
    ) => {
      await updateTaskFields(
        insightId,
        storageKey,
        bucketKey,
        { context: newContext },
        { context: originalContext },
      );
    },
    [updateTaskFields],
  );

  /**
   * Update task priority
   */
  const updateTaskPriority = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      newPriority: string | null,
      originalPriority: string | null,
    ) => {
      await updateTaskFields(
        insightId,
        storageKey,
        bucketKey,
        { priority: newPriority },
        { priority: originalPriority },
      );
    },
    [updateTaskFields],
  );

  /**
   * Update task priority (simplified version, supports optimistic updates)
   */
  const updateTaskPrioritySimple = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      priority: "high" | "medium" | "low" | null,
    ) => {
      setLoadingMap((prev) => ({ ...prev, [`${storageKey}-priority`]: true }));

      try {
        // Optimistic update: immediately update panel cache
        const updates: Partial<InsightTaskItem> = { priority };
        await updateCache(insightId, storageKey, updates);

        // Send API request
        const response = await fetch(
          `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: priority || null }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update priority");
        }

        toast({
          type: "success",
          description: t("insightDetail.updateTask.success", "Task updated"),
        });

        // Send global event to notify other panels to refresh
        window.dispatchEvent(new CustomEvent("insight-task-status-change"));
      } catch (error) {
        // Request failed, trigger refresh to restore data
        window.dispatchEvent(new CustomEvent("insight-task-status-change"));

        toast({
          type: "error",
          description: t(
            "insightDetail.updateTask.error",
            error instanceof Error
              ? error.message
              : "Failed to update priority",
          ),
        });
        throw error;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[`${storageKey}-priority`];
          return newLoadingMap;
        });
      }
    },
    [updateCache, t],
  );

  /**
   * Create new task
   */
  const createTask = useCallback(
    async (
      insightId: string,
      bucketKey: TaskBucketKey,
      taskData: {
        title: string;
        context?: string;
        deadline?: string;
        owner?: string;
        priority?: string | null;
      },
    ) => {
      if (!taskData.title.trim()) {
        toast({
          type: "error",
          description: t(
            "insightDetail.createTask.titleRequired",
            "Please enter a task title",
          ),
        });
        return null;
      }

      const loadingKey = `create-${Date.now()}`;
      const tempStorageKey = `temp-${loadingKey}`;
      setLoadingMap((prev) => ({ ...prev, [loadingKey]: true }));

      try {
        // Create temporary task for optimistic display
        const tempTask: InsightTaskItem & { storageKey: string } = {
          storageKey: tempStorageKey,
          taskName: taskData.title.trim(),
          context: taskData.context?.trim() || "",
          deadline: taskData.deadline || null,
          owner: taskData.owner || null,
          priority: taskData.priority || null,
          status: "pending",
          requester: null,
        } as InsightTaskItem & { storageKey: string };

        // Use global optimistic add
        const createdTask = await addTempTaskOptimistic(
          insightId,
          bucketKey,
          tempTask,
          async () => {
            // Send API request
            const response = await fetch(`/api/insights/${insightId}/tasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: taskData.title.trim(),
                context: taskData.context?.trim() || undefined,
                bucket: bucketKey,
                deadline: taskData.deadline || undefined,
                owner: taskData.owner || undefined,
                priority: taskData.priority || undefined,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || "Failed to create task");
            }

            const newTask = await response.json();

            // Optimistic update: add to panel cache (replace temporary task)
            await updateCache(insightId, bucketKey, newTask);

            toast({
              type: "success",
              description: t(
                "insightDetail.createTask.success",
                "Task created",
              ),
            });

            return newTask;
          },
        );

        // Return created task
        return createdTask;
      } catch (error) {
        toast({
          type: "error",
          description: t(
            "insightDetail.createTask.error",
            error instanceof Error ? error.message : "Failed to create task",
          ),
        });
        return null;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[loadingKey];
          return newLoadingMap;
        });
      }
    },
    [addTempTaskOptimistic, updateCache, t],
  );

  /**
   * Move task to another bucket (supports optimistic updates)
   */
  const moveTask = useCallback(
    async (
      insightId: string,
      storageKey: string,
      fromBucket: TaskBucketKey,
      toBucket: TaskBucketKey,
    ) => {
      if (fromBucket === toBucket) return;

      setLoadingMap((prev) => ({ ...prev, [storageKey]: true }));

      try {
        // Optimistic update: immediately move task
        await moveCacheTask(insightId, storageKey, fromBucket, toBucket);

        // Send move request (use PATCH endpoint + newBucket parameter)
        const response = await fetch(
          `/api/insights/${insightId}/buckets/${fromBucket}/tasks/${encodeURIComponent(storageKey)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newBucket: toBucket }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to move task");
        }

        toast({
          type: "success",
          description: t("insightDetail.updateTask.success", "Task updated"),
        });

        // Send global event to notify other panels to refresh
        window.dispatchEvent(new CustomEvent("insight-task-status-change"));
      } catch (error) {
        // Request failed, trigger refresh to restore data (move task back to original bucket)
        await moveCacheTask(insightId, storageKey, toBucket, fromBucket);
        window.dispatchEvent(new CustomEvent("insight-task-status-change"));

        toast({
          type: "error",
          description: t(
            "insightDetail.updateTask.error",
            error instanceof Error ? error.message : "Failed to move task",
          ),
        });
        throw error;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[storageKey];
          return newLoadingMap;
        });
      }
    },
    [moveCacheTask, t],
  );

  /**
   * Update single field (simplified version, supports optimistic updates)
   */
  const patchTaskField = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      field: "owner" | "requester" | "deadline" | "context",
      value: string | null,
    ) => {
      console.log("[patchTaskField] Called with", {
        insightId,
        storageKey,
        bucketKey,
        field,
        value,
      });
      setLoadingMap((prev) => ({ ...prev, [`${storageKey}-${field}`]: true }));

      try {
        // Select appropriate Context method based on field type
        if (field === "deadline") {
          console.log("[patchTaskField] Using updateDeadlineOptimistic");
          // Use dedicated deadline optimistic update
          await updateDeadlineOptimistic(storageKey, value, async () => {
            // Optimistic update: immediately update panel cache
            const updates: Partial<InsightTaskItem> = { [field]: value };
            await updateCache(insightId, storageKey, updates);

            // Send API request
            const response = await fetch(
              `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
              },
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed to update ${field}`);
            }

            toast({
              type: "success",
              description: t(
                "insightDetail.updateTask.success",
                "Task updated",
              ),
            });

            // Send global event to notify other panels to refresh
            window.dispatchEvent(new CustomEvent("insight-task-status-change"));
          });
        } else if (field === "owner") {
          console.log("[patchTaskField] Using updateOwnerOptimistic");
          // Use dedicated owner optimistic update
          await updateOwnerOptimistic(storageKey, value, async () => {
            // Optimistic update: immediately update panel cache
            const updates: Partial<InsightTaskItem> = { [field]: value };
            await updateCache(insightId, storageKey, updates);

            // Send API request
            const response = await fetch(
              `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
              },
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed to update ${field}`);
            }

            toast({
              type: "success",
              description: t(
                "insightDetail.updateTask.success",
                "Task updated",
              ),
            });

            // Send global event to notify other panels to refresh
            window.dispatchEvent(new CustomEvent("insight-task-status-change"));
          });
        } else if (field === "requester") {
          console.log("[patchTaskField] Using updateRequesterOptimistic");
          // Use dedicated requester optimistic update
          await updateRequesterOptimistic(storageKey, value, async () => {
            // Optimistic update: immediately update panel cache
            const updates: Partial<InsightTaskItem> = { [field]: value };
            await updateCache(insightId, storageKey, updates);

            // Send API request
            const response = await fetch(
              `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
              },
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed to update ${field}`);
            }

            toast({
              type: "success",
              description: t(
                "insightDetail.updateTask.success",
                "Task updated",
              ),
            });

            // Send global event to notify other panels to refresh
            window.dispatchEvent(new CustomEvent("insight-task-status-change"));
          });
        } else if (field === "context") {
          console.log("[patchTaskField] Using updateContextOptimistic");
          // Use dedicated context optimistic update
          await updateContextOptimistic(storageKey, value, async () => {
            // Optimistic update: immediately update panel cache
            const updates: Partial<InsightTaskItem> = { [field]: value };
            await updateCache(insightId, storageKey, updates);

            // Send API request
            const response = await fetch(
              `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
              },
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed to update ${field}`);
            }

            toast({
              type: "success",
              description: t(
                "insightDetail.updateTask.success",
                "Task updated",
              ),
            });

            // Send global event to notify other panels to refresh
            window.dispatchEvent(new CustomEvent("insight-task-status-change"));
          });
        }
      } catch (error) {
        // Request failed, trigger refresh to restore data
        window.dispatchEvent(new CustomEvent("insight-task-status-change"));

        toast({
          type: "error",
          description: t(
            "insightDetail.updateTask.error",
            error instanceof Error
              ? error.message
              : `Failed to update ${field}`,
          ),
        });
        throw error;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[`${storageKey}-${field}`];
          return newLoadingMap;
        });
      }
    },
    [
      updateDeadlineOptimistic,
      updateOwnerOptimistic,
      updateRequesterOptimistic,
      updateContextOptimistic,
      updateCache,
      t,
    ],
  );

  /**
   * Delete task
   */
  const removeTask = useCallback(
    async (insightId: string, storageKey: string, bucketKey: TaskBucketKey) => {
      setLoadingMap((prev) => ({ ...prev, [storageKey]: true }));

      try {
        // Use global optimistic delete
        await deleteTaskOptimistic(storageKey, async () => {
          // Remove from panel cache
          await removeFromCache(insightId, storageKey);

          // Send API request
          const response = await fetch(
            `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}/remove`,
            { method: "POST" },
          );

          if (!response.ok) {
            throw new Error("Failed to remove task");
          }

          toast({
            type: "success",
            description: t("insightDetail.removeTask.success", "Task removed"),
          });
        });
      } catch (error) {
        toast({
          type: "error",
          description: t(
            "insightDetail.removeTask.error",
            "Failed to remove task. Please try again.",
          ),
        });
        throw error;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[storageKey];
          return newLoadingMap;
        });
      }
    },
    [deleteTaskOptimistic, removeFromCache, t],
  );

  /**
   * Toggle task status (completed/incomplete)
   */
  /**
   * Toggle task status (completed/incomplete)
   */
  const toggleTaskCompletion = useCallback(
    async (
      insightId: string,
      storageKey: string,
      bucketKey: TaskBucketKey,
      isCompleted: boolean,
    ) => {
      setLoadingMap((prev) => ({ ...prev, [storageKey]: true }));

      try {
        // Use global optimistic update
        await toggleCompletionOptimistic(storageKey, isCompleted, async () => {
          // Optimistic update: immediately update panel cache
          await updateTaskStatus(insightId, storageKey, bucketKey, isCompleted);

          // Send API request
          const method = isCompleted ? "PUT" : "DELETE";
          const response = await fetch(
            `/api/insights/${insightId}/buckets/${bucketKey}/tasks/${encodeURIComponent(storageKey)}`,
            { method },
          );

          if (!response.ok) {
            throw new Error("Failed to update task status");
          }

          // Send global event to notify other panels
          window.dispatchEvent(new CustomEvent("insight-task-status-change"));

          toast({
            type: "success",
            description: t(
              "agent.panels.todo.markedCompleted",
              "Item status updated",
            ),
          });
        });
      } catch (error) {
        toast({
          type: "error",
          description: t(
            "insightDetail.todoUpdateFailed",
            "Failed to update task status",
          ),
        });
        throw error;
      } finally {
        setLoadingMap((prev) => {
          const newLoadingMap = { ...prev };
          delete newLoadingMap[storageKey];
          return newLoadingMap;
        });
      }
    },
    [toggleCompletionOptimistic, updateTaskStatus, t],
  );

  return {
    updateTaskTitle,
    updateTaskContext,
    updateTaskPriority,
    updateTaskPrioritySimple,
    updateTaskFields,
    moveTask,
    patchTaskField,
    createTask,
    removeTask,
    toggleTaskCompletion,
    loadingMap,
  };
}
