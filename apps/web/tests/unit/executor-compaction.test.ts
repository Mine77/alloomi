import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extensions", () => ({
  createClaudeAgent: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  prepareConversationWindows: vi.fn(),
  triggerCompactionAsync: vi.fn(),
}));

vi.mock("@alloomi/agent", () => ({
  preprocessCompactionMessages: vi.fn(),
}));

vi.mock("@/lib/cron/service", () => ({
  getJob: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  saveChat: vi.fn(),
  saveMessages: vi.fn(),
  getMessageById: vi.fn(),
  updateMessageFileMetadata: vi.fn(),
  saveChatInsights: vi.fn(),
  replaceMessagesWithCompactionSummary: vi.fn(),
  getUserInsightSettings: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/utils", () => {
  let seq = 0;
  return {
    generateUUID: vi.fn(() => `test-uuid-${++seq}`),
  };
});

vi.mock("@/lib/db/schema", () => ({
  characters: { id: "id", status: "status", insightId: "insightId" },
  insight: { id: "id" },
  message: { chatId: "chatId", createdAt: "createdAt" },
}));

vi.mock("@alloomi/billing/entitlements", () => ({
  entitlementsByUserType: {},
}));

import { createClaudeAgent } from "@/lib/extensions";
import { prepareConversationWindows, triggerCompactionAsync } from "@/lib/ai";
import { preprocessCompactionMessages } from "@alloomi/agent";
import { getJob } from "@/lib/cron/service";
import {
  getUserInsightSettings,
  replaceMessagesWithCompactionSummary,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import { db } from "@/lib/db/index";
import { executeJob } from "@/lib/cron/executor";

function createDoneOnlyGenerator() {
  return (async function* () {
    yield { type: "done" } as any;
  })();
}

function mockHistoryQueryResult(rows: any[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  } as any;
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  vi.mocked((db as any).select).mockReturnValue(chain);
}

function makeCandidate(
  sourceMessageId: string,
  content: string,
  timestampSeed: number,
) {
  return {
    id: `${sourceMessageId}:0`,
    sourceMessageId,
    role: "assistant" as const,
    content,
    messageType: "message" as const,
    timestamp: Date.UTC(2026, 0, timestampSeed),
    tokens: 10,
    bucket: "archive",
    ageMs: 1000,
  };
}

describe("cron executor compaction flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createClaudeAgent).mockReturnValue({
      run: vi.fn(() => createDoneOnlyGenerator()),
    } as any);

    vi.mocked(getJob).mockResolvedValue({
      id: "job-1",
      name: "Scheduler Job",
    } as any);
    vi.mocked(getUserInsightSettings).mockResolvedValue({
      aiSoulPrompt: null,
      language: "en",
    } as any);

    vi.mocked(saveChat).mockResolvedValue(undefined as any);
    vi.mocked(saveMessages).mockResolvedValue(undefined as any);

    vi.mocked(preprocessCompactionMessages).mockImplementation(
      (messages: any) => ({
        sanitized: messages,
        groups: [],
        flattened: (messages ?? []).map((message: any) => ({
          role: message.role,
          type: message.type,
          content: message.content,
        })),
      }),
    );
  });

  it("excludes existing compaction summaries from async compaction candidates", async () => {
    const summarySourceId = "msg-summary";
    const normalSourceIds = Array.from(
      { length: 11 },
      (_, index) => `msg-normal-${index}`,
    );

    const historyRows = [
      {
        id: summarySourceId,
        role: "assistant",
        parts: [{ type: "text", text: "already summarized row" }],
        metadata: { type: "compaction_summary" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      ...normalSourceIds.map((id, index) => ({
        id,
        role: "assistant",
        parts: [{ type: "text", text: `raw-${index}` }],
        metadata: null,
        createdAt: new Date(
          `2026-01-${String(index + 2).padStart(2, "0")}T00:00:00.000Z`,
        ),
      })),
    ];
    mockHistoryQueryResult(historyRows);

    vi.mocked(prepareConversationWindows).mockReturnValue({
      totalTokens: 120_000,
      immediate: [],
      immediateTokens: 0,
      candidatesForCompaction: [
        makeCandidate(summarySourceId, "already summarized candidate", 1),
        ...normalSourceIds.map((id, index) =>
          makeCandidate(id, `candidate-${index}`, index + 2),
        ),
      ],
      compactionCandidateTokens: 70_000,
      usageRatio: 1.2,
      level: "hard",
      bucketStats: {
        recent: { messages: 0 },
        warm: { messages: 0 },
        cold: { messages: 0 },
        archive: { messages: 12 },
      },
    } as any);
    vi.mocked(triggerCompactionAsync).mockResolvedValue(undefined);

    await executeJob(
      {
        userId: "u1",
        jobId: "job-1",
        executionId: "exec-1",
        triggeredBy: "scheduler",
        modelConfig: { apiKey: "token" },
      },
      JSON.stringify({
        type: "custom",
        handler: "do scheduler task",
      }),
      "run compaction flow",
      false,
    );

    expect(triggerCompactionAsync).toHaveBeenCalledTimes(1);
    const compactionCall = vi.mocked(triggerCompactionAsync).mock
      .calls[0][0] as any;
    expect(compactionCall.messages).toHaveLength(11);
    expect(
      compactionCall.messages.some(
        (message: { content: string }) =>
          message.content === "already summarized candidate",
      ),
    ).toBe(false);

    await compactionCall.persistSummary(
      {
        summary: "compacted summary",
        messageCount: 11,
        level: "hard",
        originalTokens: 1000,
        summaryTokens: 200,
        creditsUsed: 1,
      },
      compactionCall.messages,
    );

    expect(replaceMessagesWithCompactionSummary).toHaveBeenCalledTimes(1);
    const replacementArg = vi.mocked(replaceMessagesWithCompactionSummary).mock
      .calls[0][0] as any;
    expect(replacementArg.chatId).toBe("job-1");
    expect(replacementArg.messageIds).toEqual(normalSourceIds);
    expect(replacementArg.messageIds).not.toContain(summarySourceId);
  });

  it("does not trigger async compaction when safe candidates are 10 or fewer", async () => {
    const summarySourceIds = ["msg-summary-1", "msg-summary-2"];
    const normalSourceIds = Array.from(
      { length: 10 },
      (_, index) => `msg-normal-${index}`,
    );
    const historyRows = [
      ...summarySourceIds.map((id, index) => ({
        id,
        role: "assistant",
        parts: [{ type: "text", text: `summary-row-${index}` }],
        metadata: { type: "compaction_summary" },
        createdAt: new Date(`2026-02-0${index + 1}T00:00:00.000Z`),
      })),
      ...normalSourceIds.map((id, index) => ({
        id,
        role: "assistant",
        parts: [{ type: "text", text: `raw-${index}` }],
        metadata: null,
        createdAt: new Date(
          `2026-02-${String(index + 3).padStart(2, "0")}T00:00:00.000Z`,
        ),
      })),
    ];
    mockHistoryQueryResult(historyRows);

    vi.mocked(prepareConversationWindows).mockReturnValue({
      totalTokens: 120_000,
      immediate: [],
      immediateTokens: 0,
      candidatesForCompaction: [
        ...summarySourceIds.map((id, index) =>
          makeCandidate(id, `already summarized ${index}`, index + 1),
        ),
        ...normalSourceIds.map((id, index) =>
          makeCandidate(id, `candidate-${index}`, index + 10),
        ),
      ],
      compactionCandidateTokens: 60_000,
      usageRatio: 1.2,
      level: "hard",
      bucketStats: {
        recent: { messages: 0 },
        warm: { messages: 0 },
        cold: { messages: 0 },
        archive: { messages: 12 },
      },
    } as any);

    await executeJob(
      {
        userId: "u1",
        jobId: "job-1",
        executionId: "exec-2",
        triggeredBy: "scheduler",
        modelConfig: { apiKey: "token" },
      },
      JSON.stringify({
        type: "custom",
        handler: "do scheduler task",
      }),
      "run compaction flow",
      false,
    );

    expect(triggerCompactionAsync).not.toHaveBeenCalled();
  });

  it("keeps overlapping source rows on immediate side and excludes them from compaction replacement", async () => {
    const overlapSourceId = "msg-overlap";
    const normalSourceIds = Array.from(
      { length: 11 },
      (_, index) => `msg-normal-overlap-${index}`,
    );
    const historyRows = [
      {
        id: overlapSourceId,
        role: "assistant",
        parts: [{ type: "text", text: "overlap-row" }],
        metadata: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      ...normalSourceIds.map((id, index) => ({
        id,
        role: "assistant",
        parts: [{ type: "text", text: `raw-${index}` }],
        metadata: null,
        createdAt: new Date(
          `2026-03-${String(index + 2).padStart(2, "0")}T00:00:00.000Z`,
        ),
      })),
    ];
    mockHistoryQueryResult(historyRows);

    vi.mocked(prepareConversationWindows).mockReturnValue({
      totalTokens: 130_000,
      immediate: [makeCandidate(overlapSourceId, "immediate-overlap", 1)],
      immediateTokens: 5_000,
      candidatesForCompaction: [
        makeCandidate(overlapSourceId, "candidate-overlap", 1),
        ...normalSourceIds.map((id, index) =>
          makeCandidate(id, `candidate-${index}`, index + 2),
        ),
      ],
      compactionCandidateTokens: 90_000,
      usageRatio: 1.3,
      level: "hard",
      bucketStats: {
        recent: { messages: 1 },
        warm: { messages: 0 },
        cold: { messages: 0 },
        archive: { messages: 12 },
      },
    } as any);
    vi.mocked(triggerCompactionAsync).mockResolvedValue(undefined);

    await executeJob(
      {
        userId: "u1",
        jobId: "job-1",
        executionId: "exec-overlap",
        triggeredBy: "scheduler",
        modelConfig: { apiKey: "token" },
      },
      JSON.stringify({
        type: "custom",
        handler: "do scheduler task",
      }),
      "run overlap compaction flow",
      false,
    );

    expect(triggerCompactionAsync).toHaveBeenCalledTimes(1);
    const compactionCall = vi.mocked(triggerCompactionAsync).mock
      .calls[0][0] as any;
    expect(
      compactionCall.messages.some(
        (message: { content: string }) =>
          message.content === "candidate-overlap",
      ),
    ).toBe(false);
    expect(compactionCall.messages).toHaveLength(11);

    await compactionCall.persistSummary(
      {
        summary: "overlap summary",
        messageCount: 11,
        level: "hard",
        originalTokens: 900,
        summaryTokens: 180,
        creditsUsed: 1,
      },
      compactionCall.messages,
    );

    const replacementArg = vi.mocked(replaceMessagesWithCompactionSummary).mock
      .calls[0][0] as any;
    expect(replacementArg.messageIds).toEqual(normalSourceIds);
    expect(replacementArg.messageIds).not.toContain(overlapSourceId);
  });

  it("expands scheduler parts into message/tool_use/tool_result before windowing", async () => {
    const historyRows = [
      {
        id: "msg-user",
        role: "user",
        parts: [{ type: "text", text: "hello from user" }],
        metadata: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        id: "msg-assistant",
        role: "assistant",
        parts: [
          { type: "text", text: "assistant text" },
          {
            type: "tool-native",
            toolName: "SearchDocs",
            toolInput: { query: "compaction" },
            status: "completed",
            toolOutput: { total: 3 },
          },
        ],
        metadata: null,
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
    ];
    mockHistoryQueryResult(historyRows);

    vi.mocked(prepareConversationWindows).mockImplementation(
      (historyConversation: any) =>
        ({
          totalTokens: 10_000,
          immediate: historyConversation,
          immediateTokens: 10_000,
          candidatesForCompaction: [],
          compactionCandidateTokens: 0,
          usageRatio: 0.1,
          level: "soft",
          bucketStats: {
            recent: { messages: 4 },
            warm: { messages: 0 },
            cold: { messages: 0 },
            archive: { messages: 0 },
          },
        }) as any,
    );

    await executeJob(
      {
        userId: "u1",
        jobId: "job-1",
        executionId: "exec-parts",
        triggeredBy: "scheduler",
      },
      JSON.stringify({
        type: "custom",
        handler: "do scheduler task",
      }),
      "run parts expansion flow",
      false,
    );

    expect(prepareConversationWindows).toHaveBeenCalledTimes(1);
    const historyInput = vi.mocked(prepareConversationWindows).mock
      .calls[0][0] as unknown as Array<{
      sourceMessageId: string;
      messageType: string;
      content: string;
    }>;
    expect(
      historyInput.some(
        (item) =>
          item.sourceMessageId === "msg-user" &&
          item.messageType === "message" &&
          item.content === "hello from user",
      ),
    ).toBe(true);
    expect(
      historyInput.some(
        (item) =>
          item.sourceMessageId === "msg-assistant" &&
          item.messageType === "tool_use" &&
          item.content.includes("[TOOL_USE] SearchDocs"),
      ),
    ).toBe(true);
    expect(
      historyInput.some(
        (item) =>
          item.sourceMessageId === "msg-assistant" &&
          item.messageType === "tool_result" &&
          item.content.includes("[TOOL_RESULT] SearchDocs (completed)"),
      ),
    ).toBe(true);
  });

  it("deduplicates source ids and computes compaction range from candidate timestamps", async () => {
    const duplicatedSourceId = "msg-dup";
    const otherSourceIds = Array.from(
      { length: 9 },
      (_, index) => `msg-range-${index}`,
    );
    const historyRows = [
      {
        id: duplicatedSourceId,
        role: "assistant",
        parts: [{ type: "text", text: "dup-row" }],
        metadata: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      ...otherSourceIds.map((id, index) => ({
        id,
        role: "assistant",
        parts: [{ type: "text", text: `raw-${index}` }],
        metadata: null,
        createdAt: new Date(
          `2026-05-${String(index + 2).padStart(2, "0")}T00:00:00.000Z`,
        ),
      })),
    ];
    mockHistoryQueryResult(historyRows);

    vi.mocked(prepareConversationWindows).mockReturnValue({
      totalTokens: 140_000,
      immediate: [],
      immediateTokens: 0,
      candidatesForCompaction: [
        makeCandidate(duplicatedSourceId, "dup-a", 1),
        {
          ...makeCandidate(duplicatedSourceId, "dup-b", 3),
          id: `${duplicatedSourceId}:1`,
        },
        ...otherSourceIds.map((id, index) =>
          makeCandidate(id, `candidate-${index}`, index + 4),
        ),
      ],
      compactionCandidateTokens: 95_000,
      usageRatio: 1.4,
      level: "hard",
      bucketStats: {
        recent: { messages: 0 },
        warm: { messages: 0 },
        cold: { messages: 0 },
        archive: { messages: 11 },
      },
    } as any);
    vi.mocked(triggerCompactionAsync).mockResolvedValue(undefined);

    await executeJob(
      {
        userId: "u1",
        jobId: "job-1",
        executionId: "exec-range",
        triggeredBy: "scheduler",
        modelConfig: { apiKey: "token" },
      },
      JSON.stringify({
        type: "custom",
        handler: "do scheduler task",
      }),
      "run range flow",
      false,
    );

    expect(triggerCompactionAsync).toHaveBeenCalledTimes(1);
    const compactionCall = vi.mocked(triggerCompactionAsync).mock
      .calls[0][0] as any;

    await compactionCall.persistSummary(
      {
        summary: "range summary",
        messageCount: 11,
        level: "hard",
        originalTokens: 1000,
        summaryTokens: 210,
        creditsUsed: 1,
      },
      compactionCall.messages,
    );

    expect(replaceMessagesWithCompactionSummary).toHaveBeenCalledTimes(1);
    const replacementArg = vi.mocked(replaceMessagesWithCompactionSummary).mock
      .calls[0][0] as any;
    expect(replacementArg.messageIds).toEqual([
      duplicatedSourceId,
      ...otherSourceIds,
    ]);
    expect(replacementArg.compactedRangeStart).toBe("2026-01-01");
    expect(replacementArg.compactedRangeEnd).toBe("2026-01-12");
    expect(new Date(replacementArg.createdAt).toISOString().slice(0, 10)).toBe(
      "2026-01-12",
    );
  });
});
