/**
 * Business Tools MCP Server
 *
 * Provides insights and communication tools for Native Agent.
 * This bridges the gap between Web Agent tools and Native Agent.
 *
 * Tools included:
 * - chatInsight: Query chat insights with filtering
 * - modifyInsight: Modify existing insights
 * - createInsight: Create new insights
 * - sendReply: Send replies to platforms
 * - queryContacts: Query user contacts
 * - queryIntegrations: Query user integrations/bots
 */

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  getBotsByUserId,
  getStoredInsightsByBotIds,
  getInsightByIdForUser,
  getInsightsByIdsForUser,
  updateInsightById,
  insertInsightRecords,
  createBot as createBotRecord,
  getUserContacts,
  deleteInsightsByIds,
  getInsightsWithNotesAndDocuments,
  saveChatInsights,
  getInsightChats,
} from "@/lib/db/queries";
import {
  type InsightFilterDefinition,
  insightFilterDefinitionSchema,
} from "@/lib/insights/filter-schema";
import { filterInsights } from "@/lib/insights/filter-utils";
import {
  sendMessage,
  type SendMessageParams,
} from "@/lib/bots/message-service";
import type { GeneratedInsightPayload } from "@/lib/insights/types";
import { coerceDate } from "@alloomi/shared";
import { formatToLocalTime } from "@/lib/utils";
import { AppError } from "@alloomi/shared/errors";
import type { Session } from "next-auth";
import type { Insight } from "@/lib/db/schema";
import type { TimelineData } from "@/lib/ai/subagents/insights";
import {
  searchSimilarChunks,
  formatSearchResultsForLLM,
  getDocumentFullContent,
  getDocument,
} from "@/lib/rag/langchain-service";
import { getDb } from "@/lib/db/adapters";
import {
  insight,
  ragDocuments,
  ragChunks,
  insightDocuments,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { deriveBlobPathFromUrl } from "@/lib/files/blob-path";
import { getAppDataDir, joinPath } from "@/lib/utils/path";
import { getAppUrl, AI_PROXY_BASE_URL } from "@/lib/env";

/**
 * Task type for createInsight tool
 */
type TaskInput =
  | { text: string; completed?: boolean; deadline?: string; owner?: string }
  | string
  | undefined;

/**
 * Normalize task input to standard object format
 */
function normalizeTask(task: TaskInput): {
  text: string;
  completed: boolean;
  deadline?: string;
  owner?: string;
} {
  if (!task) {
    return { text: "", completed: false };
  }

  if (typeof task === "string") {
    try {
      const parsed = JSON.parse(task);
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.text === "string") {
          return { ...parsed, completed: parsed.completed ?? false };
        }
        return { text: task, completed: false };
      }
    } catch {
      // If not valid JSON, use string as text
    }
    return { text: task, completed: false };
  }

  if (task.text && typeof task.text === "string") {
    const trimmedText = task.text.trim();

    // Check for nested JSON object
    if (trimmedText.startsWith('"') && trimmedText.endsWith('"')) {
      try {
        const withoutOuterQuotes = trimmedText.slice(1, -1);
        const parsed = JSON.parse(withoutOuterQuotes.replace(/'/g, '"'));
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof parsed.text === "string"
        ) {
          return {
            ...parsed,
            completed: task.completed ?? parsed.completed ?? false,
          };
        }
      } catch {
        // Parse failed
      }
    }

    // Check for JSON object
    if (trimmedText.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmedText.replace(/'/g, '"'));
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof parsed.text === "string"
        ) {
          return {
            ...parsed,
            completed: task.completed ?? parsed.completed ?? false,
          };
        }
      } catch {
        // Parse failed
      }
    }
  }

  return { ...task, completed: task.completed ?? false };
}

/**
 * Normalize importance value
 */
function normalizeImportance(importance: string | undefined): string {
  if (!importance) return "重要";
  const lower = importance.toLowerCase();
  if (
    lower.includes("一般") ||
    lower === "general" ||
    lower === "normal" ||
    lower === "medium"
  ) {
    return "一般";
  }
  if (
    lower.includes("不重要") ||
    lower === "not important" ||
    lower === "low"
  ) {
    return "不重要";
  }
  return "重要";
}

/**
 * Normalize urgency value
 */
function normalizeUrgency(urgency: string | undefined): string {
  if (!urgency) return "不紧急";
  const lower = urgency.toLowerCase();
  if (
    lower.includes("尽快") ||
    lower === "asap" ||
    lower === "as soon as possible" ||
    lower === "urgent"
  ) {
    return "尽快";
  }
  if (
    lower.includes("24小时") ||
    lower === "within 24 hours" ||
    lower.includes("24hr") ||
    lower.includes("24hr")
  ) {
    return "24小时内";
  }
  return "不紧急";
}

/**
 * Associate documents with an insight
 * Creates entries in the insight_documents junction table and adds timeline entries
 */
