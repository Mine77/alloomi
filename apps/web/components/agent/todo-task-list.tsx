"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "../../i18n";
import type { InsightTaskStatus } from "@/lib/db/schema";
import { RemixIcon } from "@/components/remix-icon";
import type { AggregatedTask, TaskType } from "./todo-types";

type TaskBucketKey = "myTasks" | "waitingForMe" | "waitingForOthers";
import {
  InsightTaskCard,
  getTaskStatusColor,
} from "@/components/insight-task-card";
import { toast } from "@/components/toast";
import { useInsightOptimisticUpdates } from "@/components/insight-optimistic-context";
import { useTaskOperations } from "@/hooks/use-task-operations";
import { cn } from "@/lib/utils";

type TodoTaskListProps = {
  tasks: AggregatedTask[];
  showCompleted: boolean;
  statusLabels: Record<InsightTaskStatus, string>;
  typeLabels: Record<TaskType, string>;
  loadingMap: Record<string, boolean>;
  pendingTitle: string;
  completedTitle: string;
  onMarkComplete: (task: AggregatedTask) => void;
  onOpenTask: (task: AggregatedTask) => void;
  onTaskCreated?: () => void | Promise<void>;
  /** Optional rendering at the bottom of each card (e.g., "Locate to event" link) */
  renderCardExtra?: (task: AggregatedTask) => ReactNode;
};

/**
 * Action item list: directly uses InsightTaskCard (same component as Insight detail), with inline title editing, does not show one-click execute.
 */
