"use client";

import { useTaskOperations } from "@/hooks/use-task-operations";
import type { InsightTaskItem } from "@/lib/ai/subagents/insights";
import type { Insight } from "@/lib/db/schema";
import { useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useTranslation } from "react-i18next";
import { TodoTabContent } from "./todo-tab-content";
import type { AggregatedTask, TaskFilterTab } from "./todo-types";
import { useTodoData } from "./use-todo-data";
import "../../i18n";

// bundle-dynamic-imports: Dynamically import TaskDetailDialog to reduce initial JS bundle size
const TaskDetailDialogLazy = lazy(() =>
  import("./task-detail-dialog").then((mod) => ({
    default: mod.TaskDetailDialog,
  })),
);

type TaskBucketKey = "myTasks" | "waitingForMe" | "waitingForOthers";

interface AgentTodoPanelProps {
  /**
   * Whether to show completed items
   */
  showCompleted?: boolean;
  /**
   * Currently selected tab (controlled externally, used to sync with header)
   */
  activeTab?: TaskFilterTab;
  /**
   * Header props update callback
   * Called when internal state changes, used to update header props
   */
  onHeaderPropsChange?: (props: {
    taskCounts: Partial<Record<TaskFilterTab, number>>;
  }) => void;
  /**
   * Callback when clicking "Related Event" card inside task detail dialog (opens the event in current panel)
   */
  onOpenRelatedInsight?: (insight: Insight) => void;
}

const tabItems: TaskFilterTab[] = [
  "all",
  "waitingForMe",
  "isUnreplied",
  "myTasks",
  "waitingForOthers",
];

