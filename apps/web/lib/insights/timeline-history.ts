import { db } from "@/lib/db";
import {
  insightTimelineHistory,
  type InsertInsightTimelineHistory,
  type InsightTimelineHistory,
} from "@/lib/db/schema";
import type { TimelineData } from "@/lib/ai/subagents/insights";
import { eq, and, desc } from "drizzle-orm";

/**
 * Timeline History Service
 * Manages version control and history tracking for insight timeline events
 */
export class TimelineHistoryService {
  /**
   * Record the creation of a new timeline event
   */
  async recordTimelineEventCreation(
    insightId: string,
    event: TimelineData & { id: string },
    sourceMessageId?: string,
  ): Promise<void> {
    const record: InsertInsightTimelineHistory = {
      insightId,
      timelineEventId: event.id,
      version: 1,
      eventTime: event.time?.toString() ?? null,
      summary: event.summary ?? "",
      label: event.label ?? "",
      changeType: "created",
      changeReason: "New timeline event created from insight generation",
      changedBy: "system",
      previousSnapshot: null,
      diffSummary: "Initial version",
      sourceMessageId: sourceMessageId ?? null,
    };

    await db.insert(insightTimelineHistory).values(record);
  }

  /**
   * Record an update to an existing timeline event
   */
  async recordTimelineEventUpdate(
    insightId: string,
    eventId: string,
    oldEvent: TimelineData,
    newEvent: TimelineData,
    changeReason: string,
    sourceMessageId?: string,
  ): Promise<void> {
    // Generate diff summary
    const diffSummary = this.generateDiffSummary(oldEvent, newEvent);

    const newVersion = (oldEvent.version ?? 1) + 1;

    const record: InsertInsightTimelineHistory = {
      insightId,
      timelineEventId: eventId,
      version: newVersion,
      eventTime: newEvent.time?.toString() ?? null,
      summary: newEvent.summary ?? "",
      label: newEvent.label ?? "",
      changeType: "updated",
      changeReason,
      changedBy: "system",
      previousSnapshot: JSON.stringify(oldEvent),
      diffSummary,
      sourceMessageId: sourceMessageId ?? null,
    };

    await db.insert(insightTimelineHistory).values(record);
  }

  /**
   * Get all history records for a specific timeline event
   */
  async getEventHistory(eventId: string): Promise<InsightTimelineHistory[]> {
    const history = await db
      .select()
      .from(insightTimelineHistory)
      .where(eq(insightTimelineHistory.timelineEventId, eventId))
      .orderBy(desc(insightTimelineHistory.createdAt));

    return history;
  }

  /**
   * Get history records for an insight
   */
  async getInsightHistory(
    insightId: string,
  ): Promise<InsightTimelineHistory[]> {
    const history = await db
      .select()
      .from(insightTimelineHistory)
      .where(eq(insightTimelineHistory.insightId, insightId))
      .orderBy(desc(insightTimelineHistory.createdAt));

    return history;
  }

  /**
   * Get the state of an event at a specific time point
   */
  async getEventAtTime(
    eventId: string,
    timestamp: number,
  ): Promise<TimelineData | null> {
    const history = await db
      .select()
      .from(insightTimelineHistory)
      .where(
        and(
          eq(insightTimelineHistory.timelineEventId, eventId),
          // Find the most recent version before or at the timestamp
          // createdAt <= timestamp
        ),
      )
      .orderBy(desc(insightTimelineHistory.createdAt))
      .limit(1);

    if (history.length === 0) {
      return null;
    }

    // Return the event state from this history record
    return {
      time: history[0].time ?? undefined,
      summary: history[0].summary,
      label: history[0].label,
      version: history[0].version,
      lastUpdatedAt: new Date(history[0].createdAt).getTime(),
    };
  }

  /**
   * Generate a human-readable diff summary between two timeline events
   */
  private generateDiffSummary(
    oldEvent: TimelineData,
    newEvent: TimelineData,
  ): string {
    const changes: string[] = [];

    // Check for summary changes
    if (oldEvent.summary !== newEvent.summary) {
      changes.push("Summary updated");
    }

    // Check for time changes (more than 1 minute difference)
    const timeDiff = Math.abs((oldEvent.time || 0) - (newEvent.time || 0));
    if (timeDiff > 60000) {
      changes.push("Time adjusted");
    }

    // Check for label changes
    if (oldEvent.label !== newEvent.label) {
      changes.push("Source updated");
    }

    if (changes.length === 0) {
      return "Minor update";
    }

    return changes.join(", ");
  }

  /**
   * Generate a change reason using AI (stub for future implementation)
   */
  async generateChangeReason(
    oldEvent: TimelineData,
    newEvent: TimelineData,
    contextMessages?: any[],
  ): Promise<string> {
    // TODO: Integrate with AI service to generate meaningful change reasons
    // For now, use a simple heuristic-based approach

    const changes: string[] = [];

    if (oldEvent.summary !== newEvent.summary) {
      changes.push("new information added");
    }

    if (Math.abs((oldEvent.time || 0) - (newEvent.time || 0)) > 60000) {
      changes.push("timing corrected");
    }

    if (oldEvent.label !== newEvent.label) {
      changes.push("source updated");
    }

    if (changes.length === 0) {
      return "Event refreshed with latest data";
    }

    return `Timeline updated: ${changes.join(", ")}`;
  }
}

// Singleton instance
export const timelineHistoryService = new TimelineHistoryService();