export function TodoTaskList({
  tasks,
  showCompleted,
  statusLabels,
  typeLabels,
  loadingMap,
  pendingTitle,
  completedTitle,
  onMarkComplete,
  onOpenTask,
  onTaskCreated,
  renderCardExtra,
}: TodoTaskListProps) {
  const { t } = useTranslation();
  const { updateTaskTitle } = useTaskOperations();

  // Global optimistic update management
  const { getTitle, getPriority, getBucket, getFields, getTaskUpdates } =
    useInsightOptimisticUpdates();

  const [editingTitleInline, setEditingTitleInline] = useState<{
    taskId: string;
    insightId: string;
    bucketKey: TaskBucketKey;
    storageKey: string;
    value: string;
  } | null>(null);

  const startInlineTitleEdit = useCallback((task: AggregatedTask) => {
    if (!task.bucket || !task.taskId) return;
    setEditingTitleInline({
      taskId: task.id,
      insightId: task.insight.id,
      bucketKey: task.bucket,
      storageKey: task.taskId,
      value: task.taskName,
    });
  }, []);

  const cancelInlineTitleEdit = useCallback(() => {
    setEditingTitleInline(null);
  }, []);

  const saveInlineTitle = useCallback(
    async (
      insightId: string,
      bucketKey: TaskBucketKey,
      storageKey: string,
      newTitle: string,
      originalTitle: string,
    ) => {
      const nextTitle = newTitle.trim();
      if (!nextTitle) {
        toast({
          type: "error",
          description: t(
            "insightDetail.createTask.titleRequired",
            "Please enter a task title",
          ),
        });
        return;
      }
      if (nextTitle === originalTitle.trim()) {
        setEditingTitleInline(null);
        return;
      }
      setEditingTitleInline(null);
      try {
        await updateTaskTitle(
          insightId,
          storageKey,
          bucketKey,
          nextTitle,
          originalTitle,
        );
        await onTaskCreated?.();
      } catch (e) {
        // Error is already handled by the hook
        setEditingTitleInline({
          taskId: "",
          insightId,
          bucketKey,
          storageKey,
          value: nextTitle,
        });
      }
    },
    [updateTaskTitle, onTaskCreated, t],
  );

  const renderGroup = (
    title: string,
    list: AggregatedTask[],
    muted?: boolean,
  ) => (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-2 text-xs font-medium text-muted-foreground",
          muted ? "text-muted-foreground/70" : "",
        )}
      >
        <RemixIcon name="list_checks" size="size-4" />
        <span>
          {title} · {list.length}
        </span>
      </div>
      <div className="space-y-2">
        {list.map((task) => {
          const storageKey = task.taskId;
          const bucketKey = task.bucket;

          // Use getTaskUpdates to uniformly get task object and bucket optimistic updates
          const optimisticUpdate =
            storageKey && bucketKey
              ? getTaskUpdates(storageKey, task as any, bucketKey)
              : { task: task, bucketKey: bucketKey };
          const { task: optimisticTask, bucketKey: displayBucket } =
            optimisticUpdate;

          // Apply optimistic update
          const displayTitle = storageKey
            ? getTitle(storageKey, task.taskName)
            : task.taskName;
          const effectivePriority = storageKey
            ? getPriority(storageKey, task.priority)
            : task.priority;

          const effectiveDeadline =
            optimisticTask.deadline ?? optimisticTask.rawDeadline ?? null;
          const isCompleted = optimisticTask.status === "completed";

          const canToggleStatus = !!task.selectable && !isCompleted;
          const isEditingThis = editingTitleInline?.taskId === task.id;
          const canEdit = !!(task.bucket && task.taskId);

          return (
            <InsightTaskCard
              key={`${task.id}-${isCompleted}`}
              cardKey={task.id}
              title={displayTitle}
              isCompleted={isCompleted}
              canToggleStatus={canToggleStatus}
              isLoadingCheckbox={Boolean(loadingMap[task.id])}
              onToggleComplete={() => onMarkComplete(task)}
              priorityLabel={effectivePriority}
              effectivePriority={
                effectivePriority as "high" | "medium" | "low" | null
              }
              typeLabel={
                displayBucket
                  ? typeLabels[displayBucket]
                  : typeLabels[task.taskType]
              }
              deadlineLabel={effectiveDeadline ?? "-"}
              onCardClick={() => onOpenTask(task)}
              disableCardClick={isEditingThis}
              statusBadge={
                task.status !== "pending"
                  ? statusLabels[task.status]
                  : undefined
              }
              statusColor={
                task.status !== "pending"
                  ? getTaskStatusColor(task.status)
                  : undefined
              }
              detailActions={
                canEdit
                  ? {
                      isEditingTitle: isEditingThis,
                      editValue:
                        isEditingThis && editingTitleInline
                          ? editingTitleInline.value
                          : displayTitle,
                      onEditChange: (value) =>
                        setEditingTitleInline((prev) =>
                          prev && prev.taskId === task.id
                            ? { ...prev, value }
                            : prev,
                        ),
                      onEditSave: () => {
                        if (
                          !editingTitleInline ||
                          editingTitleInline.taskId !== task.id
                        )
                          return;
                        saveInlineTitle(
                          editingTitleInline.insightId,
                          editingTitleInline.bucketKey,
                          editingTitleInline.storageKey,
                          editingTitleInline.value,
                          displayTitle,
                        );
                      },
                      onEditBlur: () => {
                        if (
                          !editingTitleInline ||
                          editingTitleInline.taskId !== task.id
                        )
                          return;
                        saveInlineTitle(
                          editingTitleInline.insightId,
                          editingTitleInline.bucketKey,
                          editingTitleInline.storageKey,
                          editingTitleInline.value,
                          displayTitle,
                        );
                      },
                      onEditKeyDown: (e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelInlineTitleEdit();
                        }
                      },
                      onStartEdit: () => startInlineTitleEdit(task),
                      isSavingTitle: Boolean(
                        task.taskId && loadingMap[task.taskId],
                      ),
                      showExecuteButton: false,
                      onExecute: () => {},
                      executeDisabled: true,
                    }
                  : undefined
              }
            >
              {renderCardExtra?.(task)}
            </InsightTaskCard>
          );
        })}
      </div>
    </div>
  );

  // Filter tasks using optimistic updates
  const pendingTasks = tasks.filter((task) => {
    const storageKey = task.taskId;
    const bucketKey = task.bucket;
    const optimisticUpdate =
      storageKey && bucketKey
        ? getTaskUpdates(storageKey, task as any, bucketKey)
        : { task: task, bucketKey: bucketKey };
    return optimisticUpdate.task.status !== "completed";
  });
  const completedTasks = tasks.filter((task) => {
    const storageKey = task.taskId;
    const bucketKey = task.bucket;
    const optimisticUpdate =
      storageKey && bucketKey
        ? getTaskUpdates(storageKey, task as any, bucketKey)
        : { task: task, bucketKey: bucketKey };
    return optimisticUpdate.task.status === "completed";
  });

  return (
    <div className="space-y-6 pb-4">
      {renderGroup(pendingTitle, pendingTasks)}
      {showCompleted && renderGroup(completedTitle, completedTasks, true)}
    </div>
  );
}