async function associateDocumentsToInsight(
  insightId: string,
  documentIds: string[],
  userId: string,
): Promise<{ success: boolean; associated: string[]; failed: string[] }> {
  const db = getDb();
  const associated: string[] = [];
  const failed: string[] = [];

  for (const documentId of documentIds) {
    try {
      // Verify document exists and belongs to user
      const documentResult = await db
        .select({ userId: ragDocuments.userId })
        .from(ragDocuments)
        .where(eq(ragDocuments.id, documentId))
        .limit(1);

      if (documentResult.length === 0) {
        console.warn(`[associateDocuments] Document ${documentId} not found`);
        failed.push(documentId);
        continue;
      }

      if (documentResult[0].userId !== userId) {
        console.warn(
          `[associateDocuments] Document ${documentId} access denied`,
        );
        failed.push(documentId);
        continue;
      }

      // Check if already associated
      const existingAssociation = await db
        .select({ id: insightDocuments.id })
        .from(insightDocuments)
        .where(
          and(
            eq(insightDocuments.insightId, insightId),
            eq(insightDocuments.documentId, documentId),
          ),
        )
        .limit(1);

      if (existingAssociation.length > 0) {
        console.log(
          `[associateDocuments] Document ${documentId} already associated`,
        );
        associated.push(documentId);
        continue;
      }

      // Create association
      const result = await db
        .insert(insightDocuments)
        .values({
          insightId,
          documentId,
          userId,
        })
        .returning({ id: insightDocuments.id });

      if (result[0]?.id) {
        // Get document info for timeline entry
        const docInfo = await db
          .select({
            fileName: ragDocuments.fileName,
            sizeBytes: ragDocuments.sizeBytes,
            uploadedAt: ragDocuments.uploadedAt,
            contentType: ragDocuments.contentType,
            totalChunks: ragDocuments.totalChunks,
          })
          .from(ragDocuments)
          .where(eq(ragDocuments.id, documentId))
          .limit(1);

        // Get first chunk content preview
        const chunkInfo = await db
          .select({ content: ragChunks.content })
          .from(ragChunks)
          .where(eq(ragChunks.documentId, documentId))
          .orderBy(ragChunks.chunkIndex)
          .limit(1);

        // Get current insight timeline
        // Note: In SQLite mode, timeline is stored as JSON string and needs parsing
        const currentInsight = await db
          .select({ timeline: insight.timeline })
          .from(insight)
          .where(eq(insight.id, insightId))
          .limit(1);

        const rawTimeline = currentInsight[0]?.timeline;
        let currentTimeline: TimelineData[] = [];
        if (rawTimeline) {
          if (Array.isArray(rawTimeline)) {
            currentTimeline = rawTimeline;
          } else if (typeof rawTimeline === "string") {
            try {
              currentTimeline = JSON.parse(rawTimeline);
            } catch {
              currentTimeline = [];
            }
          }
        }

        // Format file size
        const formatFileSize = (bytes: number | null | undefined) => {
          if (!bytes) return "";
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        // Format upload date
        const formatUploadDate = (date: Date | string | null | undefined) => {
          if (!date) return "";
          const d = new Date(date);
          const month = d.toLocaleString("en-US", { month: "short" });
          const day = d.getDate();
          const hour = d.getHours().toString().padStart(2, "0");
          const minute = d.getMinutes().toString().padStart(2, "0");
          return `${month} ${day}, ${hour}:${minute}`;
        };

        // Get file extension/type
        const getFileType = (
          contentType: string | null | undefined,
          fileName: string,
        ) => {
          if (contentType) {
            const parts = contentType.split("/");
            if (parts.length === 2) {
              return parts[1].toUpperCase();
            }
            return contentType;
          }
          // Fallback to extension from filename
          const ext = fileName.split(".").pop()?.toUpperCase();
          return ext || "";
        };

        // Build summary with file info
        const fileSize = formatFileSize(docInfo[0]?.sizeBytes);
        const uploadDate = formatUploadDate(docInfo[0]?.uploadedAt);
        const fileType = getFileType(
          docInfo[0]?.contentType,
          docInfo[0]?.fileName || "",
        );
        // Get first chunk content preview (first 30 characters)
        const contentPreview = chunkInfo[0]?.content
          ? `"${chunkInfo[0].content.slice(0, 30)}..."`
          : "";
        const fileInfo = [contentPreview, fileType, fileSize, uploadDate]
          .filter(Boolean)
          .join(" · ");
        const summary = docInfo[0]
          ? `Added file: ${docInfo[0].fileName}${fileInfo ? ` (${fileInfo})` : ""}`
          : "Added file";

        // Create new timeline event for document attachment
        const newTimelineEvent: TimelineData = {
          time: Date.now(),
          summary,
          label: "File",
        };

        // Update insight's timeline
        await db
          .update(insight)
          .set({
            timeline: JSON.stringify([...currentTimeline, newTimelineEvent]),
          })
          .where(eq(insight.id, insightId));

        associated.push(documentId);
        console.log(
          `[associateDocuments] Document ${documentId} associated successfully`,
        );
      }
    } catch (error) {
      console.error(
        `[associateDocuments] Failed to associate document ${documentId}:`,
        error,
      );
      failed.push(documentId);
    }
  }

  return { success: failed.length === 0, associated, failed };
}

/**
 * Remove document associations from an insight
 */
async function removeDocumentAssociations(
  insightId: string,
  documentIds: string[],
  userId: string,
): Promise<{ success: boolean; removed: string[]; failed: string[] }> {
  const db = getDb();
  const removed: string[] = [];
  const failed: string[] = [];

  for (const documentId of documentIds) {
    try {
      // Verify association exists and belongs to user
      const existingAssociation = await db
        .select({ userId: insightDocuments.userId })
        .from(insightDocuments)
        .where(
          and(
            eq(insightDocuments.insightId, insightId),
            eq(insightDocuments.documentId, documentId),
          ),
        )
        .limit(1);

      if (existingAssociation.length === 0) {
        console.warn(
          `[removeDocumentAssociations] Association not found for ${documentId}`,
        );
        failed.push(documentId);
        continue;
      }

      if (existingAssociation[0].userId !== userId) {
        console.warn(
          `[removeDocumentAssociations] Access denied for ${documentId}`,
        );
        failed.push(documentId);
        continue;
      }

      // Get document info for timeline entry before deletion
      const docInfo = await db
        .select({
          fileName: ragDocuments.fileName,
          sizeBytes: ragDocuments.sizeBytes,
          uploadedAt: ragDocuments.uploadedAt,
          contentType: ragDocuments.contentType,
          totalChunks: ragDocuments.totalChunks,
        })
        .from(ragDocuments)
        .where(eq(ragDocuments.id, documentId))
        .limit(1);

      // Get first chunk content preview
      const chunkInfo = await db
        .select({ content: ragChunks.content })
        .from(ragChunks)
        .where(eq(ragChunks.documentId, documentId))
        .orderBy(ragChunks.chunkIndex)
        .limit(1);

      // Delete association
      await db
        .delete(insightDocuments)
        .where(
          and(
            eq(insightDocuments.insightId, insightId),
            eq(insightDocuments.documentId, documentId),
          ),
        );

      // Get current insight timeline
      // Note: In SQLite mode, timeline is stored as JSON string and needs parsing
      const currentInsight = await db
        .select({ timeline: insight.timeline })
        .from(insight)
        .where(eq(insight.id, insightId))
        .limit(1);

      const rawTimeline = currentInsight[0]?.timeline;
      let currentTimeline: TimelineData[] = [];
      if (rawTimeline) {
        if (Array.isArray(rawTimeline)) {
          currentTimeline = rawTimeline;
        } else if (typeof rawTimeline === "string") {
          try {
            currentTimeline = JSON.parse(rawTimeline);
          } catch {
            currentTimeline = [];
          }
        }
      }

      // Format file size
      const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      // Format upload date
      const formatUploadDate = (date: Date | string | null | undefined) => {
        if (!date) return "";
        const d = new Date(date);
        const month = d.toLocaleString("en-US", { month: "short" });
        const day = d.getDate();
        const hour = d.getHours().toString().padStart(2, "0");
        const minute = d.getMinutes().toString().padStart(2, "0");
        return `${month} ${day}, ${hour}:${minute}`;
      };

      // Get file extension/type
      const getFileType = (
        contentType: string | null | undefined,
        fileName: string,
      ) => {
        if (contentType) {
          const parts = contentType.split("/");
          if (parts.length === 2) {
            return parts[1].toUpperCase();
          }
          return contentType;
        }
        // Fallback to extension from filename
        const ext = fileName.split(".").pop()?.toUpperCase();
        return ext || "";
      };

      // Build summary with file info
      const fileSize = formatFileSize(docInfo[0]?.sizeBytes);
      const uploadDate = formatUploadDate(docInfo[0]?.uploadedAt);
      const fileType = getFileType(
        docInfo[0]?.contentType,
        docInfo[0]?.fileName || "",
      );
      // Get first chunk content preview (first 30 characters)
      const contentPreview = chunkInfo[0]?.content
        ? `"${chunkInfo[0].content.slice(0, 30)}..."`
        : "";
      const fileInfo = [contentPreview, fileType, fileSize, uploadDate]
        .filter(Boolean)
        .join(" · ");
      const summary = docInfo[0]
        ? `Removed file: ${docInfo[0].fileName}${fileInfo ? ` (${fileInfo})` : ""}`
        : "Removed file";

      // Create new timeline event for document removal
      const newTimelineEvent: TimelineData = {
        time: Date.now(),
        summary,
        label: "File",
      };

      // Update insight's timeline
      await db
        .update(insight)
        .set({
          timeline: JSON.stringify([...currentTimeline, newTimelineEvent]),
        })
        .where(eq(insight.id, insightId));

      removed.push(documentId);
      console.log(
        `[removeDocumentAssociations] Document ${documentId} removed successfully`,
      );
    } catch (error) {
      console.error(
        `[removeDocumentAssociations] Failed to remove document ${documentId}:`,
        error,
      );
      failed.push(documentId);
    }
  }

  return { success: failed.length === 0, removed, failed };
}

/**
 * Insight filter kinds
 */
export const INSIGHT_FILTER_KINDS = [
  "importance",
  "urgency",
  "platform",
  "task_label",
  "account",
  "category",
  "participants",
  "people",
  "groups",
  "keyword",
  "time_window",
  "has_tasks",
] as const;

/**
 * Get insight time
 */
function insightTime(insight: Insight) {
  if (insight.details && insight.details.length > 0) {
    const time = insight.details[insight.details.length - 1].time;
    if (time) {
      return coerceDate(time);
    }
  }
  return new Date(insight.time);
}

/**
 * Format insight for response
 */
function formatInsight(item: Insight, withDetail: boolean) {
  const processedDetails = item.details?.map((detail) => ({
    ...detail,
    time: detail.time ? coerceDate(detail.time) : detail.time,
  }));

  const baseInsight = {
    ...item,
    time: formatToLocalTime(insightTime(item)),
    details: processedDetails,
  };

  if (!withDetail && "details" in baseInsight) {
    const { details, ...insightWithoutDetail } = baseInsight;
    return insightWithoutDetail;
  }
  return baseInsight;
}

/**
 * Callback type for insight changes
 */
export type InsightChangeCallback = (data: {
  action: "create" | "update" | "delete";
  insightId?: string;
  insight?: Record<string, unknown>;
}) => void;

/**
 * Create business tools MCP server
 *
 * This server provides business logic tools that interact with the database
 * and external services. It requires a user session to function properly.
 *
 * @param session - User session for authentication and context
 * @param onInsightChange - Optional callback to notify frontend of insight changes
 * @returns MCP server instance
 */
export function createBusinessToolsMcpServer(
  session: Session,
  cloudAuthToken?: string,
  onInsightChange?: InsightChangeCallback,
  chatId?: string,
) {
  // Store cloudAuthToken for embeddings API (needed when cloud calls tools)
  const embeddingsAuthToken = cloudAuthToken;

  return createSdkMcpServer({
    name: "business-tools",
    version: "1.0.0",
    tools: [
      /**
       * time Tool
       *
       * Get the REAL current time, date, year, and day of week.
       * CRITICAL: MUST call this tool BEFORE answering ANY question about time.
       */
      tool(
        "time",
        [
          "**⏰ WHAT IS THIS TOOL?**",
          "Get the REAL current time, date, year, and day of week.",
          "",
          "**🚨 CRITICAL: MUST USE THIS TOOL when:**",
          "",
          "- User asks: '今天是什么时候', '现在是几点', '今天几号', '今天是哪一年'",
          "- User asks: '今天是星期几', '今天是周几', '今天是周一/周二...'",
          "- User asks: '距离XX还有几天', 'XX天后是什么时候'",
          "- Any time-based scheduling, planning, or calculation questions",
          "- Any question about the current year (e.g., 'what year is it?')",
          "",
          "**📋 WHY IS THIS IMPORTANT?**",
          "",
          "- AI models have training data with OLD dates (often 2025)",
          "- This tool returns the ACTUAL current time from the system",
          "- NEVER guess or assume the current year - always call this tool",
          "",
          "**📤 RESPONSE FORMAT:**",
          "",
          "The tool returns:",
          "- currentTime: The time in requested format",
          "- timestamp: Unix timestamp (milliseconds since epoch)",
          "- timezone: The server's timezone",
          "- message: Confirmation message",
          "",
          "**🎤 USAGE EXAMPLES:**",
          "",
          "- '今天是什么时候?' → Call time()",
          "- '今天是星期几?' → Call time(format='human-readable')",
          "- '现在是几点了?' → Call time()",
          "- '今天是2025年还是2026年?' → Call time() to verify",
          "- '距离下周五还有几天?' → Call time() first, then calculate",
        ].join("\n"),
        {
          format: z
            .enum(["iso", "human-readable", "timestamp", "custom"])
            .optional()
            .describe(
              "Format of the time to return: 'iso' (default, ISO 8601 format like '2026-02-21T12:00:00.000Z'), 'human-readable' (local date/time string), 'timestamp' (milliseconds since epoch), or 'custom' (requires customFormat parameter)",
            ),
          customFormat: z
            .string()
            .optional()
            .describe(
              "Custom format description (required if format='custom'). Note: Simple description of desired format, the tool will try to accommodate it.",
            ),
        },
        async ({ format = "iso", customFormat }) => {
          try {
            const now = new Date();
            let timeString: string;

            // Validate custom format if needed
            if (format === "custom" && !customFormat) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          "customFormat is required when format is 'custom'",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Generate time string based on format
            switch (format) {
              case "iso":
                timeString = now.toISOString();
                break;
              case "human-readable":
                timeString = now.toLocaleString("zh-CN", {
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
                break;
              case "timestamp":
                timeString = now.getTime().toString();
                break;
              case "custom":
                timeString = `${now.toLocaleString("zh-CN", {
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                })} (Custom format requested: ${customFormat})`;
                break;
              default:
                timeString = now.toISOString();
            }

            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const dayOfWeek = now.toLocaleDateString("zh-CN", {
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              weekday: "long",
            });
            const hours = now.getHours();
            const minutes = now.getMinutes();

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: true,
                      currentTime: timeString,
                      format,
                      timestamp: now.getTime(),
                      timezone:
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                      year: year,
                      month: month,
                      date: date,
                      dayOfWeek: dayOfWeek,
                      time: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
                      fullDate: `${year}年${month}月${date}日 ${dayOfWeek}`,
                      message: `Current time retrieved in ${format} format. IMPORTANT: The current year is ${year}.`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to get current time: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * chatInsight Tool
       *
       * Query chat insights (事件/洞察) with pagination and custom business filter support.
       */
      tool(
        "chatInsight",
        [
          "**📋 WHAT ARE INSIGHTS? (什么是事件/洞察)**",
          "Insights are structured information extracted from user's chat history across all platforms (Telegram, Email, Slack, iMessage, etc.).",
          "Each insight represents: 一条重要对话、待办事项、项目进展、决策记录等",
          "",
          "**🎯 MUST USE this tool when user asks about:**",
          "",
          "【任务与待办】",
          "- 今天的事情有哪些 / What's on my schedule today",
          "- 我的待办 / My todos / My tasks / My backlog",
          "- 有什么紧急任务 / Any urgent tasks",
          "- 任务完成情况 / Task status",
          "",
          "【项目与进展】",
          "- 项目进展 / Project updates / Status of X",
          "- XX项目怎么样了 / How's project X going",
          "- 最近有什么重要消息 / Any important updates recently",
          "",
          "【聊天记录】",
          "- 聊天记录 / Chat history / Conversations with someone",
          "- 我们讨论过什么 / What did we discuss about X",
          "- 和XX的对话 / Conversation with XX",
          "",
          "【重要事项】",
          "- 重要事项 / Important items / Priorities",
          "- 需要关注的事项 / Items needing attention",
          "",
          "**⚙️ PARAMETERS - HOW TO USE:**",
          "",
          "【days - 时间范围】",
          "- Default: 7 days (最近一周)",
          "- For broader searches: 14, 30, 60, 90 days",
          "- Examples:",
          "  * 今天的事 → days=1",
          "  * 最近两周 → days=14",
          "  * 这个月的进展 → days=30",
          "",
          "【withDetail - 是否包含详细信息】",
          "- Default: false (仅返回标题和摘要)",
          "- Set to true when user asks: 'What did we discuss?', 'Tell me more about X', 'Details of Y'",
          "- Use true for 需要查看聊天内容、讨论细节时",
          "- IMPORTANT: When withDetail=true, each detail has an 'attachments' array with file info",
          "- Each attachment has 'blobPath' (e.g., 'user-id/attachments/xxx.pdf') - use this for downloading files!",
          "",
          "【searchMode - 搜索模式】",
          "- 'basic' (default): 仅搜索标题和摘要 - 更快、结果更精准",
          "- 'comprehensive': 搜索全部字段包括详细内容 - 结果更多但可能有误报",
          "- Recommend: 先用 basic，没找到结果再用 comprehensive",
          "",
          "【keyword - 关键词搜索】⭐ RECOMMENDED",
          "- 支持单个关键词或关键词数组: keyword='PR' 或 keyword=['PR', '开发', 'dev']",
          "- 搜索策略: 使用多个独立关键词而不是长句",
          "- Examples:",
          "  ❌ BAD: keyword='Alloomi PR 功能开发' (太具体，很难匹配)",
          "  ✅ GOOD: keyword=['Alloomi', 'PR', '功能', 'feature', '开发'] (多个关键词)",
          "  ✅ GOOD: keyword=['SmartBI', '项目', 'project']",
          "",
          "**📝 USAGE EXAMPLES:**",
          "",
          "【任务查询】",
          "- '我今天有什么事？' → keyword=未指定, days=1, searchMode='basic'",
          "- '我的紧急任务' → filterDefinition={kind:'urgency', values:['尽快']}, days=7",
          "- '本周待办' → days=7, searchMode='basic'",
          "",
          "【项目进展】",
          "- 'SmartBI项目进展' → keyword=['SmartBI', '进展', 'progress'], days=30, withDetail=true, searchMode='basic'",
          "- 'Alloomi PR情况' → keyword=['Alloomi', 'PR', 'pull request'], days=30, searchMode='basic'",
          "- '最近有什么重要更新' → filterDefinition={kind:'importance', values:['重要']}, days=7",
          "",
          "【聊天记录】",
          "- '我们讨论过什么关于设计' → keyword=['设计', 'design', '讨论'], days=14, withDetail=true, searchMode='comprehensive'",
          "- '和Alice的对话' → keyword=['Alice', '对话', 'conversation'], days=30, withDetail=true",
          "",
          "**💡 SEARCH TIPS:**",
          "1. 使用多个相关关键词而不是完整句子",
          "2. 包含中英文同义词: ['PR', 'pull request', '合并请求']",
          "3. 第一次搜索没结果时，尝试: 增加days范围, 使用comprehensive模式, 尝试其他关键词",
          "4. 优先使用keyword参数，它比filterDefinition更灵活",
          "",
          "--- Technical Details ---",
          `Filter kinds available: ${INSIGHT_FILTER_KINDS.join(", ")}`,
          "PREFER 'keyword' parameter for general searches. Use 'filterDefinition' only for complex filters.",
        ].join("\n"),
        {
          withDetail: z
            .union([z.boolean(), z.string()])
            .transform((val) => {
              // Handle various string values that represent true
              if (typeof val === "string") {
                const lowerVal = val.toLowerCase();
                return [
                  "true",
                  "yes",
                  "1",
                  "important",
                  "重要",
                  "是",
                  "on",
                ].includes(lowerVal);
              }
              return val;
            })
            .default(false)
            .describe(
              "Whether to include the 'detail' field in the insight. Accepts boolean (true/false) or string values like '重要', 'important', 'yes', 'true'. Defaults to false (no details). **SET TO TRUE** when user asks 'What did we discuss?', 'Tell me about X', 'What happened with Y', or needs specific chat content/progress updates.",
            ),
          days: z.coerce
            .number()
            .int()
            .positive()
            .default(7)
            .describe(
              "Number of days of chat insights to retrieve. Default is 7 days. **USE LARGER VALUES** like 14, 30, 60 for broader searches about projects, people, or topics.",
            ),
          searchMode: z
            .enum(["basic", "comprehensive"])
            .default("basic")
            .describe(
              "Search mode: 'basic' searches only title and description (faster, fewer results), 'comprehensive' searches all fields including details and may return many results.",
            ),
          keyword: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe(
              "Keyword(s) to search for. This will be automatically converted to a keyword filter. Use this for simple searches. For complex filters, use filterDefinition instead.",
            ),
          insightIds: z
            .array(z.string())
            .optional()
            .describe(
              "Array of specific insight IDs to retrieve. When provided, returns only the specified insights. Use this when you have insight IDs from the focused insights context or previous queries. This takes priority over all other filter parameters.",
            ),
          page: z.coerce
            .number()
            .int()
            .min(1, "Page number must be at least 1")
            .optional()
            .default(1)
            .describe("Page number (starting from 1), default is 1"),
          pageSize: z.coerce
            .number()
            .int()
            .min(1, "Page size must be at least 1")
            .max(50, "Maximum page size is 50")
            .optional()
            .default(30)
            .describe("Number of insights per page (1-50), default is 30"),
          filterDefinition: z
            .any()
            .optional()
            .describe(
              [
                `Custom insight filter rules (HIGHEST PRIORITY). Only use the following 'kind' values in conditions: ${INSIGHT_FILTER_KINDS.join(", ")}.`,
                "",
                "⭐ PREFER 'keyword' for general searches - it's more flexible and searches across multiple fields.",
                "",
                "CRITICAL: conditions must be an array of OBJECTS with 'kind' field.",
                '❌ WRONG: {"conditions": ["CSale", "collaboration"]}',
                '✅ CORRECT (keyword - RECOMMENDED): {"match":"all","conditions":[{"kind":"keyword","values":["CSale","collaboration","opportunity"]}]}',
                '✅ CORRECT (category - MORE RESTRICTIVE): {"match":"all","conditions":[{"kind":"category","values":["CSale","collaboration","opportunity"]}]}',
                "",
                "More examples:",
                '- Keywords: {"match":"all","conditions":[{"kind":"keyword","values":["Design","设计"],"fields":["title"]}]}',
                '- Platform: {"match":"all","conditions":[{"kind":"platform","values":["slack","discord"]}]}',
                '- Time window: {"match":"all","conditions":[{"kind":"time_window","withinHours":720}]}',
                '- Importance: {"match":"all","conditions":[{"kind":"importance","values":["重要","Important"]}]}',
                '- Combined: {"match":"all","conditions":[{"kind":"keyword","values":["Design"]},{"kind":"platform","values":["slack"]}]}',
                "",
                "Do NOT use 'kind' values not in the list (e.g., 'topic' is invalid, use 'keyword' or 'category' instead).",
              ].join("\n"),
            ),
        },
        async (args) => {
          try {
            const {
              withDetail = false,
              days = 7,
              page = 1,
              pageSize = 30,
              filterDefinition,
              searchMode = "basic",
              keyword,
              insightIds,
            } = args;

            // Auto-convert keyword parameter to filterDefinition
            let effectiveFilterDefinition = filterDefinition;
            if (keyword && !filterDefinition) {
              // Handle different keyword formats
              let keywordValues: string[];
              if (Array.isArray(keyword)) {
                keywordValues = keyword;
              } else if (typeof keyword === "string") {
                // Check if it's a JSON array string
                if (keyword.startsWith("[") && keyword.endsWith("]")) {
                  try {
                    keywordValues = JSON.parse(keyword);
                  } catch {
                    // Not valid JSON, treat as single keyword
                    keywordValues = [keyword];
                  }
                } else {
                  // Single keyword string
                  keywordValues = [keyword];
                }
              } else {
                keywordValues = [String(keyword)];
              }

              effectiveFilterDefinition = {
                match: "any" as const,
                conditions: [
                  {
                    kind: "keyword",
                    values: keywordValues,
                    match: "any" as const,
                  },
                ],
              };
            }

            // Parse filter
            let parsedFilter: InsightFilterDefinition | null = null;
            try {
              if (effectiveFilterDefinition) {
                // Auto-repair common AI mistakes
                let repairedFilter = effectiveFilterDefinition;

                // Check if filterDefinition is a JSON string (common mistake)
                if (typeof repairedFilter === "string") {
                  repairedFilter = JSON.parse(repairedFilter);
                }

                // Check if filterDefinition uses old format {keyword: [...]} instead of {conditions: [...]}
                // Convert to proper format
                if (!repairedFilter.conditions && repairedFilter.keyword) {
                  repairedFilter = {
                    match: "any" as const,
                    conditions: [
                      {
                        kind: "keyword",
                        values: Array.isArray(repairedFilter.keyword)
                          ? repairedFilter.keyword
                          : [repairedFilter.keyword],
                        match: "any" as const,
                      },
                    ],
                  };
                }

                // If conditions is missing or empty, don't apply filter (return all insights)
                if (
                  !repairedFilter.conditions ||
                  repairedFilter.conditions.length === 0
                ) {
                  // parsedFilter stays null, which means no filter applied
                } else if (
                  Array.isArray(repairedFilter.conditions) &&
                  repairedFilter.conditions.length > 0 &&
                  typeof repairedFilter.conditions[0] === "string"
                ) {
                  // Convert strings to keyword filter objects (common mistake)
                  repairedFilter = {
                    ...repairedFilter,
                    conditions: repairedFilter.conditions.map(
                      (condition: any) => ({
                        kind: "keyword",
                        values: Array.isArray(condition)
                          ? condition
                          : [condition],
                        match: "any" as const,
                      }),
                    ),
                  };

                  parsedFilter =
                    insightFilterDefinitionSchema.parse(repairedFilter);
                } else {
                  // Parse normally
                  parsedFilter =
                    insightFilterDefinitionSchema.parse(repairedFilter);
                }
              }
            } catch (error) {
              console.warn("[chatInsight] Invalid insight filter", error);
            }

            // Apply searchMode: modify keyword filters to search only specific fields
            if (parsedFilter && searchMode === "basic") {
              // Modify keyword conditions to only search title and description fields
              parsedFilter = {
                ...parsedFilter,
                conditions: parsedFilter.conditions.map((condition) => {
                  if (condition.kind === "keyword") {
                    const modified = {
                      ...condition,
                      fields: [
                        "title",
                        "description",
                        "groups",
                        "people",
                        "details",
                        "sources",
                        "insight_keywords",
                      ] as (
                        | "title"
                        | "description"
                        | "groups"
                        | "people"
                        | "details"
                        | "sources"
                        | "insight_keywords"
                      )[], // Only search title and description
                    };
                    return modified;
                  }
                  return condition;
                }),
              };
            } else if (parsedFilter && searchMode === "comprehensive") {
              console.log(
                "[chatInsight] Applying 'comprehensive' search mode - searching all fields",
              );
            }
            const bots = await getBotsByUserId({
              id: session.user.id,
              limit: null,
              startingAfter: null,
              endingBefore: null,
              onlyEnable: false,
            });

            if (bots.bots.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No bots found for the user",
                  },
                ],
                data: {
                  insights: [],
                  pagination: {
                    page,
                    pageSize,
                    totalCount: 0,
                    totalPages: 0,
                    hasMore: false,
                    hasPrevious: false,
                  },
                },
              };
            }

            // When insightIds is provided, query directly by ID, skip other filtering logic
            if (insightIds && insightIds.length > 0) {
              console.log("[chatInsight] Querying insights by IDs:", {
                count: insightIds.length,
                ids: insightIds,
              });

              // Query directly by ID
              const insightsByIds = await getInsightsByIdsForUser({
                userId: session.user.id,
                insightIds,
              });

              // Format insights
              const formattedInsights = insightsByIds.map((item) =>
                formatInsight(item.insight, withDetail),
              );

              // Get notes and documents
              let insightsNotesDocumentsMap = new Map();
              if (formattedInsights.length > 0) {
                try {
                  const queryInsightIds = formattedInsights.map((i) => i.id);
                  insightsNotesDocumentsMap =
                    await getInsightsWithNotesAndDocuments({
                      userId: session.user.id,
                      insightIds: queryInsightIds,
                    });
                } catch (error) {
                  console.error(
                    "[chatInsight] Failed to fetch notes and documents for insights:",
                    error,
                  );
                }
              }

              // Fetch related chat IDs for each insight
              const insightsChatsMap = new Map<string, string[]>();
              if (formattedInsights.length > 0) {
                try {
                  const insightIdsList = formattedInsights.map((i) => i.id);
                  // Batch fetch chat IDs for all insights
                  const chatIdsPromises = insightIdsList.map(
                    async (insightId) => {
                      const chatIds = await getInsightChats({ insightId });
                      return { insightId, chatIds };
                    },
                  );
                  const chatIdsResults = await Promise.all(chatIdsPromises);
                  chatIdsResults.forEach(({ insightId, chatIds }) => {
                    insightsChatsMap.set(insightId, chatIds);
                  });
                } catch (error) {
                  console.error(
                    "[chatInsight] Failed to fetch related chat IDs for insights:",
                    error,
                  );
                }
              }

              // Attach notes, documents and related chat IDs to formatted insights
              const insightsWithNotesAndDocuments = formattedInsights.map(
                (insight) => {
                  const data = insightsNotesDocumentsMap.get(insight.id);
                  return {
                    insight,
                    notes: data?.notes || [],
                    documents: data?.documents || [],
                    relatedChatIds: insightsChatsMap.get(insight.id) || [],
                  };
                },
              );

              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      insightsWithNotesAndDocuments,
                      null,
                      2,
                    ),
                  },
                ],
                data: {
                  insights: insightsWithNotesAndDocuments,
                  pagination: {
                    page: 1,
                    pageSize: insightIds.length,
                    totalCount: insightIds.length,
                    totalPages: 1,
                    hasMore: false,
                    hasPrevious: false,
                  },
                },
              };
            }

            const targetBotIds = bots.bots.map((b) => b.id);
            const historyDays = 7;
            const { insights: insightItems } = await getStoredInsightsByBotIds({
              ids: targetBotIds,
              days: Math.min(historyDays, days),
            });

            let notFound = false;
            let filteredInsights = insightItems;
            if (parsedFilter) {
              filteredInsights = filterInsights(insightItems, parsedFilter);
              if (filteredInsights.length === 0) {
                // When filter matches nothing, return empty array instead of all insights
                // This prevents agent from claiming it found results when none matched the filter
                filteredInsights = [];
                notFound = true;
              }
            }

            const formattedInsights = filteredInsights.map((item) =>
              formatInsight(item, withDetail),
            );

            // Fetch notes and documents for insights
            let insightsNotesDocumentsMap = new Map();
            if (formattedInsights.length > 0) {
              try {
                const insightIds = formattedInsights.map((i) => i.id);
                insightsNotesDocumentsMap =
                  await getInsightsWithNotesAndDocuments({
                    userId: session.user.id,
                    insightIds,
                  });
              } catch (error) {
                console.error(
                  "[chatInsight] Failed to fetch notes and documents for insights:",
                  error,
                );
              }
            }

            // Fetch related chat IDs for each insight
            const insightsChatsMap = new Map<string, string[]>();
            if (formattedInsights.length > 0) {
              try {
                const insightIdsList = formattedInsights.map((i) => i.id);
                // Batch fetch chat IDs for all insights
                const chatIdsPromises = insightIdsList.map(
                  async (insightId) => {
                    const chatIds = await getInsightChats({ insightId });
                    return { insightId, chatIds };
                  },
                );
                const chatIdsResults = await Promise.all(chatIdsPromises);
                chatIdsResults.forEach(({ insightId, chatIds }) => {
                  insightsChatsMap.set(insightId, chatIds);
                });
              } catch (error) {
                console.error(
                  "[chatInsight] Failed to fetch related chat IDs for insights:",
                  error,
                );
              }
            }

            // Attach notes, documents and related chat IDs to formatted insights
            const insightsWithNotesAndDocuments = formattedInsights.map(
              (insight) => {
                const data = insightsNotesDocumentsMap.get(insight.id);
                return {
                  ...insight,
                  notes: data?.notes || [],
                  documents: data?.documents || [],
                  relatedChatIds: insightsChatsMap.get(insight.id) || [],
                };
              },
            );

            const totalCount = insightsWithNotesAndDocuments.length;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedInsights = insightsWithNotesAndDocuments.slice(
              startIndex,
              endIndex,
            );
            const totalPages = Math.ceil(totalCount / pageSize);
            const hasMore = page < totalPages;
            const hasPrevious = page > 1;

            // Directly return data as JSON, like Web Agent does
            const responseData = {
              success: paginatedInsights.length > 0,
              message:
                paginatedInsights.length > 0
                  ? `Successfully retrieved ${paginatedInsights.length} insight(s) (page ${page} of ${totalPages})`
                  : notFound
                    ? "No insights match the specified filter criteria. Try using different or broader search terms."
                    : "Alloomi has not yet completed your history message aggregation, please add more integrations and try again later",
              insights: paginatedInsights,
              pagination: {
                page,
                pageSize,
                totalCount,
                totalPages,
                hasMore,
                hasPrevious,
                notFound,
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * downloadInsightAttachment Tool
       *
       * Get download URL for an attachment from an insight.
       * Use this when user wants to download/view an attachment from an insight.
       */
      tool(
        "downloadInsightAttachment",
        [
          "**📎 WHAT THIS TOOL DOES**",
          "Get a download URL for an attachment from an insight.",
          "",
          "**🎯 USE WHEN:**",
          "- User wants to download/view an attachment from an insight",
          "- User asks 'download this file', 'show me the attachment', 'open the file'",
          "",
          "**📝 HOW TO USE:**",
          "1. First, use chatInsight with withDetail=true to get the insight details including attachments",
          "2. Find the attachment info in the insight's details[].attachments array",
          "3. The attachment object should have a 'blobPath' field - use that as the blobPath parameter",
          "4. If blobPath is not available, try using the 'url' field",
          "",
          "**⚠️ IMPORTANT - blobPath vs url:**",
          "- ALWAYS prefer blobPath over url when available",
          "- blobPath looks like: 'user-id/attachments/xxx.pdf'",
          "- url is only a fallback if blobPath is not available",
          "",
          "**📋 PARAMETERS:**",
          "- blobPath: The blob path of the attachment (preferred) - this is the key field!",
          "- url: Alternative to blobPath - the attachment's URL (only use if blobPath not available)",
        ].join("\n"),
        {
          blobPath: z
            .string()
            .optional()
            .describe(
              "The blob path of the attachment (e.g., 'user-id/attachments/xxx.pdf'). This is the PREFERRED field to use!",
            ),
          url: z
            .string()
            .optional()
            .describe(
              "The attachment's URL - only use if blobPath is not available",
            ),
        },
        async ({ blobPath, url }) => {
          try {
            // Parse blobPath
            const normalizedBlobPath =
              blobPath ?? deriveBlobPathFromUrl(url ?? "") ?? null;

            if (!normalizedBlobPath) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          "Unable to resolve attachment blob path. Please provide either blobPath or a valid URL.",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Validate permissions
            if (!normalizedBlobPath.startsWith(`${session.user.id}/`)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          "You do not have permission to access this attachment.",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Otherwise return download URL
            const response = await fetch(
              `${getAppUrl()}/api/files/insights/download`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ blobPath: normalizedBlobPath }),
              },
            );

            const data = await response.json();

            if (!response.ok || !data.downloadUrl) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          data.error || "Failed to generate download URL.",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: true,
                      downloadUrl: data.downloadUrl,
                      message:
                        "Attachment download URL generated successfully. Share this URL with the user.",
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to process attachment: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * queryContacts Tool
       *
       * Query and retrieve user's contacts with pagination support.
       */
      tool(
        "queryContacts",
        "Query and retrieve user's contacts with pagination support. This tool can fetch contacts with optional filtering by name and paginated results. Results include contact details and pagination metadata.",
        {
          filter: z
            .object({
              name: z
                .string()
                .optional()
                .describe(
                  "Optional name to search for specific contacts (partial matches allowed)",
                ),
            })
            .optional()
            .describe(
              "Optional filter criteria to narrow down contact results",
            ),
          page: z.coerce
            .number()
            .int()
            .min(1)
            .optional()
            .default(1)
            .describe("Page number (starting from 1), default is 1"),
          pageSize: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(10)
            .describe("Number of items per page (1-100), default is 10"),
        },
        async (args) => {
          try {
            const { filter, page = 1, pageSize = 10 } = args;

            const contacts = await getUserContacts(session.user.id);

            let resultContacts = contacts.map((c) => ({
              name: c.contactName,
              type: c.type,
            }));

            if (filter?.name) {
              const searchTerm = filter.name.toLowerCase();
              resultContacts = resultContacts.filter((contact) =>
                contact.name?.toLowerCase().includes(searchTerm),
              );
            }

            const totalCount = resultContacts.length;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedContacts = resultContacts.slice(
              startIndex,
              endIndex,
            );
            const totalPages = Math.ceil(totalCount / pageSize);

            const responseData = {
              success: paginatedContacts.length > 0,
              message:
                paginatedContacts.length > 0
                  ? `Successfully retrieved ${paginatedContacts.length} contact(s) (page ${page} of ${totalPages})`
                  : "No contacts found in this page",
              contacts: paginatedContacts,
              pagination: {
                page,
                pageSize,
                totalCount,
                totalPages,
                hasMore: page < totalPages,
                hasPrevious: page > 1,
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
              data: responseData,
            };
          } catch (error) {
            const errorMessage =
              error instanceof AppError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : "Unknown error occurred while querying contacts";
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to query contacts: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * queryIntegrations Tool
       *
       * Query and retrieve user's accounts with their associated integration platform.
       */
      tool(
        "queryIntegrations",
        "Query and retrieve user's accounts with their associated integration platform. This tool can fetch all bots or search for specific bots by name. Results include details and linked account information.",
        {
          platform: z
            .object({
              name: z
                .string()
                .optional()
                .describe(
                  "Optional platform name to search for specific bots (partial matches allowed)",
                ),
            })
            .optional()
            .describe("Optional filter criteria to narrow down bot results"),
          limit: z.coerce
            .number()
            .int()
            .positive()
            .optional()
            .describe("Maximum number of results to return (default: 20)"),
        },
        async (args) => {
          try {
            const { platform, limit } = args;

            const { bots, hasMore } = await getBotsByUserId({
              id: session.user.id,
              limit: limit ?? null,
              startingAfter: null,
              endingBefore: null,
              onlyEnable: true,
            });

            let resultBots = bots.map((bot) => {
              return {
                platform: bot.platformAccount?.platform,
                metadata: bot.platformAccount?.metadata,
                botId: bot.id,
                botName: bot.name,
                adapter: bot.adapter,
              };
            });

            if (platform?.name) {
              const searchTerm = platform.name.toLowerCase();
              resultBots = resultBots.filter((botItem) =>
                botItem.platform?.toLowerCase().includes(searchTerm),
              );
            }

            const responseData = {
              success: true,
              message:
                resultBots.length > 0
                  ? `Successfully retrieved ${resultBots.length} bot(s)${hasMore ? " (more available)" : ""}`
                  : "No bots found",
              bots: resultBots,
              count: resultBots.length,
              hasMore,
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
              data: responseData,
            };
          } catch (error) {
            const errorMessage =
              error instanceof AppError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : "Unknown error occurred while querying bots";
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to query bots: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * sendReply Tool
       *
       * Send a reply to a chat conversation.
       */
      tool(
        "sendReply",
        [
          "Send a reply to a chat conversation. The 'draft' parameter is the message content to send.",
          "When draftOnly is true (default), the tool pauses and asks for user confirmation before sending. The message is shown in a confirmation panel — it is NOT saved to Gmail draft or any email folder.",
          "When draftOnly is false, the tool directly sends the message to the platform.",
          "IMPORTANT: Only set draftOnly to false when the user explicitly confirms they want to send immediately.",
          "",
          "BEFORE SENDING - USE QUERY TOOLS:",
          "- **ALWAYS** use the queryIntegrations tool to check what accounts the user has connected before calling sendReply.",
          "- **ALWAYS** use the queryContacts tool to find valid recipients before calling sendReply.",
          "",
          "BOT SELECTION (CRITICAL):",
          "- If botId is NOT provided: The tool will automatically query the user's connected accounts and select the appropriate bot.",
          "- DO NOT make up, guess, or generate a botId value. If you don't have a specific botId from the user or context, ALWAYS omit this parameter.",
          "",
          "FILE ATTACHMENTS:",
          "- The 'files' parameter accepts an ARRAY of file objects.",
          "- Each file must have: path (absolute file path), optional filename, optional mimeType.",
          '- Example files format: [{"path": "/path/to/file.pdf", "filename": "report.pdf"}]',
          "- All files must exist on the local filesystem.",
          "",
          "**⚠️ CRITICAL - WHEN TO USE sendReply:**",
          "- ✅ USE sendReply: When sending messages to OTHER people (contacts, groups, channels)",
          "- ❌ DO NOT USE sendReply: When sending files back to the CURRENT user in a Telegram/WhatsApp/Feishu bot conversation",
          "",
          "**Telegram/WhatsApp/Feishu Bot Conversations - STOP! DO NOT USE sendReply:**",
          "- If you are running inside a Telegram, WhatsApp or Feishu bot conversation:",
          "- DO NOT attempt to send files back to the user using sendReply - this will fail due to account restrictions",
          "- Instead: Inform the user that the file has been generated and provide the local file path",
          "- The user can access the file through their file system or device",
          "- Only use sendReply to send messages to OTHER contacts (not the current conversation user)",
          '- Example: Say "文件已生成：/path/to/file.pdf" instead of trying to use sendReply',
        ].join("\n"),
        {
          draft: z
            .string()
            .describe("The content of the reply message to be sent."),
          recipients: z
            .array(z.string())
            .optional()
            .describe(
              "List of recipient names or IDs (optional if using current conversation).",
            ),
          botId: z
            .string()
            .optional()
            .describe(
              "The bot ID to use for sending (optional, will auto-query if not provided). IMPORTANT: Only provide a specific botId if you have it from context. Never make up or guess this value.",
            ),
          draftOnly: z
            .boolean()
            .default(true)
            .describe(
              "If true, only generate a draft without sending. If false, actually send the message. Default is true.",
            ),
          subject: z
            .string()
            .optional()
            .describe(
              "Email subject line (for email platforms only). If not provided, the first line of the message will be used as the subject.",
            ),
          cc: z
            .array(z.string())
            .optional()
            .describe("CC recipients (for email platforms)."),
          bcc: z
            .array(z.string())
            .optional()
            .describe("BCC recipients (for email platforms)."),
          files: z
            .array(
              z.object({
                path: z
                  .string()
                  .describe("Absolute file path to the attachment."),
                filename: z
                  .string()
                  .optional()
                  .describe(
                    "Custom filename (optional, defaults to basename of path).",
                  ),
                mimeType: z
                  .string()
                  .optional()
                  .describe(
                    "MIME type of the file (optional, auto-detected if not provided).",
                  ),
              }),
            )
            .optional()
            .describe(
              "List of file attachments to send with the message. Each attachment must have an absolute path. Supports common file types like documents, images, videos, etc.",
            ),
        },
        async (args) => {
          try {
            const {
              draft,
              recipients,
              botId,
              draftOnly,
              subject,
              cc,
              bcc,
              files,
            } = args;

            // Check for files parameter with telegram/whatsapp/feishu/dingtalk bots
            // In bot conversations, files should not be sent back via sendReply
            if (files && files.length > 0 && !draftOnly) {
              const sessionWithPlatform = session as typeof session & {
                platform?: string;
              };
              // If session includes current conversation platform, prefer using that platform's bot for "prohibit file sending" check
              let targetBotId = botId;
              if (!botId) {
                const botsResult = await getBotsByUserId({
                  id: session.user.id,
                  limit: null,
                  startingAfter: null,
                  endingBefore: null,
                  onlyEnable: true,
                });
                const chatBots = botsResult.bots.filter(
                  (b) =>
                    b.adapter === "telegram" ||
                    b.adapter === "whatsapp" ||
                    b.adapter === "feishu" ||
                    b.adapter === "dingtalk",
                );
                if (sessionWithPlatform.platform && chatBots.length > 0) {
                  const currentBot = chatBots.find(
                    (b) => b.adapter === sessionWithPlatform.platform,
                  );
                  if (currentBot) targetBotId = currentBot.id;
                  else targetBotId = chatBots[0].id;
                } else if (chatBots.length > 0) {
                  targetBotId = chatBots[0].id;
                }
              }

              // Check if target bot is telegram/whatsapp/feishu/dingtalk (none support sending files via sendReply)
              if (targetBotId) {
                const botsResult = await getBotsByUserId({
                  id: session.user.id,
                  limit: null,
                  startingAfter: null,
                  endingBefore: null,
                  onlyEnable: true,
                });
                const targetBot = botsResult.bots.find(
                  (b) => b.id === targetBotId,
                );

                if (
                  targetBot &&
                  (targetBot.adapter === "telegram" ||
                    targetBot.adapter === "whatsapp" ||
                    targetBot.adapter === "feishu" ||
                    targetBot.adapter === "dingtalk")
                ) {
                  return {
                    content: [
                      {
                        type: "text" as const,
                        text: `⚠️ Cannot send files via sendReply in ${targetBot.adapter} bot conversations.\n\nThe files have been generated locally. Please inform the user of the file location instead of trying to send them back through sendReply.\n\nFiles:\n${files.map((f) => `- ${f.path}`).join("\n")}\n\nCorrect approach: Say something like "✅ 文件已生成：${files[0].path}" instead of using sendReply.`,
                      },
                    ],
                    isError: true,
                  };
                }
              }
            }

            // Draft mode
            if (draftOnly) {
              const botsResult = await getBotsByUserId({
                id: session.user.id,
                limit: null,
                startingAfter: null,
                endingBefore: null,
                onlyEnable: true,
              });

              const availableBots = botsResult.bots.filter(
                (b) => b.adapter !== "manual",
              );

              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Message prepared. Awaiting your confirmation to send.",
                  },
                ],
                data: {
                  success: true,
                  draftOnly: true,
                  draft,
                  recipients: recipients ?? [],
                  availableAccounts: availableBots.map((b) => ({
                    botId: b.id,
                    platform: b.adapter,
                    accountName:
                      b.platformAccount?.displayName ||
                      b.platformAccount?.externalId ||
                      "Unknown",
                    botName: b.name || "Unnamed",
                  })),
                },
              };
            }

            // Get available bots
            const botsResult = await getBotsByUserId({
              id: session.user.id,
              limit: null,
              startingAfter: null,
              endingBefore: null,
              onlyEnable: true,
            });

            const availableBots = botsResult.bots.filter(
              (b) => b.adapter !== "manual",
            );

            if (availableBots.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No active account found. To send messages, you need to connect and enable at least one account.",
                  },
                ],
                isError: true,
              };
            }

            // Validate botId
            const uuidRegex =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            let targetBotId = botId;

            if (botId) {
              if (!uuidRegex.test(botId)) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: "The provided botId is not valid.",
                    },
                  ],
                  isError: true,
                };
              }

              const botExists = availableBots.some((b) => b.id === botId);
              if (!botExists) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: "The selected account is not available. Please select from your available accounts.",
                    },
                  ],
                  isError: true,
                };
              }

              targetBotId = botId;
            } else if (availableBots.length === 1) {
              targetBotId = availableBots[0].id;
            } else {
              // If session includes current conversation platform, prefer using that platform's bot, avoid going to other channel logic
              const sessionWithPlatform = session as typeof session & {
                platform?: string;
              };
              if (sessionWithPlatform.platform) {
                const currentPlatformBot = availableBots.find(
                  (b) => b.adapter === sessionWithPlatform.platform,
                );
                if (currentPlatformBot) {
                  targetBotId = currentPlatformBot.id;
                }
              }
              if (!targetBotId) {
                const botList = availableBots
                  .map((bot, index) => {
                    const platform = bot.adapter;
                    const accountName =
                      bot.platformAccount?.displayName ||
                      bot.platformAccount?.externalId ||
                      `Account ${index + 1}`;
                    const botName = bot.name || "Unnamed Bot";

                    return `${index + 1}. **${platform}** - ${accountName} (Bot: ${botName})\n   Bot ID: \`${bot.id}\``;
                  })
                  .join("\n\n");

                return {
                  content: [
                    {
                      type: "text" as const,
                      text: `You have multiple connected accounts. Please choose which one to use for sending this message:\n\n${botList}`,
                    },
                  ],
                  isError: true,
                };
              }
            }

            // Check recipients
            if (!recipients || recipients.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Cannot send message: recipients are required when draftOnly is false.",
                  },
                ],
                isError: true,
              };
            }

            // Process files if provided
            let processedAttachments = undefined;
            if (files && files.length > 0) {
              const { statSync, existsSync } = await import("node:fs");
              const { basename } = await import("node:path");
              const { extname } = await import("node:path");

              processedAttachments = [];

              for (const file of files) {
                const { path: filePath, filename, mimeType } = file;

                // Validate file exists
                if (!existsSync(filePath)) {
                  return {
                    content: [
                      {
                        type: "text" as const,
                        text: `Attachment not found: ${filePath}`,
                      },
                    ],
                    isError: true,
                  };
                }

                // Get file stats
                const stats = statSync(filePath);
                const finalFilename = filename || basename(filePath);
                const ext = extname(finalFilename).toLowerCase();

                // Determine MIME type
                let finalMimeType = mimeType;
                if (!finalMimeType) {
                  const mimeTypes: Record<string, string> = {
                    ".pdf": "application/pdf",
                    ".doc": "application/msword",
                    ".docx":
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ".ppt": "application/vnd.ms-powerpoint",
                    ".pptx":
                      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    ".xls": "application/vnd.ms-excel",
                    ".xlsx":
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                    ".gif": "image/gif",
                    ".mp4": "video/mp4",
                    ".mp3": "audio/mpeg",
                    ".zip": "application/zip",
                    ".txt": "text/plain",
                    ".md": "text/markdown",
                    ".json": "application/json",
                    ".csv": "text/csv",
                  };
                  finalMimeType = mimeTypes[ext] || "application/octet-stream";
                }

                // Create attachment object with file path (not file:// URL)
                processedAttachments.push({
                  name: finalFilename,
                  url: `file://${filePath}`, // Fallback URL
                  contentType: finalMimeType,
                  sizeBytes: stats.size,
                  source: "local",
                  blobPath: filePath, // Use blobPath to store actual file path
                });
              }
            }

            // Send message
            const params: SendMessageParams = {
              botId: targetBotId,
              recipients,
              message: draft,
              subject,
              cc,
              bcc,
              attachments: processedAttachments,
              withAppSuffix: true,
            };

            const result = await sendMessage(params, session.user.id);

            if (result.success) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: result.message ?? "Message sent successfully!",
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: "text" as const,
                  text: result.error ?? "Failed to send message",
                },
              ],
              isError: true,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error sending message: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * createInsight Tool
       *
       * Create a new insight from the user's description.
       */
      tool(
        "createInsight",
        [
          "Create a new insight from the user's description.",
          "",
          "⚠️ CRITICAL: YOU MUST INCLUDE COMPLETE CHAT CONTEXT ⚠️",
          "- When creating an insight, you MUST extract ALL relevant messages from the current conversation",
          "- Include the user's original request, your responses, and ALL follow-up discussion",
          "- Use the 'details' field to preserve the COMPLETE conversation history",
          "- DO NOT create insights without details - more context is better than too little",
          "",
          "⭐ TRACKING RESPONSIBILITY ⭐",
          "- When there is a focused/active insight in the conversation, YOU are responsible for tracking operations",
          "- In the SAME chat, whenever related operations occur (e.g., GitHub issue created, file created, task completed),",
          "  you MUST call modifyInsight to append these details to the insight",
          "- When myTasks exist in the insight, you must auto-update task status when operations complete",
          "",
          "Use this when the user says things like:",
          '- "Tomorrow I need to..."',
          '- "Remind me to..."',
          '- "I want to track this..."',
          '- "Create an insight for..."',
          "",
          "⚠️ DO NOT use createInsight to update an existing tracking!",
          "If the user wants to update/add progress to an existing insight (e.g., 'update the progress', 'add an update'),",
          "you MUST use modifyInsight instead with the existing insightId and append to the timeline field.",
          "createInsight is ONLY for creating brand NEW insights.",
          "",
          "⭐ CRITICAL: DESCRIPTION vs DETAILS ⭐",
          "Keep them SEPARATE and PURPOSEFUL:",
          "",
          "1. DESCRIPTION (summary):",
          "   - Keep it SHORT: 1-2 sentences, 20-60 words",
          "   - Focus on WHAT and WHY, not the background",
          "   - Use natural, conversational language",
          "   - Example: 'Need to create scenario-based demos to improve sales credibility with SMB customers'",
          "",
          "2. DETAILS (rich context):",
          "   - Put ALL the rich context here: user input, conversation history, memory search results",
          "   - Each detail can have: content (main text), person (who said it), context (additional info)",
          "   - Use this to preserve the full conversation flow and reasoning",
          "   - Example detail: {content: 'User mentioned: \"We need to show how the product works in real scenarios\"'}",
          "",
          "3. WHEN TO USE DETAILS: ⚠️ ALWAYS REQUIRED ⚠️",
          "   - MUST include ALL relevant chat context and conversation history",
          "   - ALWAYS add details when user provides context, questions, or thought process",
          "   - Capture the COMPLETE conversation that led to this insight",
          "   - Include ALL relevant information from memory/knowledge base searches",
          "   - NEVER omit details - more context is always better than too little",
          "   - Format: [{content: '...', context: '...', person: '...', time: ...}]",
          "   - CRITICAL: Extract ALL messages from current conversation that are related to this insight",
          "   - Include user's original input, your responses, and any follow-up discussion",
          "",
          "4. EXAMPLE WITH COMPLETE CHAT CONTEXT:",
          "   User: '我明天需要给客户做个演示'",
          "   Assistant: '好的，演示是关于什么的？需要准备什么？'",
          "   User: '关于Alloomi的功能演示，需要展示场景化的功能'",
          "   Assistant: '明白了，我帮你创建一个待办事项记录'",
          "   ",
          "   CORRECT createInsight call:",
          "   - title: '准备客户功能演示'",
          "   - description: '需要准备Alloomi场景化功能演示给客户'",
          "   - details: [",
          "     {content: '我明天需要给客户做个演示', person: 'User'},",
          "     {content: '好的，演示是关于什么的？需要准备什么？', person: 'Assistant'},",
          "     {content: '关于Alloomi的功能演示，需要展示场景化的功能', person: 'User'},",
          "     {content: '明白了，我帮你创建一个待办事项记录', person: 'Assistant'}",
          "   ]",
          "",
          "   WRONG (missing context):",
          "   - details: [] OR details not provided",
          "",
          "Required fields:",
          "- title: A concise title for the insight",
          "- description: SHORT summary (1-2 sentences, 20-60 words), NOT a detailed explanation",
          "",
          "Optional fields (extract from user input):",
          "- importance: Choose ONE value - '重要' or 'Important' or '一般' or 'General' or '不重要' or 'Not Important'",
          "- urgency: Choose ONE value - '尽快' or 'As soon as possible' or '24小时内' or 'Within 24 hours' or '不紧急' or 'Not urgent'",
          "- myTasks: Array of TASK OBJECTS (not strings!) - each task must have 'text' field, 'completed' defaults to false",
          "- timeline: Array of timeline events with time, summary, and label (⚠️ REQUIRED - Must include at least one timeline event to track the progression of this insight!)",
          "- details: Array of detailed messages with content, person, platform, channel (⚠️ REQUIRED - Must include ALL relevant chat messages from current conversation with AI!)",
          "- groups: Array of group/category tags for organizing insights (include all tags at once)",
          "- people: Array of people names mentioned in the insight (include all people at once)",
          "- attachments: Array of document IDs to attach to this insight. Documents must be uploaded first via file upload (document IDs are from rag_documents table)",
          "- ⚠️ CRITICAL: When attaching multiple documents, include ALL document IDs in the array at once. Example: {attachments: ['doc-id-1', 'doc-id-2', 'doc-id-3']}",
          "- time: Unix timestamp in milliseconds as a NUMBER (e.g., 1705287600123)",
          "- platform: Platform this insight is related to (e.g., 'manual', 'chat')",
        ].join("\n"),
        {
          title: z.string().describe("Concise title for the insight"),
          description: z
            .string()
            .describe(
              "SHORT summary (1-2 sentences, 20-60 words), not detailed explanation",
            ),
          importance: z
            .string()
            .optional()
            .describe(
              "Importance level: '重要'/'Important' (重要), '一般'/'General' (一般), '不重要'/'Not Important' (不重要)",
            ),
          urgency: z
            .string()
            .optional()
            .describe(
              "Urgency level: '尽快'/'As soon as possible' (尽快), '24小时内'/'Within 24 hours' (24小时内), '不紧急'/'Not urgent' (不紧急), '一般'/'General' (一般)",
            ),
          myTasks: z
            .array(
              z.union([
                z.object({
                  text: z.string().describe("Task description"),
                  completed: z
                    .boolean()
                    .default(false)
                    .describe("Whether the task is completed (default: false)"),
                  deadline: z
                    .string()
                    .optional()
                    .describe("Task deadline (e.g., '2025-01-15', 'tomorrow')"),
                  owner: z
                    .string()
                    .optional()
                    .describe("Person responsible for this task"),
                }),
                z.string(),
              ]),
            )
            .optional()
            .describe(
              "Array of tasks. Can be objects [{text: 'task', completed: false}] or strings ['task1', 'task2'] or JSON strings.",
            ),
          timeline: z
            .array(
              z.object({
                time: z
                  .number()
                  .optional()
                  .describe(
                    "Numeric Unix timestamp in milliseconds (e.g., 1705287600123), NOT an object like {format: 'timestamp'}",
                  ),
                summary: z
                  .string()
                  .optional()
                  .describe("Brief summary of the timeline event"),
                label: z
                  .string()
                  .optional()
                  .describe("Event type or category label"),
                emoji: z
                  .string()
                  .optional()
                  .describe("Emoji icon for the event"),
                id: z
                  .string()
                  .optional()
                  .describe(
                    "Unique identifier for this timeline event (for tracking history)",
                  ),
                version: z
                  .number()
                  .optional()
                  .describe(
                    "Current version number of this event (starts at 1, increments on updates)",
                  ),
                lastUpdatedAt: z
                  .number()
                  .optional()
                  .describe("Timestamp when this event was last updated"),
                changeCount: z
                  .number()
                  .optional()
                  .describe(
                    "Total number of times this event has been changed",
                  ),
                urgency: z
                  .string()
                  .optional()
                  .describe(
                    "Urgency level: immediate/24h/not_urgent (for matching AI prompt output)",
                  ),
                tags: z
                  .array(z.string())
                  .optional()
                  .describe("Keywords/tags for categorizing the event"),
                action: z
                  .string()
                  .optional()
                  .describe(
                    "Recommended action for the user based on this timeline event (e.g., 'Review the competitor update', 'Schedule a follow-up')",
                  ),
              }),
            )
            .optional()
            .describe(
              "Array of timeline events showing progression or key moments",
            ),
          details: z
            .array(
              z.object({
                time: z
                  .number()
                  .optional()
                  .nullable()
                  .describe(
                    "Numeric Unix timestamp in milliseconds (e.g., 1705287600123), NOT an object like {format: 'timestamp'}",
                  ),
                person: z.string().optional().describe("Sender's user name"),
                platform: z
                  .string()
                  .optional()
                  .nullable()
                  .describe(
                    'Name of the platform (e.g., "telegram", "slack", etc...)',
                  ),
                channel: z.string().optional().describe("Channel identifier"),
                content: z
                  .string()
                  .optional()
                  .describe("Content of the message"),
              }),
            )
            .optional()
            .describe(
              "⚠️ REQUIRED: Array of detailed messages from current conversation with AI. Include ALL relevant chat messages - user input, AI responses, and follow-up discussion. Format: [{content: 'message text', person: 'User'/'Assistant', time: timestamp}]. NEVER omit this field - context is critical!",
            ),
          groups: z
            .array(z.string())
            .optional()
            .describe(
              "Group or category tags for organizing insights (e.g., ['work'] or ['project-x']). Do NOT create multiple groups here.",
            ),
          categories: z
            .array(z.string())
            .optional()
            .describe(
              "Categories for the insight (e.g., ['sales', 'feedback', 'bug']). Use this to categorize insights for filtering and organization.",
            ),
          people: z
            .array(z.string())
            .optional()
            .describe(
              "Names of people mentioned in the insight (e.g., ['Alice', 'Bob'])",
            ),
          time: z
            .union([z.string(), z.number()])
            .optional()
            .describe(
              "Unix timestamp in milliseconds as a NUMBER (e.g., 1705287600123), NOT an object like {format: 'timestamp'}",
            ),
          platform: z
            .string()
            .optional()
            .describe(
              "Platform this insight is related to (e.g., 'manual', 'chat')",
            ),
          attachments: z
            .array(z.string())
            .optional()
            .describe(
              "Array of document IDs to attach to this insight. Documents must be uploaded first via file upload (document IDs are from rag_documents table). Example: ['doc-id-1', 'doc-id-2']. ⚠️ CRITICAL: Include ALL document IDs in the array at once, not one at a time.",
            ),
        },
        async (args) => {
          try {
            const {
              title,
              description,
              importance,
              urgency,
              myTasks,
              timeline,
              details,
              groups,
              categories,
              people,
              time,
              platform,
              attachments,
            } = args;

            const normalizedImportance = normalizeImportance(importance);
            const normalizedUrgency = normalizeUrgency(urgency);
            const normalizedTasks = myTasks?.map(normalizeTask);

            // 🔧 Handle timestamp
            let normalizedTime: Date | null = null;
            if (time) {
              if (typeof time === "string") {
                normalizedTime = new Date(time);
              } else if (typeof time === "number") {
                normalizedTime = new Date(time);
              }
            }

            // Get user's bots to find or create a manual bot
            const bots = await getBotsByUserId({
              id: session.user.id,
              limit: null,
              startingAfter: null,
              endingBefore: null,
              onlyEnable: false,
            });

            const manualBot = bots.bots.find((bot) => bot.adapter === "manual");

            let botId: string;
            if (manualBot) {
              botId = manualBot.id;
            } else {
              botId = await createBotRecord({
                name: "My Bot",
                userId: session.user.id,
                description: "Default bot for manual insights",
                adapter: "manual",
                adapterConfig: {},
                enable: true,
              });
            }

            // Create the insight payload
            const payload: GeneratedInsightPayload = {
              dedupeKey: null,
              taskLabel:
                normalizedTasks && normalizedTasks.length > 0
                  ? "task"
                  : "insight",
              title,
              description,
              importance: normalizedImportance,
              urgency: normalizedUrgency,
              platform: platform || "manual",
              account: null,
              groups: groups || [],
              categories: categories || [],
              people: people || [],
              time: normalizedTime || new Date(),
              details: details
                ? details.map((d) => ({
                    ...d,
                    time: d.time ?? Date.now(),
                  }))
                : null,
              timeline: timeline
                ? timeline.map((t) => ({ ...t, time: Date.now() }))
                : null,
              insights: null,
              trendDirection: null,
              trendConfidence: null,
              sentiment: null,
              sentimentConfidence: null,
              intent: null,
              trend: null,
              issueStatus: null,
              communityTrend: null,
              duplicateFlag: null,
              impactLevel: null,
              resolutionHint: null,
              topKeywords: [],
              topEntities: [],
              topVoices: null,
              sources: null,
              sourceConcentration: null,
              buyerSignals: [],
              stakeholders: null,
              contractStatus: null,
              signalType: null,
              confidence: null,
              scope: null,
              nextActions: null,
              followUps: null,
              actionRequired:
                (normalizedTasks && normalizedTasks.length > 0) || false,
              actionRequiredDetails: null,
              myTasks: normalizedTasks
                ? normalizedTasks.map((task) => ({
                    title: task.text,
                    status: task.completed ? "completed" : "pending",
                    deadline: task.deadline || null,
                    owner: task.owner || null,
                  }))
                : null,
              waitingForMe: null,
              waitingForOthers: null,
              clarifyNeeded: false,
              learning: null,
              experimentIdeas: null,
              executiveSummary: null,
              riskFlags: null,
              strategic: null,
              client: null,
              projectName: null,
              nextMilestone: null,
              dueDate: null,
              paymentInfo: null,
              entity: null,
              why: null,
              historySummary: null,
              roleAttribution: null,
              alerts: null,
            };

            // Insert the insight
            // Note: payload already contains time field, and insertInsightRecords
            // will handle JSON field serialization for SQLite compatibility
            const insertPayload = {
              ...payload,
              botId,
            } as any;

            const result = await insertInsightRecords([insertPayload]);

            if (!result || result.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Failed to create insight.",
                  },
                ],
                isError: true,
              };
            }

            const createdInsightId = result[0];

            // Associate insight with current chat if chatId is provided
            if (chatId) {
              try {
                await saveChatInsights({
                  chatId,
                  insightIds: [createdInsightId],
                });
                console.log(
                  `[createInsight] Associated insight ${createdInsightId} with chat ${chatId}`,
                );
              } catch (error) {
                console.error(
                  "[createInsight] Failed to associate insight with chat:",
                  error,
                );
                // Don't fail the insight creation if chat association fails
              }
            }

            // Associate documents if attachments are provided
            if (attachments && attachments.length > 0) {
              try {
                const result = await associateDocumentsToInsight(
                  createdInsightId,
                  attachments,
                  session.user.id,
                );
                if (result.associated.length > 0) {
                  console.log(
                    `[createInsight] Associated ${result.associated.length} documents with insight ${createdInsightId}`,
                  );
                }
                if (result.failed.length > 0) {
                  console.warn(
                    `[createInsight] Failed to associate ${result.failed.length} documents with insight ${createdInsightId}`,
                  );
                }
              } catch (error) {
                console.error(
                  "[createInsight] Failed to associate documents:",
                  error,
                );
                // Don't fail the insight creation if document association fails
              }
            }

            // Notify frontend of insight change for optimistic update
            if (onInsightChange) {
              onInsightChange({
                action: "create",
                insightId: createdInsightId,
                insight: {
                  id: createdInsightId,
                  ...insertPayload,
                },
              });
            }

            const responseData = {
              success: true,
              message: `Successfully created insight "${title}"`,
              insightId: createdInsightId,
              title,
              description,
              importance: normalizedImportance,
              urgency: normalizedUrgency,
              myTasks: normalizedTasks || null,
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to create insight: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * modifyInsight Tool
       *
       * Modify an existing insight/事件 (update task status, add notes, change properties).
       */
      tool(
        "modifyInsight",
        [
          "**📝 WHAT THIS TOOL DOES**",
          "Update an existing insight's properties. Can modify tasks, descriptions, importance, urgency, etc.",
          "",
          "**⭐ TRACKING OPERATIONS (关键追踪功能)**",
          "",
          "【自动追踪后续操作】",
          "- When there is a focused/active insight, you MUST track all subsequent related operations in the same chat",
          "- Whenever the user performs or discusses operations related to the insight, append details",
          "- Examples: user asks to create GitHub issue, user confirms task completion, file is created, etc.",
          "",
          "【自动完成待办】",
          "- When myTasks exist in the insight, you MUST auto-update task status when operations complete",
          "- Common success patterns that should trigger auto-completion:",
          "  * GitHub issue/PR created successfully",
          "  * File created/modified successfully",
          "  * Task confirmed as completed by user",
          "  * API call returned success",
          "- When detecting success, update myTasks: set completed=true for the related task",
          "",
          "**🎯 COMMON USE CASES:**",
          "",
          "【1. 标记任务完成】",
          "- '任务完成了' / 'Mark task as done' → Set completed=true",
          "- '待办事项已完成' → Update task status in myTasks",
          "- Detection: After executing a tool successfully, check if it matches any myTask and auto-complete",
          "",
          "【2. 更新任务信息】",
          "- '设置截止日期' / 'Set deadline' → Add deadline to task",
          "- '分配任务给XX' / 'Assign to XX' → Set owner field",
          "- '修改任务描述' / 'Update task description' → Change task text",
          "",
          "【3. 更新事件属性】",
          "- '改为紧急' / 'Mark as urgent' → Set urgency='尽快'",
          "- '降低重要性' / 'Lower importance' → Set importance='一般'",
          "- '更新描述' / 'Update description' → Modify description field",
          "- '添加详细信息' / 'Add details' → Add detailed conversation content, error details, etc.",
          "",
          "【4. 为 Tracking 添加更新记录】⭐ 重要",
          "- 用户说 '更新一下' / 'update this tracking' / '加一条更新' / 'add an update' → 使用 timeline 字段追加新事件",
          "- ⚠️ 不要调用 createInsight！必须用 modifyInsight 追加 timeline",
          "- 示例: 用户说 '这个项目有更新了' → append to timeline: [{time: ..., summary: '...', label: '更新', emoji: '🔄'}]",
          "",
          "**⚙️ TASK OWNER ASSIGNMENT (任务分配)**",
          "",
          "【如何指定负责人】",
          "1. 用户自己做 → 使用用户自己的名字",
          "2. 分配给其他人 → 使用 queryContacts 工具查找联系人列表，使用其名字",
          "3. 不确定谁负责 → 询问用户: '应该由谁负责这个任务？'",
          "",
          "【示例】",
          "- '{text: \"完成设计稿\", completed: true}' → 标记任务完成",
          '- \'{text: "联系客户", owner: "张三"}\' → 分配给张三',
          '- \'{text: "提交报告", deadline: "2025-02-10"}\' → 设置截止日期',
          "",
          "**📋 FIELD DESCRIPTIONS (字段说明)**",
          "",
          "【description - 摘要描述】",
          "- 简洁的1-2句话摘要 (20-60字)",
          "- 说明是什么、为什么重要",
          "- 保持自然、口语化的表达",
          "- Example: '需要创建场景演示，提升SMB客户的销售可信度'",
          "",
          "【details - 详细信息】⭐⭐⭐",
          "- 完整的对话内容、错误详情、解决方案分析、后续操作记录等",
          "- 数组格式，每个元素包含:",
          "  * content: 主要内容",
          "  * person: 说话人 (可选)",
          "  * platform: 平台名称 (可选)",
          "  * time: 时间戳 (可选)",
          "- Example: [{content: '用户提到需要场景演示', person: 'Alice'}]",
          "",
          "**⚠️ CRITICAL: ALWAYS APPEND (必须追加)**",
          "- 每次更新时会**追加**新内容到现有数组，不是替换",
          "- 你应该在每次有相关操作或结果时都调用 modifyInsight 追加 details",
          "- 不要等到用户要求才更新，要主动追踪",
          "- 追踪内容包括: 操作结果、成功消息、错误信息、用户确认等",
          "",
          "⚠️ CRITICAL: details 必须是对象数组，不能是字符串!",
          '  ❌ WRONG: details: "这是对话内容"',
          '  ✅ RIGHT: details: [{content: "这是对话内容", person: "User"}]',
          "",
          "【timeline - 时间线】⭐⭐⭐",
          "- 事件进展跟踪，记录关键事件和状态变化",
          "- ⚠️ REQUIRED - 必须添加至少一个时间线事件来追踪事件的进展!",
          "- 数组格式，每个元素包含:",
          "  * time: 时间戳 (可选)",
          "  * summary: 事件摘要描述",
          "  * label: 事件类型/分类 (可选)",
          "  * emoji: emoji 图标 (可选)",
          "- Example: [{time: 1234567890, summary: '创建任务', label: '进行中', emoji: '🚀'}]",
          "- 注意: 每次更新时会**追加**新内容到现有数组，不是替换",
          "",
          "【insights - 洞察要点】",
          "- 从内容中提取的关键洞察、要点总结",
          "- 对象数组，每个元素包含:",
          "  * category: 洞察分类",
          "  * value: 洞察内容",
          "  * confidence: 置信度 (0-100)",
          "  * evidence: 支持证据 (可选)",
          "  * byRole: 角色归属 (可选)",
          "- Example: [{category: '用户反馈', value: '需要优化性能', confidence: 90}]",
          "- 注意: 每次更新时会**追加**新内容到现有数组，不是替换",
          "",
          "【myTasks - 我的任务】⭐⭐⭐",
          "- 需要用户处理的任务列表",
          "- 每个任务包含: text (描述), completed (是否完成), deadline (截止日期), owner (负责人)",
          "- 更新时提供完整的任务数组",
          "",
          "**⚠️ AUTO-COMPLETE TASKS (自动完成任务)**",
          "- 当 insight 包含 myTasks 时，你必须监控操作结果并自动更新任务状态",
          "- 当检测到以下成功模式时，自动设置 completed=true:",
          "  * GitHub Issue 创建成功 → 标记相关 Issue 创建任务为完成",
          "  * PR/MR 创建成功 → 标记相关 PR 创建任务为完成",
          "  * 文件创建/修改成功 → 标记相关文件创建任务为完成",
          "  * 邮件发送成功 → 标记相关邮件发送任务为完成",
          "  * 用户确认任务完成 → 标记任务为完成",
          "- 更新示例: {insightId: 'xxx', updates: {myTasks: [{text: '在GitHub提交Bug Issue', completed: true}]}}",
          "",
          "【waitingForMe - 等待我】",
          "- 需要用户响应或确认的任务",
          "- 格式同 myTasks",
          "",
          "【waitingForOthers - 等待他人】",
          "- 已经分配给他人，等待对方完成",
          "- 格式同 myTasks",
          "",
          "**⚠️ CRITICAL RULES (重要规则)**",
          "",
          "【1. IMPORTANCE/URGENCY - 使用单个值】",
          "  ❌ WRONG: '重要/Important' (不要用 / 组合)",
          "  ✅ RIGHT: '重要' 或 'Important'",
          "",
          "  Valid values:",
          "  - importance: '重要' / '一般' / '不重要' (or 'Important' / 'General' / 'Not Important')",
          "  - urgency: '尽快' / '24小时内' / '不紧急' / '一般' (or 'As soon as possible' / 'Within 24 hours' / 'Not urgent' / 'General')",
          "",
          "【2. TASK ARRAYS - 必须是对象数组】",
          '  ❌ WRONG: myTasks=["task1", "task2"]',
          '  ❌ WRONG: myTasks=[{\\"text\\":\\"task\\"}"]',
          '  ✅ RIGHT: myTasks=[{text: "Follow up", completed: false, deadline: "2025-01-15", owner: "Alice"}]',
          "",
          "【3. TASK OBJECT FORMAT (任务对象格式)】",
          "  {",
          '    "text": "任务描述 (必填)",',
          '    "completed": true/false,',
          '    "deadline": "2025-01-15 或 tomorrow/next week (可选)",',
          '    "owner": "负责人名字 (可选)"',
          "  }",
          "",
          "【4. AUTO-TRACKING - 必须主动追踪】⭐⭐⭐",
          "  - 当有 focused insight 时，你必须追踪同一 chat 中所有相关的后续操作",
          "  - 每次工具执行成功后，调用 modifyInsight 追加 details 记录结果",
          "  - 当 myTasks 存在时，根据工具执行结果自动更新 completed 状态",
          "  - 不要等用户要求才更新，要主动追踪",
          "",
          "**💡 USAGE EXAMPLES:**",
          "",
          "- '标记任务为完成' → {insightId: 'xxx', updates: {myTasks: [{text: '联系客户', completed: true}]}}",
          "- '更新描述' → {insightId: 'xxx', updates: {description: '新的描述内容'}}",
          "- '改为紧急' → {insightId: 'xxx', updates: {urgency: '尽快'}}",
          "- '添加新任务' → {insightId: 'xxx', updates: {myTasks: [{text: '新任务', completed: false}]}}",
          "- '添加详细信息' → {insightId: 'xxx', updates: {details: [{content: '用户反馈: 需要添加导出功能', person: 'Alice'}]}}",
          "- '添加附件' → {insightId: 'xxx', updates: {addAttachments: ['doc-id-1', 'doc-id-2']}}",
          "- '移除附件' → {insightId: 'xxx', updates: {removeAttachments: ['doc-id-1']}}",
          "",
          "**📌 CRITICAL: 修改标题/描述时的注意事项**",
          "- 如果你需要修改事件标题，必须在 updates 中提供新 title",
          "- 如果你需要修改事件描述，必须在 updates 中提供新 description",
          "- 不要只更新 details/timeline 而不修改 title/description",
          "- 本工具返回值中会包含当前 insight 的 title 和 description，供你参考",
          "",
          "**🔄 PARTIAL UPDATE (增量更新规则)**",
          "",
          "【只更新提供的字段 - 重要】",
          "- updates 中只包含需要修改的字段",
          "- 未提供的字段会保持原有值不变",
          "- 这是增量更新（partial update），不是全量替换",
          "",
          "【details/timeline/insights - 数组增量更新】⭐",
          "- details、timeline、insights 字段是**追加**模式，不是替换",
          "- 每次调用时会将新内容追加到现有数组末尾",
          "- 例如: 原来有 2 条 details，新增 1 条后会有 3 条",
          "- 示例: {insightId: 'xxx', updates: {details: [{content: '新对话内容'}]}}",
          "",
          "【如何修改标题/摘要】",
          "- '修改事件标题' → {insightId: 'xxx', updates: {title: '新标题'}}",
          "- '修改事件描述' → {insightId: 'xxx', updates: {description: '新的描述内容'}}",
          "- '同时修改标题和描述' → {insightId: 'xxx', updates: {title: '新标题', description: '新描述'}}",
          "",
          "【注意事项】⭐",
          "- 如果用户想要修改 title 或 description，必须在 updates 中明确提供",
          "- 不要只添加 details/timeline 而不修改 title/description，否则用户在事件详情页看不到变化",
          "",
          "【典型错误示例】❌",
          "- 用户说: '更新进展，Alloomi 今天出了 10 个 bug'",
          "- 错误: 只更新 details 和 timeline，不更新 title/description",
          "- 结果: 事件详情页的标题和描述仍是旧内容，用户感知不到更新",
          "",
          "【正确示例】✅ - 增量更新",
          "- 用户说: '更新进展，Alloomi 今天出了 10 个 bug'",
          "- 原则: 在原有 title/description 基础上**增量追加**新内容",
          "- 示例: 原有 title='日常同步小组进展更新'",
          "- 正确: {insightId: 'xxx', updates: {",
          "  details: [{content: 'Alloomi 今天出了 10 个 bug'}],",
          "  title: '日常同步小组进展更新 | Alloomi 出 10 个 bug',",
          "  description: '每日同步小组成员进展。最新: Alloomi 今天出了 10 个 bug'",
          "}}",
          "- 或者更简洁: {insightId: 'xxx', updates: {",
          "  details: [{content: 'Alloomi 今天出了 10 个 bug'}],",
          "  title: '日常同步小组进展更新 (10 bug)',",
          "}}",
          "",
          "【attachments - 文件附件】",
          "- 使用 addAttachments 添加文件（提供文档ID数组）",
          "- 使用 removeAttachments 移除文件（提供文档ID数组）",
          "- 文档必须先通过文件上传功能上传到系统",
          "- 示例: {addAttachments: ['doc-123', 'doc-456']}",
          "- ⚠️ CRITICAL: When adding attachments, include ALL document IDs in the array at once, not just the new ones",
          "",
          "⚠️ IMPORTANT: 如果用户在对话中引用了某个事件（上下文），直接使用该事件的ID，无需询问。",
        ].join("\n"),
        {
          insightId: z
            .string()
            .optional()
            .describe(
              "The ID of the insight to modify. If not provided, will use the focused insight ID from context.",
            ),
          updates: z
            .object({
              description: z
                .string()
                .optional()
                .describe("New description for the insight"),
              details: z
                .array(
                  z.object({
                    content: z.string().optional().describe("Main content"),
                    person: z.string().optional().describe("Speaker name"),
                    platform: z.string().optional().describe("Platform name"),
                    channel: z
                      .string()
                      .optional()
                      .describe("Channel identifier"),
                    time: z.number().optional().describe("Timestamp"),
                  }),
                )
                .optional()
                .describe(
                  "Detailed information array (conversation content, error details, etc.)",
                ),
              timeline: z
                .array(
                  z.object({
                    time: z.number().optional().describe("Timestamp"),
                    summary: z
                      .string()
                      .optional()
                      .describe("Brief summary of the event"),
                    label: z
                      .string()
                      .optional()
                      .describe("Event type/category"),
                    emoji: z.string().optional().describe("Emoji icon"),
                    id: z
                      .string()
                      .optional()
                      .describe(
                        "Unique identifier for this timeline event (for tracking history)",
                      ),
                    version: z
                      .number()
                      .optional()
                      .describe(
                        "Current version number of this event (starts at 1, increments on updates)",
                      ),
                    lastUpdatedAt: z
                      .number()
                      .optional()
                      .describe("Timestamp when this event was last updated"),
                    changeCount: z
                      .number()
                      .optional()
                      .describe(
                        "Total number of times this event has been changed",
                      ),
                    urgency: z
                      .string()
                      .optional()
                      .describe(
                        "Urgency level: immediate/24h/not_urgent (for matching AI prompt output)",
                      ),
                    tags: z
                      .array(z.string())
                      .optional()
                      .describe("Keywords/tags for categorizing the event"),
                    action: z
                      .string()
                      .optional()
                      .describe(
                        "Recommended action for the user based on this timeline event (e.g., 'Review the competitor update', 'Schedule a follow-up')",
                      ),
                  }),
                )
                .optional()
                .describe("Timeline array for tracking events and progress"),
              insights: z
                .array(
                  z.object({
                    category: z.string().describe("Insight category"),
                    value: z.string().describe("Insight value/content"),
                    confidence: z.number().describe("Confidence level"),
                    evidence: z
                      .array(z.string())
                      .optional()
                      .describe(
                        "Supporting evidence. Include ALL evidence items in the array at once.",
                      ),
                    byRole: z.string().optional().describe("Role attribution"),
                  }),
                )
                .optional()
                .describe("Key insights extracted from the content"),
              importance: z
                .string()
                .optional()
                .describe(
                  "Importance level: 重要/Important, 一般/General, 不重要/Not Important",
                ),
              urgency: z
                .string()
                .optional()
                .describe(
                  "Urgency level: 尽快/As soon as possible, 24小时内/Within 24 hours, 不紧急/Not urgent, 一般/General",
                ),
              myTasks: z
                .array(
                  z.union([
                    z.object({
                      text: z.string().describe("Task description"),
                      completed: z
                        .boolean()
                        .default(false)
                        .describe(
                          "Whether the task is completed (default: false)",
                        ),
                      deadline: z
                        .string()
                        .optional()
                        .describe(
                          "Task deadline (e.g., '2025-01-15', 'tomorrow')",
                        ),
                      owner: z
                        .string()
                        .optional()
                        .describe("Person responsible for this task"),
                    }),
                    z.string(),
                  ]),
                )
                .optional()
                .describe("My tasks array with completion status"),
              waitingForMe: z
                .array(
                  z.union([
                    z.object({
                      text: z.string().describe("Task description"),
                      completed: z.boolean().default(false),
                      deadline: z.string().optional(),
                      owner: z.string().optional(),
                    }),
                    z.string(),
                  ]),
                )
                .optional()
                .describe("Waiting for me tasks array with completion status"),
              waitingForOthers: z
                .array(
                  z.union([
                    z.object({
                      text: z.string().describe("Task description"),
                      completed: z.boolean().default(false),
                      deadline: z.string().optional(),
                      owner: z.string().optional(),
                    }),
                    z.string(),
                  ]),
                )
                .optional()
                .describe(
                  "Waiting for others tasks array with completion status",
                ),
              actionRequired: z
                .boolean()
                .optional()
                .describe("Whether action is required"),
              title: z
                .string()
                .optional()
                .describe("New title for the insight"),
              addAttachments: z
                .array(z.string())
                .optional()
                .describe(
                  "Array of document IDs to add to this insight. Documents must be uploaded first via file upload (document IDs are from rag_documents table). ⚠️ CRITICAL: Include ALL document IDs in the array at once, not one at a time.",
                ),
              removeAttachments: z
                .array(z.string())
                .optional()
                .describe("Array of document IDs to remove from this insight."),
              categories: z
                .array(z.string())
                .optional()
                .describe(
                  "Categories for the insight (e.g., ['Marketing', 'Meetings', 'News', 'R&D']). This will replace existing categories.",
                ),
              groups: z
                .array(z.string())
                .optional()
                .describe(
                  "Groups for the insight (e.g., ['Marketing', 'Sales']). This will replace existing groups.",
                ),
            })
            .describe("Fields to update in the insight"),
        },
        async (args) => {
          try {
            const { insightId, updates } = args;

            // Determine which insight to modify
            const targetInsightId = insightId;

            if (!targetInsightId) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No insight ID provided. Please specify which insight to modify.",
                  },
                ],
                isError: true,
              };
            }

            // Get the insight and verify access
            const insightResult = await getInsightByIdForUser({
              userId: session.user.id,
              insightId: targetInsightId,
            });

            if (!insightResult) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Insight ${targetInsightId} not found or access denied.`,
                  },
                ],
                isError: true,
              };
            }

            const { insight, bot } = insightResult;

            // Use the original bot ID for updating
            const targetBotId = bot.id;

            // Build the payload with only the fields that are being updated
            const payload: Partial<GeneratedInsightPayload> = {};

            if (updates.description !== undefined) {
              payload.description = updates.description;
            }

            if (updates.details !== undefined) {
              // details is already an array of objects, assign it and fill missing timestamps
              payload.details = updates.details.map((d) => ({
                ...d,
                time: d.time ?? Date.now(),
              })) as any;
            }

            if (updates.timeline !== undefined) {
              // timeline is already an array of objects, just assign it
              payload.timeline = updates.timeline as any;
            }

            if (updates.insights !== undefined) {
              // insights is an array of strings
              payload.insights = updates.insights as any;
            }

            if (updates.importance !== undefined) {
              payload.importance = normalizeImportance(updates.importance);
            }

            if (updates.urgency !== undefined) {
              payload.urgency = normalizeUrgency(updates.urgency);
            }

            if (updates.myTasks !== undefined) {
              const normalizedTasks = updates.myTasks
                .map(normalizeTask)
                .filter((task) => task.text.length > 0);
              payload.myTasks = normalizedTasks.map((task) => ({
                title: task.text,
                status: task.completed ? "completed" : "pending",
                deadline: task.deadline || null,
                owner: task.owner || null,
              }));
            }

            if (updates.waitingForMe !== undefined) {
              const normalizedTasks = updates.waitingForMe
                .map(normalizeTask)
                .filter((task) => task.text.length > 0);
              payload.waitingForMe = normalizedTasks.map((task) => ({
                title: task.text,
                status: task.completed ? "completed" : "pending",
                deadline: task.deadline || null,
                owner: task.owner || null,
              }));
            }

            if (updates.waitingForOthers !== undefined) {
              const normalizedTasks = updates.waitingForOthers
                .map(normalizeTask)
                .filter((task) => task.text.length > 0);
              payload.waitingForOthers = normalizedTasks.map((task) => ({
                title: task.text,
                status: task.completed ? "completed" : "pending",
                deadline: task.deadline || null,
                owner: task.owner || null,
              }));
            }

            if (updates.actionRequired !== undefined) {
              payload.actionRequired = updates.actionRequired;
            }

            if (updates.title !== undefined) {
              payload.title = updates.title;
            }

            if (updates.groups !== undefined) {
              payload.groups = updates.groups;
            }

            if (updates.categories !== undefined) {
              payload.categories = updates.categories;
            }

            // Track attachment updates separately (not part of GeneratedInsightPayload)
            const attachmentUpdates: {
              add?: string[];
              remove?: string[];
            } = {};

            if (
              updates.addAttachments !== undefined &&
              updates.addAttachments.length > 0
            ) {
              attachmentUpdates.add = updates.addAttachments;
            }

            if (
              updates.removeAttachments !== undefined &&
              updates.removeAttachments.length > 0
            ) {
              attachmentUpdates.remove = updates.removeAttachments;
            }

            // If no updates (excluding attachments), return early
            if (
              Object.keys(payload).length === 0 &&
              !attachmentUpdates.add &&
              !attachmentUpdates.remove
            ) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No valid updates provided. Please specify at least one field to update.",
                  },
                ],
                isError: true,
              };
            }

            // Create a complete payload with existing values
            const fullPayload: GeneratedInsightPayload = {
              dedupeKey: insight.dedupeKey ?? null,
              taskLabel: insight.taskLabel,
              title: updates.title || insight.title,
              description: updates.description || insight.description,
              importance: updates.importance || insight.importance,
              urgency: updates.urgency || insight.urgency,
              platform: insight.platform ?? null,
              account: insight.account ?? null,
              groups: insight.groups ?? [],
              people: insight.people ?? [],
              time: insight.time,
              // Incremental update: append new items to existing array
              details: updates.details
                ? [
                    ...(insight.details || []),
                    ...updates.details.map((d) => ({
                      ...d,
                      time: d.time ?? Date.now(),
                    })),
                  ]
                : insight.details,
              timeline: updates.timeline
                ? [
                    ...(insight.timeline || []),
                    ...updates.timeline.map((t) => ({
                      ...t,
                      time: Date.now(),
                    })),
                  ]
                : insight.timeline,
              insights: updates.insights
                ? [...(insight.insights || []), ...updates.insights]
                : insight.insights,
              trendDirection: insight.trendDirection ?? null,
              trendConfidence: insight.trendConfidence
                ? Number.parseFloat(insight.trendConfidence.toString())
                : null,
              sentiment: insight.sentiment ?? null,
              sentimentConfidence: insight.sentimentConfidence
                ? Number.parseFloat(insight.sentimentConfidence.toString())
                : null,
              intent: insight.intent ?? null,
              trend: insight.trend ?? null,
              issueStatus: insight.issueStatus ?? null,
              communityTrend: insight.communityTrend ?? null,
              duplicateFlag: insight.duplicateFlag ?? null,
              impactLevel: insight.impactLevel ?? null,
              resolutionHint: insight.resolutionHint ?? null,
              topKeywords: insight.topKeywords ?? [],
              topEntities: insight.topEntities ?? [],
              topVoices: insight.topVoices,
              sources: insight.sources,
              sourceConcentration: insight.sourceConcentration ?? null,
              buyerSignals: insight.buyerSignals ?? [],
              stakeholders: insight.stakeholders,
              contractStatus: insight.contractStatus ?? null,
              signalType: insight.signalType ?? null,
              confidence: insight.confidence
                ? Number.parseFloat(insight.confidence.toString())
                : null,
              scope: insight.scope ?? null,
              nextActions: insight.nextActions,
              followUps: insight.followUps,
              actionRequired:
                updates.actionRequired ?? insight.actionRequired ?? null,
              actionRequiredDetails: insight.actionRequiredDetails,
              myTasks: updates.myTasks
                ? updates.myTasks
                    .map(normalizeTask)
                    .filter((task) => task.text.length > 0)
                    .map((task) => ({
                      title: task.text,
                      status: task.completed ? "completed" : "pending",
                      deadline: task.deadline || null,
                      owner: task.owner || null,
                    }))
                : insight.myTasks,
              waitingForMe: updates.waitingForMe
                ? updates.waitingForMe
                    .map(normalizeTask)
                    .filter((task) => task.text.length > 0)
                    .map((task) => ({
                      title: task.text,
                      status: task.completed ? "completed" : "pending",
                      deadline: task.deadline || null,
                      owner: task.owner || null,
                    }))
                : insight.waitingForMe,
              waitingForOthers: updates.waitingForOthers
                ? updates.waitingForOthers
                    .map(normalizeTask)
                    .filter((task) => task.text.length > 0)
                    .map((task) => ({
                      title: task.text,
                      status: task.completed ? "completed" : "pending",
                      deadline: task.deadline || null,
                      owner: task.owner || null,
                    }))
                : insight.waitingForOthers,
              clarifyNeeded: insight.clarifyNeeded ?? null,
              categories: insight.categories ?? [],
              learning: insight.learning ?? null,
              experimentIdeas: insight.experimentIdeas,
              executiveSummary: insight.executiveSummary ?? null,
              riskFlags: insight.riskFlags,
              strategic: insight.strategic,
              client: insight.client ?? null,
              projectName: insight.projectName ?? null,
              nextMilestone: insight.nextMilestone ?? null,
              dueDate: insight.dueDate ?? null,
              paymentInfo: insight.paymentInfo ?? null,
              entity: insight.entity ?? null,
              why: insight.why ?? null,
              historySummary: insight.historySummary,
              roleAttribution: insight.roleAttribution,
              alerts: insight.alerts,
            };

            // Update the insight
            const updatedInsight = await updateInsightById({
              insightId: targetInsightId,
              botId: targetBotId,
              payload: fullPayload,
            });

            // Handle attachment updates
            const attachmentResults: {
              added?: string[];
              removed?: string[];
              failed?: { added: string[]; removed: string[] };
            } = {};

            if (attachmentUpdates.add || attachmentUpdates.remove) {
              if (attachmentUpdates.add && attachmentUpdates.add.length > 0) {
                const addResult = await associateDocumentsToInsight(
                  targetInsightId,
                  attachmentUpdates.add,
                  session.user.id,
                );
                attachmentResults.added = addResult.associated;
                if (addResult.failed.length > 0) {
                  attachmentResults.failed = {
                    added: addResult.failed,
                    removed: [],
                  };
                }
              }

              if (
                attachmentUpdates.remove &&
                attachmentUpdates.remove.length > 0
              ) {
                const removeResult = await removeDocumentAssociations(
                  targetInsightId,
                  attachmentUpdates.remove,
                  session.user.id,
                );
                attachmentResults.removed = removeResult.removed;
                if (removeResult.failed.length > 0) {
                  if (!attachmentResults.failed) {
                    attachmentResults.failed = {
                      added: [],
                      removed: removeResult.failed,
                    };
                  } else {
                    attachmentResults.failed.removed = removeResult.failed;
                  }
                }
              }
            }

            // Notify frontend of insight change for optimistic update
            if (onInsightChange) {
              onInsightChange({
                action: "update",
                insightId: updatedInsight.id,
              });
            }

            const changes = Object.keys(updates).join(", ");

            const responseData = {
              success: true,
              message: `Successfully updated insight "${updatedInsight.title}". Changed: ${changes}`,
              insightId: updatedInsight.id,
              title: updatedInsight.title,
              description: updatedInsight.description,
              updatedFields: Object.keys(updates),
              ...(attachmentResults.added || attachmentResults.removed
                ? {
                    attachments: {
                      added: attachmentResults.added || [],
                      removed: attachmentResults.removed || [],
                      ...(attachmentResults.failed
                        ? { failed: attachmentResults.failed }
                        : {}),
                    },
                  }
                : {}),
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to modify insight: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * deleteInsight Tool
       *
       * Delete an insight/事件 from the database.
       */
      tool(
        "deleteInsight",
        [
          "**🗑️ DELETE INSIGHT - 删除事件**",
          "",
          "This tool permanently deletes an insight from the database.",
          "",
          "**⚠️ IMPORTANT - IMPORTANT RULES:**",
          "- This action CANNOT be undone - deleted insights cannot be recovered",
          "- You MUST get explicit confirmation from the user before deleting",
          "- Confirm by stating the insight title and asking for confirmation",
          "",
          "**📋 WHEN TO USE:**",
          "- User explicitly asks to delete an insight/event",
          "- User wants to remove a test/temporary insight",
          "- User confirms deletion after being asked",
          "",
          "**💡 USAGE EXAMPLES:**",
          "- '删除这个测试事件' → First confirm: 'Are you sure you want to delete the insight \"测试事件\"? (This cannot be undone)'",
          "- '删除 ID 为 xxx 的事件' → Confirm the insight details first",
          "- 'Remove this temporary event' → Confirm before deleting",
          "",
          "⚠️ IMPORTANT: 如果用户在对话中引用了某个事件（上下文），直接使用该事件的ID，无需询问。",
        ].join("\n"),
        {
          insightId: z
            .string()
            .optional()
            .describe(
              "The ID of the insight to delete. If not provided, will use the focused insight ID from context.",
            ),
        },
        async (args) => {
          try {
            const { insightId } = args;

            // Determine which insight to delete
            const targetInsightId = insightId || null;

            if (!targetInsightId) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No insight ID provided. Please specify which insight to delete, or make sure an insight is focused. 没有提供事件ID。请指定要删除的事件。",
                  },
                ],
                isError: true,
              };
            }

            console.log(
              "[Tool calling] Deleting insight:",
              JSON.stringify({
                insightId: targetInsightId,
              }),
            );

            // Get the insight and verify access
            const insightResult = await getInsightByIdForUser({
              userId: session.user.id,
              insightId: targetInsightId,
            });

            if (!insightResult) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Insight ${targetInsightId} not found or access denied. 事件未找到或无权访问。`,
                  },
                ],
                isError: true,
              };
            }

            const { insight } = insightResult;

            // Delete the insight
            await deleteInsightsByIds({ ids: [targetInsightId] });

            console.log("[Tool calling] Insight deleted successfully");

            // Notify frontend of insight change for optimistic update
            if (onInsightChange) {
              onInsightChange({
                action: "delete",
                insightId: targetInsightId,
              });
            }

            const responseData = {
              success: true,
              message: `Successfully deleted insight "${insight.title}". 已成功删除事件 "${insight.title}"`,
              insightId: targetInsightId,
              title: insight.title,
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: `✅ ${responseData.message}`,
                },
              ],
              data: responseData,
            };
          } catch (error) {
            console.error("[Tool calling] Failed to delete insight:", error);

            // Check if it's a AppError
            if (error instanceof AppError) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `[${error.type}:${error.surface}] ${error.message}`,
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to delete insight. 删除事件失败: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * searchKnowledgeBase Tool
       *
       * RAG (Retrieval-Augmented Generation) tool for searching the user's knowledge base.
       */
      tool(
        "searchKnowledgeBase",
        [
          "Search the user's strategy memory (知识库/策略记忆) for relevant information.",
          "This includes uploaded documents AND the user's focus settings (关注的人员、关注的话题等).",
          "",
          "**MUST USE / 必须使用** when:",
          "1) User asks about their documents, files, or uploaded content",
          "2) User asks questions related to their focus people, topics, or strategy",
          "",
          "**⭐ SEARCH STRATEGY - IMPORTANT:**",
          "- When searching, use MULTIPLE SEPARATE keywords instead of a single long phrase",
          "- Try different keyword combinations if first search doesn't find results",
          "- Include both English and Chinese terms if applicable",
          "- Examples:",
          "  ❌ BAD: query='Alloomi PR 功能新特性' (too specific, won't match)",
          "  ✅ GOOD: Try query='PR', then query='Alloomi', then query='功能', then query='新特性' (multiple searches)",
          "",
          "Examples / 示例:",
          "- 'What's in this document?' / '这个文档里讲了什么?'",
          "- 'What do I care about?' / '我关注什么?'",
          "- 'What are my priorities?' / '我的优先事项是什么?'",
          "- 'What do you know about X?' / '你知道关于X的什么?' → Try query='X', then query='related topic'",
          "- 'Find information about Y' / '找关于Y的信息' → Try query='Y', then query='broader term'",
          "- 'Alloomi PR功能进展' → Try query='PR', then query='Alloomi', then query='功能' (multiple searches)",
          "",
          "Use this tool BEFORE answering questions about user's content or preferences.",
        ].join("\n"),
        {
          query: z
            .string()
            .describe(
              "The search query to find relevant information in the user's strategy memory",
            ),
          limit: z.coerce
            .number()
            .min(1)
            .max(20)
            .default(5)
            .describe(
              "Maximum number of relevant chunks to retrieve (default: 5, max: 20)",
            ),
          documentIds: z
            .array(z.string())
            .optional()
            .describe(
              "Optional: specific document IDs to search within. If not provided, searches all documents.",
            ),
        },
        async (args) => {
          try {
            const { query, limit = 5, documentIds } = args;

            // Validate user session
            if (!session?.user?.id) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Unauthorized: invalid user session",
                  },
                ],
                isError: true,
              };
            }

            const userId = session.user.id;

            // Search for similar chunks in the user's knowledge base
            const results = await searchSimilarChunks(
              userId,
              query,
              {
                limit,
                threshold: 0.5, // Lower threshold for better recall (50% similarity)
                documentIds, // Pass document IDs to filter the search
              },
              embeddingsAuthToken,
            ); // Pass auth token for embeddings API

            if (results.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text:
                      documentIds && documentIds.length > 0
                        ? "No relevant information found in the specified documents. 在指定的文档中未找到相关信息。"
                        : "No relevant information found in your strategy memory. Try uploading documents or rephrase your question. 在您的策略记忆中未找到相关信息。请尝试上传文档或重新表述您的问题。",
                  },
                ],
                data: {
                  results: [],
                  count: 0,
                },
              };
            }

            // Format results for LLM
            const formattedContent = formatSearchResultsForLLM(results);

            return {
              content: [
                {
                  type: "text" as const,
                  text: formattedContent,
                },
              ],
              data: {
                results: results.map((r) => ({
                  documentName: r.documentName,
                  content: r.content,
                  similarity: r.similarity,
                  chunkIndex: r.chunkIndex,
                })),
                count: results.length,
              },
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No results found in knowledge base.",
                },
              ],
              data: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
              isError: true,
            };
          }
        },
      ),

      /**
       * getFullDocumentContent Tool
       *
       * Get the complete full text content of a document.
       */
      tool(
        "getFullDocumentContent",
        [
          "Get the COMPLETE full text content of a document. 获取文档的完整文本内容。",
          "",
          "Use this when the user asks to:",
          "- Summarize a document",
          "- Explain 'what's in this document'",
          "- Analyze the entire document content",
          "",
          "This provides ALL chunks concatenated together, not just relevant excerpts.",
          "Best for small documents or summarization tasks.",
        ].join("\n"),
        {
          documentId: z
            .string()
            .describe("The ID of the document to retrieve full content for"),
        },
        async (args) => {
          try {
            const { documentId } = args;

            // Validate user session
            if (!session?.user?.id) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Unauthorized: invalid user session",
                  },
                ],
                isError: true,
              };
            }

            const userId = session.user.id;

            // First verify the document belongs to this user
            const document = await getDocument(documentId);

            if (!document) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Document not found. 文档未找到。",
                  },
                ],
                isError: true,
              };
            }

            if (document.userId !== userId) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Unauthorized: you don't have access to this document. 未授权:您无权访问此文档。",
                  },
                ],
                isError: true,
              };
            }

            // Get full content
            const result = await getDocumentFullContent(documentId);

            return {
              content: [
                {
                  type: "text" as const,
                  text: result.content,
                },
              ],
              data: {
                documentId: result.documentId,
                documentName: document.fileName,
                totalChunks: result.totalChunks,
                contentLength: result.content.length,
                message: `Successfully retrieved full content of "${document.fileName}" (${result.totalChunks} chunks, ${result.content.length} characters). 成功获取"${document.fileName}"的完整内容(${result.totalChunks}个chunk, ${result.content.length}个字符)。`,
              },
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Failed to retrieve document content. 获取文档内容失败。",
                },
              ],
              data: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
              isError: true,
            };
          }
        },
      ),

      /**
       * getRawMessages Tool
       *
       * Search and retrieve ORIGINAL MESSAGE CONTENT stored in browser's IndexedDB.
       * This is the Native Agent equivalent of the Web Agent's getRawMessages tool.
       */
      tool(
        "getRawMessages",
        [
          "Search and retrieve ORIGINAL MESSAGE CONTENT stored in browser's IndexedDB.",
          "",
          "**⭐ SEARCH STRATEGY - IMPORTANT:**",
          "- When searching, use MULTIPLE SEPARATE keywords instead of a single long phrase",
          "- Try different keyword combinations if first search doesn't find results",
          "- Include both English and Chinese terms if applicable",
          "- Examples:",
          "  ❌ BAD: keywords=['Alloomi PR 功能'] (too specific, won't match)",
          "  ✅ GOOD: Try keywords=['PR'], then keywords=['Alloomi'], then keywords=['功能'] (multiple searches)",
          "",
          "**CRITICAL: Use this tool whenever the user asks to search, find, or query their STORED MESSAGES, CHAT HISTORY, or CONVERSATIONS.**",
          "",
          "This tool searches through messages that were previously collected and stored in the browser's IndexedDB.",
          "Users often refer to these as: 'my messages', 'chat history', 'conversations', 'stored information', etc.",
          "",
          "**PAGINATION:** To handle large result sets efficiently:",
          "- Start with offset=0, pageSize=50 (recommended default)",
          "- If 'hasMore=true' in the response, call again with offset=previousOffset + previousPageSize",
          "- Continue until 'hasMore=false' or you have collected sufficient results",
          "",
          "**Available search parameters:**",
          "- keywords: Search terms - will search across ALL fields (message content, channel name, sender name). This is the MOST COMMON parameter.",
          "- days: Number of days to look back (e.g., 1, 7, 30). Default is 30 days.",
          "- platform: Filter by platform (ONLY if user explicitly mentions a specific platform)",
          "- person: Filter by sender name",
          "- channel: Filter by channel/chat name",
          "- groupBy: Group results by 'day' (Today/Yesterday), 'week', or 'month'",
          "- offset: Number of messages to skip for pagination (default: 0)",
          "- pageSize: Number of messages per page (default: 50, max: 100)",
          "",
          "**Examples of when to use this tool:**",
          "- 'Search my messages for SmartBI' → keywords=['SmartBI']",
          "- 'Search last 7 days for meetings' → keywords=['meeting'], days=7",
          "- 'Find conversations about meetings' → keywords=['meeting'], groupBy='day'",
          "- 'What did John say about X?' → person='John Doe', keywords=['X']",
          "- 'Show my Slack messages from today' → platform='slack', days=1, groupBy='day'",
        ].join("\n"),
        {
          botId: z
            .string()
            .optional()
            .describe(
              "DEPRECATED: Do NOT use this parameter - it will restrict results to a single bot. Always search across all bots for better results.",
            ),
          platform: z
            .string()
            .optional()
            .describe(
              "Platform name (slack, discord, telegram, gmail, outlook, teams, linkedin, instagram, twitter, whatsapp)",
            ),
          channel: z.string().optional().describe("Channel or chat name"),
          person: z.string().optional().describe("Sender or person name"),
          days: z.coerce
            .number()
            .int()
            .min(1)
            .max(365)
            .default(30)
            .describe(
              "Number of days to look back from now (1-365, default: 30)",
            ),
          startTime: z.coerce
            .number()
            .optional()
            .describe(
              "Start timestamp (Unix timestamp in seconds) - only use if user provides specific timestamp",
            ),
          endTime: z.coerce
            .number()
            .optional()
            .describe(
              "End timestamp (Unix timestamp in seconds) - only use if user provides specific timestamp",
            ),
          keywords: z
            .array(z.string())
            .optional()
            .describe(
              "Keywords to search for - will search across content, channel, and person fields",
            ),
          groupBy: z
            .enum(["none", "day", "week", "month"])
            .optional()
            .describe(
              "Group messages by time period: 'day', 'week', 'month', or 'none' for flat list",
            ),
          offset: z.coerce
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Number of messages to skip for pagination (default: 0)"),
          pageSize: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .default(50)
            .describe("Number of messages per page (default: 50, max: 100)"),
        },
        async (args) => {
          try {
            // Validate user session
            if (!session?.user?.id) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Unauthorized: invalid user session",
                  },
                ],
                isError: true,
              };
            }

            const userId = session.user.id;

            // Add userId to params
            const params = { ...args, userId };

            // Convert days to startTime if provided
            let processedParams = { ...params };
            if (args.days && !args.startTime) {
              const secondsPerDay = 24 * 60 * 60;
              const startTime =
                Math.floor(Date.now() / 1000) - args.days * secondsPerDay;
              processedParams = {
                ...params,
                startTime,
              };
            }

            // Return structured response with pagination info
            // The actual query will be executed on the client side by the frontend
            const response = {
              method: "indexeddb_query",
              params: {
                ...processedParams,
                offset: args.offset ?? 0,
                pageSize: args.pageSize ?? 50,
              },
              pagination: {
                offset: args.offset ?? 0,
                pageSize: args.pageSize ?? 50,
                hasMore: true, // Will be updated by client-side handler
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(response),
                },
              ],
              data: response,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to search messages: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * searchRawMessages Tool
       *
       * Search and retrieve ORIGINAL MESSAGE CONTENT stored in browser's IndexedDB.
       * This tool searches across message content, sender names, and channel names.
       */
      tool(
        "searchRawMessages",
        [
          "**⭐ SEARCH STRATEGY - IMPORTANT:**",
          "- When searching, use MULTIPLE SEPARATE keywords instead of a single long phrase",
          "- Try different keyword combinations if first search doesn't find results",
          "- Include both English and Chinese terms if applicable",
          "- Examples:",
          "  ❌ BAD: keywords=['Alloomi PR 功能'] (too specific, won't match)",
          "  ✅ GOOD: Try keywords=['PR'], then keywords=['Alloomi'], then keywords=['功能'] (multiple searches)",
          "",
          "Search the user's raw messages data stored in browser's IndexedDB.",
          "This includes original message content from all platforms (Telegram, Slack, Discord, etc.).",
          "",
          "**CRITICAL: This tool provides ADDITIONAL search results to complement chatInsight results.**",
          "- If this tool finds no results, do NOT conclude that 'no information exists'",
          "- Always combine results from this tool with chatInsight results",
          "- This tool searches raw message content, while chatInsight searches extracted insights",
          "- Use BOTH tools together for comprehensive results",
          "",
          "**Available search parameters:**",
          "- keywords: Search terms - will search across ALL fields (message content, channel name, sender name). This is the MOST COMMON parameter.",
          "- days: Number of days to look back (e.g., 1, 7, 30). Default is 30 days.",
          "- platform: Filter by platform (ONLY if user explicitly mentions a specific platform)",
          "- person: Filter by sender name",
          "- channel: Filter by channel/chat name",
          "- groupBy: Group results by 'day' (Today/Yesterday), 'week', or 'month'",
          "- offset: Number of messages to skip for pagination (default: 0)",
          "- pageSize: Number of messages per page (default: 50, max: 100)",
          "",
          "**Usage Examples:**",
          "- 'Search my messages for Alloomi' → keywords=['Alloomi']",
          "- 'Search last 7 days for meetings' → keywords=['meeting'], days=7",
          "- 'Find conversations about PR' → keywords=['PR'], groupBy='day'",
          "- 'What did John say about X?' → person='John Doe', keywords=['X']",
          "- 'Show my Slack messages from today' → platform='slack', days=1, groupBy='day'",
        ].join("\n"),
        {
          botId: z
            .string()
            .optional()
            .describe(
              "DEPRECATED: Do NOT use this parameter - it will restrict results to a single bot. Always search across all bots for better results.",
            ),
          platform: z
            .string()
            .optional()
            .describe(
              "Platform name (slack, discord, telegram, gmail, outlook, teams, linkedin, instagram, twitter, whatsapp)",
            ),
          channel: z.string().optional().describe("Channel or chat name"),
          person: z.string().optional().describe("Sender or person name"),
          days: z.coerce
            .number()
            .int()
            .min(1)
            .max(365)
            .default(30)
            .describe(
              "Number of days to look back from now (1-365, default: 30)",
            ),
          startTime: z.coerce
            .number()
            .optional()
            .describe(
              "Start timestamp (Unix timestamp in seconds) - only use if user provides specific timestamp",
            ),
          endTime: z.coerce
            .number()
            .optional()
            .describe(
              "End timestamp (Unix timestamp in seconds) - only use if user provides specific timestamp",
            ),
          keywords: z
            .array(z.string())
            .optional()
            .describe(
              "Keywords to search for - will search across content, channel, and person fields",
            ),
          groupBy: z
            .enum(["none", "day", "week", "month"])
            .optional()
            .describe(
              "Group messages by time period: 'day', 'week', 'month', or 'none' for flat list",
            ),
          offset: z.coerce
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Number of messages to skip for pagination (default: 0)"),
          pageSize: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .default(50)
            .describe("Number of messages per page (default: 50, max: 100)"),
        },
        async (args) => {
          try {
            // Validate user session
            if (!session?.user?.id) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Unauthorized: invalid user session",
                  },
                ],
                isError: true,
              };
            }

            const userId = session.user.id;

            // Add userId to params
            const params = { ...args, userId };

            // Convert days to startTime if provided
            let processedParams = { ...params };
            if (args.days && !args.startTime) {
              const secondsPerDay = 24 * 60 * 60;
              const startTime =
                Math.floor(Date.now() / 1000) - args.days * secondsPerDay;
              processedParams = {
                ...params,
                startTime,
              };
            }

            // Return structured response with pagination info
            // The actual query will be executed on the client side by the frontend
            const response = {
              method: "indexeddb_query",
              params: {
                ...processedParams,
                offset: args.offset ?? 0,
                pageSize: args.pageSize ?? 50,
              },
              pagination: {
                offset: args.offset ?? 0,
                pageSize: args.pageSize ?? 50,
                hasMore: true, // Will be updated by client-side handler
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(response),
                },
              ],
              data: response,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to search messages: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * searchMemoryPath Tool
       *
       * Search the user's memory directory for files and content.
       * This tool directly searches the file system and returns results.
       */
      tool(
        "searchMemoryPath",
        [
          "**MUST USE this tool when user asks about:**",
          "- Personal information stored in memory (e.g., 'Who is my boss?', 'Tell me about my team')",
          "- Notes or files they've created (e.g., 'What did I write about X?', 'Find my notes about Y')",
          "- People information (e.g., 'What do you know about John?', 'My colleague info')",
          "- Projects or tasks in memory (e.g., 'What are my project notes?', 'Show my task list')",
          "- Strategy or planning documents (e.g., 'What is my strategy?', 'Show my plans')",
          "- Past conversations / chat history (e.g., 'what did we talk about yesterday?', 'what did I say before?')",
          "",
          "**CRITICAL: This tool provides ADDITIONAL search results to complement searchKnowledgeBase results.**",
          "- If this tool finds no results, do NOT conclude that 'no information exists'",
          "- Always combine results from this tool with searchKnowledgeBase results",
          "- This tool searches user-created markdown files, while searchKnowledgeBase searches uploaded documents",
          "- Use BOTH tools together for comprehensive results",
          "",
          "**MEMORY STRUCTURE:**",
          "- /people/ - Person profiles and contact info",
          "- /projects/ - Project notes and documentation",
          "- /notes/ - Personal notes and memos",
          "- /strategy/ - Strategy and planning documents",
          "",
          "**CONVERSATION HISTORY (cross-platform):**",
          "Use the Read tool to access conversation history stored in:",
          "  <appDataDir>/data/memory/{platform}/YYYY-MM-DD.json",
          "Where {platform} is one of: whatsapp, gmail, weixin, imessage, telegram",
          "Each file contains JSON with messages grouped by userKey and accountId.",
          "Use this to look up past conversations across days — especially useful when:",
          "- User asks about something discussed earlier ('what did we talk about yesterday?')",
          "- User references a previous topic ('as I mentioned before...')",
          "- Building context for a continuing conversation",
          "",
          "**Usage Examples:**",
          "- 'Who is my boss?' → Searches for 'boss' in all memory files",
          "- 'What are my project notes?' → Searches /projects/ directory",
          "- 'Tell me about John' → Searches for 'John' in all memory files",
        ].join("\n"),
        {
          query: z
            .string()
            .describe("Search query to find matching files and content"),
          searchInFiles: z
            .boolean()
            .default(true)
            .describe(
              "Whether to search within file content (using grep). Defaults to true.",
            ),
          directory: z
            .string()
            .optional()
            .describe(
              "Specific subdirectory to search (e.g., 'people', 'projects'). If not specified, searches all directories.",
            ),
        },
        async (args) => {
          try {
            const { query, searchInFiles = true, directory } = args;

            // Validate user session
            if (!session?.user?.id) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Unauthorized: invalid user session",
                  },
                ],
                isError: true,
              };
            }

            // Get the actual memory directory path
            const memoryPath = joinPath(getAppDataDir(), "data", "memory");

            // Check if memory directory exists
            if (!existsSync(memoryPath)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Memory directory does not exist at ${memoryPath}. You may need to create memory files first.`,
                  },
                ],
                data: {
                  memoryPath,
                  query,
                  message: "Memory directory not found",
                },
              };
            }

            const targetDir = directory
              ? `${memoryPath}/${directory}`
              : memoryPath;

            // Check if target directory exists
            if (!existsSync(targetDir)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Directory does not exist: ${targetDir}`,
                  },
                ],
                data: {
                  memoryPath,
                  targetDir,
                  query,
                  message: "Target directory not found",
                },
              };
            }

            // Collect search results
            const results: string[] = [];
            let fileCount = 0;
            let matchCount = 0;

            // Split query into keywords for better search coverage
            const keywords = query
              .split(/[\s,，,、]+/)
              .filter((k) => k.length > 0);

            // 1. Search for files with matching names (use first keyword for filename search)
            const firstKeyword = keywords[0] || query;
            try {
              const findOutput = spawnSync(
                "find",
                [targetDir, "-type", "f", "-iname", `*${firstKeyword}*`],
                {
                  encoding: "utf-8",
                  maxBuffer: 100 * 1024 * 1024,
                  shell: false,
                },
              );
              const findStdout = findOutput.stdout as string;
              if (findStdout?.trim()) {
                const matchingFiles = findStdout.trim().split("\n");
                fileCount = matchingFiles.length;
                results.push(
                  `**Found ${fileCount} file(s) with names matching "${firstKeyword}":**`,
                );
                matchingFiles.slice(0, 20).forEach((file) => {
                  const relativePath = file.replace(`${memoryPath}/`, "");
                  results.push(`- ${relativePath}`);
                });
                if (fileCount > 20) {
                  results.push(`... and ${fileCount - 20} more files`);
                }
              }
            } catch (error) {
              // No matching files found, continue
            }

            // 2. Search for content matching any keyword (OR search)
            if (searchInFiles && keywords.length > 0) {
              // Build grep pattern: search for any keyword (OR logic)

              try {
                // Search files containing any keyword
                const grepOutput = spawnSync(
                  "grep",
                  ["-r", "-i", "-l", "-E", keywords.join("|"), targetDir],
                  {
                    encoding: "utf-8",
                    maxBuffer: 100 * 1024 * 1024,
                    shell: false,
                  },
                );
                const grepStdout = grepOutput.stdout as string;
                if (grepStdout?.trim()) {
                  const matchingFiles = grepStdout
                    .trim()
                    .split("\n")
                    .slice(0, 20);
                  matchCount = matchingFiles.length;
                  results.push(
                    `\n**Found ${matchCount} file(s) with content matching keywords "${keywords.join(", ")}":**`,
                  );
                  matchingFiles.forEach((file) => {
                    const relativePath = file.replace(`${memoryPath}/`, "");
                    results.push(`- ${relativePath}`);
                  });

                  // Also show some actual content matches for each keyword
                  try {
                    const contentOutput = spawnSync(
                      "grep",
                      ["-r", "-i", "-h", "-E", keywords.join("|"), targetDir],
                      {
                        encoding: "utf-8",
                        maxBuffer: 100 * 1024 * 1024,
                        shell: false,
                      },
                    );
                    const contentStdout = contentOutput.stdout as string;
                    if (contentStdout?.trim()) {
                      results.push("\n**Sample content matches:**");
                      contentStdout
                        .trim()
                        .split("\n")
                        .slice(0, 15)
                        .forEach((line) => {
                          // Truncate long lines
                          const truncated =
                            line.length > 150
                              ? `${line.slice(0, 150)}...`
                              : line;
                          results.push(`  ${truncated}`);
                        });
                    }
                  } catch (e) {
                    // Content grep failed, continue
                  }
                }
              } catch (error) {
                // No matching content found, continue
              }
            }

            // 3. List directory structure
            try {
              const lsOutput = spawnSync("ls", ["-la", targetDir], {
                encoding: "utf-8",
                maxBuffer: 100 * 1024 * 1024,
                shell: false,
              });
              const lsStdout = lsOutput.stdout as string;
              if (lsStdout?.trim()) {
                results.push("\n**Directory structure:**");
                results.push("```");
                lsStdout
                  .trim()
                  .split("\n")
                  .slice(0, 30)
                  .forEach((line) => {
                    results.push(line);
                  });
                results.push("```");
              }
            } catch (error) {
              // ls failed, continue
            }

            // Format response
            if (results.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No matches found for "${query}" in memory directory (${targetDir}).`,
                  },
                ],
                data: {
                  memoryPath,
                  targetDir,
                  query,
                  message: "No matches found",
                },
              };
            }

            return {
              content: [
                {
                  type: "text" as const,
                  text: results.join("\n"),
                },
              ],
              data: {
                memoryPath,
                targetDir,
                query,
                fileCount,
                matchCount,
                results: results.join("\n"),
              },
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to search memory directory: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              data: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
              isError: true,
            };
          }
        },
      ),

      /**
       * createScheduledJob Tool
       *
       * Create a scheduled job (cron job) for recurring tasks
       */
      tool(
        "createScheduledJob",
        [
          "Create a scheduled job (cron job) for recurring tasks.",
          "",
          "Supports multiple schedule types:",
          "- cron: Use cron expression for complex schedules (e.g., '0 * * * *' for every hour)",
          "- interval: Simple interval in minutes",
          "- once: One-time execution at specific time",
          "",
          "Supports multiple job types:",
          "- custom: Custom handler",
          "",
          "Parameters:",
          "- name (required): Task name",
          "- description (required): MUST preserve user's original request details including platform, recipient, and content",
          "- schedule (required): Schedule configuration with type, expression/minutes/at, timezone",
          "- job (required): Job configuration with type and type-specific fields",
          "- enabled (optional): Whether to enable the job, default true",
          "",
          "Common cron expressions:",
          "- '0 * * * *' - Every hour",
          "- '*/30 * * * *' - Every 30 minutes",
          "- '0 9 * * *' - Daily at 9am",
          "- '0 9 * * 1-5' - Weekdays at 9am",
          "- '0 0 * * 0' - Sunday midnight",
          "",
          "**CRITICAL: Preserve Original Request Details**",
          "",
          "The 'description' field MUST include all key details from user's request:",
          "- Platform: Telegram, Slack, Email, etc.",
          "- Recipient: user themselves or specific person",
          "- Content: the actual reminder message",
          "- Time: when the reminder should trigger",
          "",
          "✅ Good examples:",
          '- User: "每天晚上8点在Telegram上提醒我喝水"',
          '- description: "每天晚上8点在Telegram上提醒我自己喝水"',
          "",
          '- User: "每天早上9点通过Slack提醒团队开站会"',
          '- description: "每天早上9点通过Slack提醒团队开站会"',
          "",
          "❌ Bad examples (loses critical information):",
          '- User: "每天晚上8点在Telegram上提醒我喝水"',
          '- description: "每天晚上8点提醒用户喝水" ❌ Changed "我自己" to "用户" and Missing "Telegram"',
          "",
          '- User: "每天早上9点提醒我开会"',
          '- description: "定时提醒任务" ❌ Too vague, missing time and content',
          "",
          "**Guidelines:**",
          "- Always preserve the platform name (Telegram, Slack, Email, etc.)",
          "- Always preserve the recipient identity - if user says '我' (me), use '我自己' (myself), NOT '用户' (user)",
          "- Always preserve the specific action/content (drink water, meeting, etc.)",
          "- Use user's original language and wording as much as possible",
          "- Description should be clear enough to understand WHAT, WHEN, WHERE, and TO WHOM",
          "- DO NOT rephrase or reinterpret - keep the original meaning intact",
          "",
          "**IMPORTANT:** The description should be a faithful representation of what the user said.",
          "If user says '提醒我自己', write '提醒我自己', NOT '提醒用户' or '提醒我本人'.",
        ].join("\n"),
        {
          name: z.string().describe("Task name"),
          description: z
            .string()
            .describe(
              "Task description - Use user's EXACT original wording. DO NOT translate or rephrase. Example: if user says '每天晚上8点在Telegram提醒我自己喝水', use exactly that, NOT '每天晚上8点通过Telegram提醒用户喝水'",
            ),
          schedule: z
            .object({
              type: z.enum(["cron", "interval", "once"]),
              expression: z
                .string()
                .optional()
                .describe("Cron expression (required for type='cron')"),
              minutes: z
                .number()
                .optional()
                .describe("Interval in minutes (required for type='interval')"),
              at: z
                .string()
                .optional()
                .describe("ISO datetime (required for type='once')"),
              timezone: z
                .string()
                .optional()
                .describe("Timezone (default: UTC)"),
            })
            .describe("Schedule configuration"),
          job: z
            .object({
              handler: z
                .string()
                .optional()
                .describe("Handler name (for custom)"),
            })
            .describe("Job configuration"),
          enabled: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to enable the job"),
        },
        async ({ name, description, schedule, job, enabled = true }) => {
          try {
            const { createJob } = await import("@/lib/cron/service");

            // Build schedule config
            let scheduleConfig:
              | { type: "cron"; expression: string; timezone?: string }
              | { type: "interval"; minutes: number }
              | { type: "once"; at: Date };
            if (schedule.type === "cron") {
              if (!schedule.expression) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          success: false,
                          message:
                            "Error: cron type requires 'expression' field",
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                  isError: true,
                };
              }
              scheduleConfig = {
                type: "cron" as const,
                expression: schedule.expression,
                timezone: schedule.timezone,
              };
            } else if (schedule.type === "interval") {
              if (typeof schedule.minutes !== "number") {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          success: false,
                          message:
                            "Error: interval type requires 'minutes' field",
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                  isError: true,
                };
              }
              scheduleConfig = {
                type: "interval" as const,
                minutes: schedule.minutes,
              };
            } else {
              if (!schedule.at) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          success: false,
                          message: "Error: once type requires 'at' field",
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                  isError: true,
                };
              }
              scheduleConfig = {
                type: "once" as const,
                at: new Date(schedule.at),
              };
            }

            // Build job config
            const jobConfig: {
              type: "custom";
              handler: string;
            } = {
              type: "custom" as const,
              handler: job.handler || "default",
            };

            // Create the job
            const createdJob = await createJob(session.user.id, {
              name,
              description,
              schedule: scheduleConfig,
              job: jobConfig,
              enabled,
              timezone: schedule.timezone || "UTC",
            });

            const responseData = {
              success: true,
              message: `Successfully created scheduled job: ${name}`,
              job: {
                id: createdJob.id,
                name: createdJob.name,
                scheduleType: createdJob.scheduleType,
                jobType: createdJob.jobType,
                enabled: createdJob.enabled,
                nextRunAt: createdJob.nextRunAt?.toISOString(),
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to create job: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * listScheduledJobs Tool
       *
       * List all scheduled jobs for the current user
       */
      tool(
        "listScheduledJobs",
        [
          "List all scheduled jobs (cron jobs) for the current user.",
          "",
          "Parameters:",
          "- includeDisabled (optional): Include disabled jobs, default false",
          "- limit (optional): Maximum number of jobs to return, default 50",
        ].join("\n"),
        {
          includeDisabled: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include disabled jobs"),
          limit: z.coerce
            .number()
            .optional()
            .default(50)
            .describe("Maximum number of jobs to return"),
        },
        async ({ includeDisabled = false, limit = 50 }) => {
          try {
            const { listJobs } = await import("@/lib/cron/service");
            const jobs = await listJobs(session.user.id, { includeDisabled });

            const limitedJobs = jobs.slice(0, limit);

            const responseData = {
              success: true,
              message: `Successfully retrieved ${limitedJobs.length} job(s)`,
              jobs: limitedJobs.map((job: any) => ({
                id: job.id,
                name: job.name,
                description: job.description,
                scheduleType: job.scheduleType,
                cronExpression: job.cronExpression,
                intervalMinutes: job.intervalMinutes,
                scheduledAt: job.scheduledAt,
                jobType: job.jobType,
                enabled: job.enabled,
                lastRunAt: job.lastRunAt?.toISOString(),
                nextRunAt: job.nextRunAt?.toISOString(),
                runCount: job.runCount,
                failureCount: job.failureCount,
              })),
              count: limitedJobs.length,
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to list jobs: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * deleteScheduledJob Tool
       *
       * Delete a scheduled job by ID
       */
      tool(
        "deleteScheduledJob",
        [
          "Delete a scheduled job permanently.",
          "",
          "Parameters:",
          "- jobId (required): The ID of the job to delete",
          "",
          "Use listScheduledJobs first to get the job ID",
        ].join("\n"),
        {
          jobId: z.string().describe("Job ID to delete"),
        },
        async ({ jobId }) => {
          try {
            const { deleteJob: deleteCronJob } =
              await import("@/lib/cron/service");
            await deleteCronJob(session.user.id, jobId);

            const responseData = {
              success: true,
              message: `Successfully deleted job: ${jobId}`,
              jobId,
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to delete job: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * toggleScheduledJob Tool
       *
       * Enable or disable a scheduled job
       */
      tool(
        "toggleScheduledJob",
        [
          "Enable or disable a scheduled job without deleting it.",
          "",
          "Parameters:",
          "- jobId (required): The ID of the job to toggle",
          "- enabled (required): true to enable, false to disable",
        ].join("\n"),
        {
          jobId: z.string().describe("Job ID"),
          enabled: z.boolean().describe("Enable (true) or disable (false)"),
        },
        async ({ jobId, enabled }) => {
          try {
            const { toggleJob } = await import("@/lib/cron/service");
            const updatedJob = await toggleJob(session.user.id, jobId, enabled);

            const responseData = {
              success: true,
              message: `Successfully ${enabled ? "enabled" : "disabled"} job: ${updatedJob.name}`,
              job: {
                id: updatedJob.id,
                name: updatedJob.name,
                enabled: updatedJob.enabled,
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to toggle job: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * updateScheduledJob Tool
       *
       * Update an existing scheduled job
       */
      tool(
        "updateScheduledJob",
        [
          "Update an existing scheduled job (cron job).",
          "",
          "All parameters are optional - only provide the fields you want to change.",
          "",
          "Parameters:",
          "- jobId (required): The ID of the job to update",
          "- name (optional): New task name",
          "- description (optional): New task description",
          "- schedule (optional): New schedule configuration with type, expression/minutes/at, timezone",
          "- enabled (optional): Enable or disable the job",
          "- timezone (optional): New timezone",
          "",
          "To get the job ID, use listScheduledJobs first.",
          "",
          "Examples:",
          "- Update schedule: update job's cron expression to '0 9 * * *'",
          "- Update name: rename the job",
          "- Update description: change what the job does",
          "- Disable job: set enabled to false",
        ].join("\n"),
        {
          jobId: z.string().describe("Job ID to update"),
          name: z.string().optional().describe("New task name"),
          description: z.string().optional().describe("New task description"),
          schedule: z
            .object({
              type: z.enum(["cron", "interval", "once"]),
              expression: z
                .string()
                .optional()
                .describe("Cron expression (required for type='cron')"),
              minutes: z
                .number()
                .optional()
                .describe("Interval in minutes (required for type='interval')"),
              at: z
                .string()
                .optional()
                .describe("ISO datetime (required for type='once')"),
              timezone: z
                .string()
                .optional()
                .describe("Timezone (default: UTC)"),
            })
            .optional()
            .describe("New schedule configuration"),
          enabled: z.boolean().optional().describe("Enable or disable the job"),
          timezone: z.string().optional().describe("New timezone"),
        },
        async ({ jobId, name, description, schedule, enabled, timezone }) => {
          try {
            const { updateJob, getJob } = await import("@/lib/cron/service");

            // First verify the job exists
            const existingJob = await getJob(session.user.id, jobId);
            if (!existingJob) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: `Job not found: ${jobId}`,
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Build update payload
            const updates: Parameters<typeof updateJob>[2] = {};

            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (enabled !== undefined) updates.enabled = enabled;
            if (timezone !== undefined) updates.timezone = timezone;

            if (schedule) {
              // Validate schedule based on type
              if (schedule.type === "cron" && !schedule.expression) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          success: false,
                          message: "Cron type requires 'expression' field",
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                  isError: true,
                };
              }
              if (schedule.type === "interval" && !schedule.minutes) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          success: false,
                          message: "Interval type requires 'minutes' field",
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                  isError: true,
                };
              }
              if (schedule.type === "once" && !schedule.at) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify(
                        {
                          success: false,
                          message: "Once type requires 'at' field",
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                  isError: true,
                };
              }

              // Build schedule config (fields are already validated above)
              let scheduleConfig:
                | { type: "cron"; expression: string; timezone?: string }
                | { type: "interval"; minutes: number }
                | { type: "once"; at: Date };

              if (schedule.type === "cron") {
                const expression = schedule.expression as string;
                scheduleConfig = {
                  type: "cron" as const,
                  expression,
                  timezone: schedule.timezone,
                };
              } else if (schedule.type === "interval") {
                const minutes = schedule.minutes as number;
                scheduleConfig = {
                  type: "interval" as const,
                  minutes,
                };
              } else {
                const at = schedule.at as string;
                scheduleConfig = {
                  type: "once" as const,
                  at: new Date(at),
                };
              }

              updates.schedule = scheduleConfig;
            }

            const updatedJob = await updateJob(session.user.id, jobId, updates);

            const responseData = {
              success: true,
              message: `Successfully updated job: ${updatedJob.name}`,
              job: {
                id: updatedJob.id,
                name: updatedJob.name,
                description: updatedJob.description,
                scheduleType: updatedJob.scheduleType,
                cronExpression: updatedJob.cronExpression,
                intervalMinutes: updatedJob.intervalMinutes,
                scheduledAt: updatedJob.scheduledAt,
                enabled: updatedJob.enabled,
                timezone: updatedJob.timezone,
                nextRunAt: updatedJob.nextRunAt,
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to update job: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),

      /**
       * executeScheduledJob Tool
       *
       * Trigger manual execution of a scheduled job (async, returns immediately)
       */
      tool(
        "executeScheduledJob",
        [
          "Trigger immediate execution of a scheduled job. The job runs asynchronously in the background.",
          "",
          "Parameters:",
          "- jobId (required): The ID of the job to execute",
          "",
          "Note: This triggers async execution and returns immediately after starting.",
          "The job runs in the background and does not block the current conversation.",
          "Use listScheduledJobs to see updated run statistics.",
        ].join("\n"),
        {
          jobId: z.string().describe("Job ID to execute"),
        },
        async ({ jobId }) => {
          try {
            const { getJob } = await import("@/lib/cron/service");
            const { executeJob } = await import("@/lib/cron/executor");
            const { startJobExecution, completeJobExecution } =
              await import("@/lib/cron/service");
            const { isTauriMode } = await import("@/lib/env/constants");

            const job = await getJob(session.user.id, jobId);
            if (!job) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: `Job not found: ${jobId}`,
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Detect environment (must be declared before modelConfig usage)
            const isTauri = isTauriMode();

            // Build modelConfig from cloud auth token (same as local-scheduler does)
            // This ensures scheduled jobs use the correct API config instead of falling back
            // to ~/.claude/settings.json which may have wrong model/endpoint
            const selectedModel = (job as any)?.jobConfig?.modelConfig?.model;
            const modelConfig =
              isTauri && embeddingsAuthToken
                ? {
                    baseUrl: AI_PROXY_BASE_URL,
                    apiKey: embeddingsAuthToken,
                    ...(typeof selectedModel === "string"
                      ? { model: selectedModel }
                      : {}),
                  }
                : undefined;

            const context = {
              userId: session.user.id,
              jobId: job.id,
              executionId: crypto.randomUUID(),
              triggeredBy: "manual" as const,
              modelConfig,
            };

            // Start execution tracking
            await startJobExecution(context);

            // Get job config
            const jobConfigStr =
              typeof job.jobConfig === "string"
                ? job.jobConfig
                : JSON.stringify(job.jobConfig);

            console.log("[executeScheduledJob] Executing job in environment:", {
              jobId: job.id,
              isTauri,
              jobType: job.jobType,
            });

            // Execute job asynchronously (don't await)
            (async () => {
              try {
                const result = await executeJob(
                  context,
                  jobConfigStr,
                  job.description || undefined,
                  isTauri, // ← Pass isTauri flag
                );
                await completeJobExecution(context, result);
              } catch (error) {
                await completeJobExecution(context, {
                  status: "error",
                  output: "",
                  error: error instanceof Error ? error.message : String(error),
                  duration: 0,
                });
              }
            })();

            const responseData = {
              success: true,
              message: `Job "${job.name}" started executing (running asynchronously in background)`,
              executionId: context.executionId,
              triggeredBy: "manual",
              status: "started",
              job: {
                id: job.id,
                name: job.name,
              },
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(responseData, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Failed to execute job: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
        },
      ),
    ],
  });
}