export function AgentTodoPanel({
  showCompleted = false,
  activeTab: externalActiveTab,
  onHeaderPropsChange,
  onOpenRelatedInsight,
}: AgentTodoPanelProps = {}) {
  const { t } = useTranslation();
  const { data: session } = useSession();

  // Task detail dialog state
  const [detailTaskEntry, setDetailTaskEntry] = useState<{
    key: string;
    storageKey: string;
    task: InsightTaskItem;
    link: string | null;
    bucketKey: TaskBucketKey;
    insightId: string;
    insight: Insight; // Add full insight object
  } | null>(null);

  // Track if component has been initialized to avoid triggering onHeaderPropsChange immediately on mount
  const initializedRef = useRef(false);

  // Use externally passed activeTab and onTabChange; fall back to internal state if not provided
  const activeTab = externalActiveTab ?? "all";

  // Dynamically set status filter based on showCompleted state
  const statusFilter = showCompleted ? "completed" : "pending";

  const {
    filteredTasks,
    isLoading,
    error,
    mutateInsightList: originalMutateInsightList,
  } = useTodoData({
    t,
    statusFilter,
    statusOverrides: {}, // No longer need local override; use global cache updates
  });

  const mutateInsightList = originalMutateInsightList;

  // Use unified task operations hook
  const {
    toggleTaskCompletion: handleUpdateTaskStatus,
    moveTask,
    patchTaskField,
    updateTaskPrioritySimple,
    loadingMap,
  } = useTaskOperations();

  const statusLabels = useMemo(
    () => ({
      pending: t("insightDetail.todoPending", "Pending"),
      completed: t("insightDetail.todoCompleted", "Completed"),
      blocked: t("insightDetail.todoBlocked", "Blocked"),
      delegated: t("insightDetail.todoDelegated", "Delegated"),
    }),
    [t],
  );

  const typeLabels = useMemo(
    () => ({
      myTasks: t("agent.panels.todo.tabs.myCommitments", "My commitments"),
      isUnreplied: t("agent.panels.todo.tabs.unreplied", "Unreplied"),
      waitingForOthers: t(
        "agent.panels.todo.tabs.othersCommitments",
        "Others' commitments",
      ),
      waitingForMe: t("agent.panels.todo.tabs.waitingForMe", "Waiting for me"),
    }),
    [t],
  );

  const copy = useMemo(
    () => ({
      pendingGroup: t("agent.panels.todo.pendingGroup", "Pending"),
      completedGroup: t("agent.panels.todo.completedGroup", "Completed"),
      noDeadline: t("agent.panels.todo.noDeadline", "No deadline"),
      unreplied: t(
        "agent.panels.todo.unrepliedLabel",
        "Items awaiting my reply",
      ),
      selectAll: t(
        "agent.panels.todo.selectAll",
        "Select all completable items",
      ),
      bulkComplete: t("agent.panels.todo.bulkComplete", "Bulk complete"),
      refresh: t("common.refresh", "Refresh"),
      loadFailed: t("agent.panels.todo.loadFailed", "Failed to load items"),
      empty: t("agent.panels.todo.empty", "No relevant items"),
      emptyPending: t(
        "agent.panels.todo.emptyWithoutCompleted",
        "No items to complete",
      ),
      hiddenCompletedHint: t(
        "agent.panels.todo.hiddenCompletedHint",
        'Completed items are hidden. Click "Show completed" above to view them.',
      ),
      completeAction: t("insightDetail.todoMarkDone", "Mark as complete"),
    }),
    [t],
  );

  // Calculate task count for each tab
  const taskCounts = useMemo(() => {
    const counts: Partial<Record<TaskFilterTab, number>> = {};
    for (const tab of tabItems) {
      counts[tab] = (filteredTasks[tab] ?? []).length;
    }
    return counts;
  }, [filteredTasks]);

  // When state changes, notify external to update header props
  useEffect(() => {
    // Skip calls during initialization to avoid infinite loop when mobile components remount
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    // Use setTimeout to delay call, avoid triggering state update during render
    const timer = setTimeout(() => {
      if (onHeaderPropsChange) {
        onHeaderPropsChange({ taskCounts });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [onHeaderPropsChange, taskCounts]);

  // Listen for global task status change events, auto-refresh data
  useEffect(() => {
    const handleGlobalTaskStatusChange = () => {
      mutateInsightList();
    };

    window.addEventListener(
      "insight-task-status-change",
      handleGlobalTaskStatusChange,
    );
    return () => {
      window.removeEventListener(
        "insight-task-status-change",
        handleGlobalTaskStatusChange,
      );
    };
  }, [mutateInsightList]);

  // Build contact list (for assignee selection)
  const buildOwnerSuggestions = useCallback(
    (insight: Insight | null): string[] => {
      const suggestions: string[] = [];

      if (!insight) return suggestions;

      // Add current user
      if (session?.user?.name) {
        suggestions.push(session.user.name);
      }

      // Add contacts from insight.people
      const people =
        insight.people?.filter(
          (p) =>
            p &&
            !p.startsWith("anonymous user") &&
            !p.startsWith("unknown") &&
            p !== session?.user?.name,
        ) ?? [];
      for (const person of people) {
        if (!suggestions.includes(person)) {
          suggestions.push(person);
        }
      }

      // Add contacts from insight.stakeholders
      const stakeholders =
        insight.stakeholders?.filter(
          (s) => s?.name && s.name !== session?.user?.name,
        ) ?? [];
      for (const stakeholder of stakeholders) {
        if (stakeholder.name && !suggestions.includes(stakeholder.name)) {
          suggestions.push(stakeholder.name);
        }
      }

      return suggestions;
    },
    [session?.user?.name],
  );

  const handleRetry = useCallback(() => {
    mutateInsightList();
  }, [mutateInsightList]);

  const handleMarkComplete = useCallback(
    (task: AggregatedTask) => {
      if (task.bucket && task.taskId) {
        // Toggle: pending -> completed, completed -> pending
        const isCompleted = task.status === "completed";
        handleUpdateTaskStatus(
          task.insight.id,
          task.taskId,
          task.bucket,
          !isCompleted,
        );
      }
    },
    [handleUpdateTaskStatus],
  );

  const handleOpenTask = useCallback((task: AggregatedTask) => {
    if (task.bucket && task.taskId) {
      // Build InsightTaskItem object
      const taskItem: InsightTaskItem = {
        id: task.taskId,
        title: task.taskName,
        context: task.context ?? null,
        deadline: task.deadline || null,
        followUpAt: task.rawDeadline || null,
        status: task.status,
        priority: task.priority,
        owner: task.owner ?? null,
        requester: task.requester ?? null,
      };

      setDetailTaskEntry({
        key: `${task.taskId}|${Date.now()}`,
        storageKey: task.taskId,
        task: taskItem,
        link: null,
        bucketKey: task.bucket,
        insightId: task.insight.id,
        insight: task.insight,
      });
    }
  }, []);

  const handleTaskCreated = useCallback(() => {
    void mutateInsightList();
  }, [mutateInsightList]);

  const handleCloseDialog = useCallback(() => {
    setDetailTaskEntry(null);
  }, []);

  const handleToggleTaskCompletion = useCallback(
    async (
      storageKey: string,
      bucketKey: TaskBucketKey,
      isCompleted: boolean,
    ) => {
      if (!detailTaskEntry) return;
      await handleUpdateTaskStatus(
        detailTaskEntry.insightId,
        storageKey,
        bucketKey,
        isCompleted,
      );
    },
    [detailTaskEntry, handleUpdateTaskStatus],
  );

  const handleTaskUpdated = useCallback(() => {
    mutateInsightList();
  }, [mutateInsightList]);

  const handleTaskDeleted = useCallback(() => {
    mutateInsightList();
  }, [mutateInsightList]);

  const handlePrioritySelect = useCallback(
    async (
      storageKey: string,
      bucketKey: TaskBucketKey,
      priority: "high" | "medium" | "low" | null,
    ) => {
      if (!detailTaskEntry) return;
      await updateTaskPrioritySimple(
        detailTaskEntry.insightId,
        storageKey,
        bucketKey,
        priority,
      );
      // Update task priority in detailTaskEntry to ensure immediate UI update
      if (detailTaskEntry?.storageKey === storageKey) {
        setDetailTaskEntry((prev) =>
          prev
            ? {
                ...prev,
                task: {
                  ...prev.task,
                  priority: priority as InsightTaskItem["priority"],
                },
              }
            : null,
        );
      }
    },
    [detailTaskEntry, updateTaskPrioritySimple],
  );

  const handleTypeSelect = useCallback(
    async (
      storageKey: string,
      bucketKey: TaskBucketKey,
      newBucket: TaskBucketKey,
    ) => {
      if (!detailTaskEntry) return;
      await moveTask(
        detailTaskEntry.insightId,
        storageKey,
        bucketKey,
        newBucket,
      );
    },
    [detailTaskEntry, moveTask],
  );

  const handleFieldUpdate = useCallback(
    async (
      storageKey: string,
      bucketKey: TaskBucketKey,
      field: "context" | "owner" | "requester" | "deadline",
      value: string | null,
    ) => {
      if (!detailTaskEntry) return;
      await patchTaskField(
        detailTaskEntry.insightId,
        storageKey,
        bucketKey,
        field,
        value,
      );
    },
    [detailTaskEntry, patchTaskField],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        {tabItems.map((tab) => (
          <TodoTabContent
            key={tab}
            tab={tab}
            activeTab={activeTab}
            tasks={filteredTasks[tab] ?? []}
            showCompleted={showCompleted}
            isLoading={isLoading}
            error={error}
            loadingMap={loadingMap}
            statusLabels={statusLabels}
            typeLabels={typeLabels}
            pendingTitle={copy.pendingGroup}
            completedTitle={copy.completedGroup}
            noDeadlineLabel={copy.noDeadline}
            refreshLabel={copy.refresh}
            loadFailedLabel={copy.loadFailed}
            emptyLabel={copy.empty}
            emptyPendingLabel={copy.emptyPending}
            hiddenCompletedHint={copy.hiddenCompletedHint}
            onRetry={handleRetry}
            onMarkComplete={handleMarkComplete}
            onOpenTask={handleOpenTask}
            onTaskCreated={handleTaskCreated}
          />
        ))}
      </div>

      {/* Task detail dialog */}
      {detailTaskEntry && (
        <Suspense fallback={null}>
          <TaskDetailDialogLazy
            insightId={detailTaskEntry.insightId}
            insight={detailTaskEntry.insight}
            detailTaskEntry={detailTaskEntry}
            onClose={handleCloseDialog}
            toggleTaskCompletion={handleToggleTaskCompletion}
            ownerSuggestions={buildOwnerSuggestions(detailTaskEntry.insight)}
            currentUserName={session?.user?.name ?? undefined}
            onTaskUpdated={handleTaskUpdated}
            onTaskDeleted={handleTaskDeleted}
            onPrioritySelect={handlePrioritySelect}
            onTypeSelect={handleTypeSelect}
            onFieldUpdate={handleFieldUpdate}
            onOpenRelatedInsight={onOpenRelatedInsight}
          />
        </Suspense>
      )}
    </div>
  );
}
