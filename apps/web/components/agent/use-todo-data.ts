"use client";

import { useCallback, useMemo } from "react";
import type { TFunction } from "i18next";
import type { InsightTaskItem } from "@/lib/ai/subagents/insights";
import type { Insight, InsightTaskStatus } from "@/lib/db/schema";
import {
  type AggregatedTask,
  type TaskFilterTab,
  type TaskType,
  type StatusFilter,
  buildStorageKey,
  formatDeadline,
} from "./todo-types";
import useSWRInfinite from "swr/infinite";
import type { InsightResponse } from "@/components/insight-card";
import { fetcher } from "@/lib/utils";

// Independent pagination size configuration
const PAGE_SIZE = 100;

/**
 * Generate independent SWR key for todo panel
 * Does not depend on global InsightsPaginationContext
 */
function getTodoPaginationKey(
  pageIndex: number,
  previousPageData: InsightResponse | null,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) return `/api/insights?limit=${PAGE_SIZE}`;

  const item = previousPageData?.items.at(-1);
  if (!item) return null;

  return `/api/insights?ending_before=${item.id}&limit=${PAGE_SIZE}`;
}

function useBuildTasks(t: TFunction) {
  return useCallback(
    (
      insight: Insight,
      bucket: Exclude<TaskType, "isUnreplied">,
      list: InsightTaskItem[] | null | undefined,
    ): AggregatedTask[] => {
      if (!Array.isArray(list) || list.length === 0) return [];
      const tasks: AggregatedTask[] = [];
      list.forEach((task, index) => {
        if (!task) return;
        const storageKey = buildStorageKey(task, insight.id, bucket, index);
        const name =
          task.title?.trim() ||
          task.context?.trim() ||
          t("insightDetail.todoUntitled", "Untitled task");
        tasks.push({
          id: `${insight.id}|${bucket}|${storageKey}`,
          taskId: storageKey,
          taskName: name,
          taskType: bucket,
          status: (task.status as InsightTaskStatus) ?? "pending",
          deadline: formatDeadline(task.deadline, task.followUpAt),
          rawDeadline: task.rawDeadline ?? task.deadline ?? null,
          insight,
          bucket,
          selectable: true,
          priority:
            task.priority === "high" ||
            task.priority === "medium" ||
            task.priority === "low"
              ? task.priority
              : null,
          owner: task.owner ?? null,
          requester: task.requester ?? null,
          context: task.context ?? null,
        });
      });
      return tasks;
    },
    [t],
  );
}

