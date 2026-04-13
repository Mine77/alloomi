"use client";

import { ScheduledJobsPanel } from "@/components/scheduled-jobs-panel";
import type { ScheduledJobsPanelRef } from "@/components/scheduled-jobs-panel";
import type { ScheduledJobsStatusFilter } from "@/components/scheduled-jobs-panel";
import { forwardRef } from "react";

interface AutomationTabProps {
  /**
   * Scheduled task filter status.
   * Filter buttons at the top of the page drive the task list display via this value.
   */
  statusFilter: ScheduledJobsStatusFilter;
  /**
   * Task search term (matches both name and description).
   */
  searchQuery?: string;
}

export const AutomationTab = forwardRef<
  ScheduledJobsPanelRef,
  AutomationTabProps
>(
  /**
   * Automation tab: renders the scheduled jobs list panel.
   */
  function AutomationTab({ statusFilter, searchQuery }, ref) {
    return (
      <ScheduledJobsPanel
        ref={ref}
        className="flex-1 min-h-0"
        hideHeader
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />
    );
  },
);