export function useTodoData({
  t,
  statusFilter,
  statusOverrides,
}: {
  t: TFunction;
  statusFilter: StatusFilter;
  statusOverrides: Record<string, InsightTaskStatus>;
}) {
  // Use independent SWR Infinite hook, not dependent on global context
  const {
    error,
    data: pages,
    setSize,
    isValidating,
    isLoading,
    mutate: mutateInsightList,
  } = useSWRInfinite<InsightResponse>(
    (pageIndex, previousPageData) =>
      getTodoPaginationKey(pageIndex, previousPageData),
    fetcher,
    { fallbackData: [], initialSize: 1 },
  );

  // Calculate derived data
  const insightData = useMemo(() => {
    if (!pages) return { items: [], sessions: [], percent: null };
    return {
      items: pages.flatMap((page) => page.items || []),
      sessions: pages.flatMap((page) => page.sessions || []),
      percent: pages[pages.length - 1]?.percent ?? null,
    };
  }, [pages]);

  const hasMore = useMemo(() => {
    if (!pages) return false;
    return pages[pages.length - 1]?.hasMore ?? false;
  }, [pages]);

  const hasReachedEnd = useMemo(
    () => pages?.some((page) => page.hasMore === false) ?? false,
    [pages],
  );

  const incrementSize = useCallback(
    () => setSize((prev) => prev + 1),
    [setSize],
  );

  const insights = insightData?.items ?? [];
  const buildTasks = useBuildTasks(t);

  const aggregatedTasks = useMemo(() => {
    const tasks: AggregatedTask[] = [];
    insights.forEach((insight) => {
      tasks.push(...buildTasks(insight, "myTasks", insight.myTasks));
      tasks.push(...buildTasks(insight, "waitingForMe", insight.waitingForMe));
      tasks.push(
        ...buildTasks(insight, "waitingForOthers", insight.waitingForOthers),
      );

      if (insight.isUnreplied) {
        const detailTime = insight.details?.[insight.details.length - 1]?.time;
        const deadline = formatDeadline(
          detailTime ? String(detailTime) : (insight.time?.toString() ?? null),
          insight.time ? String(insight.time) : null,
        );
        tasks.push({
          id: `${insight.id}|isUnreplied`,
          taskId: null,
          taskName: insight.title ?? t("agent.panels.todo.unrepliedLabel"),
          taskType: "isUnreplied",
          status: "pending",
          deadline,
          rawDeadline: insight.time?.toString() ?? null,
          insight,
          bucket: null,
          selectable: false,
          priority: null,
        });
      }
    });
    return tasks;
  }, [buildTasks, insights, t]);

  // Core: deduplicate by task title (can adjust deduplication rules as needed)
  const aggregatedTasksUnique = useMemo(() => {
    const seenTaskNames = new Set<string>();
    return aggregatedTasks.filter((task) => {
      // Optional rule 1: exclude isUnreplied type task deduplication (keep all unreplied tasks)
      if (task.taskType === "isUnreplied") {
        return true;
      }
      // Optional rule 2: normalize title (ignore case, leading/trailing spaces), avoid duplication due to formatting issues
      const normalizedTaskName = task.taskName.trim().toLowerCase();
      // Optional rule 3: combine task type for deduplication (keep tasks of different types even with same title)
      // const uniqueKey = `${task.taskType}|${normalizedTaskName}`;

      if (seenTaskNames.has(normalizedTaskName)) {
        return false;
      }
      seenTaskNames.add(normalizedTaskName);
      return true;
    });
  }, [aggregatedTasks]);

  // Generate tasks with status using deduplicated task list
  const tasksWithStatus = useMemo(
    () =>
      aggregatedTasksUnique.map((task) => ({
        ...task,
        status: statusOverrides[task.id] ?? task.status,
      })),
    [aggregatedTasksUnique, statusOverrides],
  );

  const tasksByTab = useMemo(() => {
    const base: Record<TaskFilterTab, AggregatedTask[]> = {
      all: [],
      myTasks: [],
      isUnreplied: [],
      waitingForMe: [],
      waitingForOthers: [],
    };
    tasksWithStatus.forEach((task) => {
      base.all.push(task);
      base[task.taskType].push(task);
    });
    return base;
  }, [tasksWithStatus]);

  const filteredTasks = useMemo(() => {
    const applyFilters = (tasks: AggregatedTask[]) =>
      tasks.filter((task) => {
        // Filter tasks by statusFilter
        if (statusFilter === "completed") {
          // Only show completed tasks
          return task.status === "completed";
        } else if (statusFilter === "pending") {
          // Only show incomplete tasks (pending, blocked, delegated)
          return task.status !== "completed";
        }

        // statusFilter is "all", show all tasks
        return true;
      });

    return Object.fromEntries(
      Object.entries(tasksByTab).map(([key, list]) => [
        key,
        applyFilters(list),
      ]),
    ) as Record<TaskFilterTab, AggregatedTask[]>;
  }, [statusFilter, tasksByTab]);

  return {
    insights,
    filteredTasks,
    isLoading,
    error,
    mutateInsightList,
    aggregatedTasksUnique,
    pages,
    insightData,
    hasMore,
    incrementSize,
    isValidating,
    hasReachedEnd,
  };
}
