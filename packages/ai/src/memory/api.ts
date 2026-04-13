import type {
  MemorySearchHit,
  MemorySearchQuery,
  MemorySearchWithFallbackResult,
  MemoryStorageAdapter,
} from "./contracts";

export interface QueryWithFallbackInput extends MemorySearchQuery {
  /**
   * When raw results are below this number, query summaries as fallback.
   * Defaults to pageSize (or 50).
   */
  minRawResultsWithoutFallback?: number;
}

export interface CreateMemoryQueryApiInput {
  storage: MemoryStorageAdapter;
  defaultPageSize?: number;
  markRawAccessOnRead?: boolean;
}

export interface MemoryQueryApi {
  queryWithFallback(
    input: QueryWithFallbackInput,
  ): Promise<MemorySearchWithFallbackResult>;
}

function resolvePageSize(
  input: QueryWithFallbackInput,
  defaultPageSize: number,
) {
  return input.pageSize ?? input.limit ?? defaultPageSize;
}

export function createMemoryQueryApi(
  input: CreateMemoryQueryApiInput,
): MemoryQueryApi {
  const defaultPageSize = input.defaultPageSize ?? 50;
  const markRawAccessOnRead = input.markRawAccessOnRead ?? true;

  return {
    async queryWithFallback(queryInput: QueryWithFallbackInput) {
      const pageSize = resolvePageSize(queryInput, defaultPageSize);
      const minRawResults = queryInput.minRawResultsWithoutFallback ?? pageSize;

      const rawResult = await input.storage.queryRaw({
        ...queryInput,
        pageSize,
      });

      const rawHits: MemorySearchHit[] = rawResult.items.map((record) => ({
        sourceType: "raw",
        timestamp: record.timestamp,
        record,
      }));

      let summaryHits: MemorySearchHit[] = [];
      let summaryHasMore = false;

      if (rawHits.length < minRawResults) {
        const remaining = Math.max(1, pageSize - rawHits.length);
        const summaryResult = await input.storage.querySummaries({
          userId: queryInput.userId,
          keywords: queryInput.keywords,
          startTime: queryInput.startTime,
          endTime: queryInput.endTime,
          reverse: queryInput.reverse,
          pageSize: remaining,
          offset: queryInput.offset,
          dimensions: queryInput.dimensions,
        });

        summaryHits = summaryResult.items.map((summary) => ({
          sourceType: "summary",
          timestamp: summary.endTimestamp,
          summary,
        }));
        summaryHasMore = summaryResult.hasMore;
      }

      const merged = [...rawHits, ...summaryHits].sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      const items = merged.slice(0, pageSize);

      if (markRawAccessOnRead && input.storage.markRecordsAccessed) {
        const rawIds = items
          .filter((hit) => hit.sourceType === "raw")
          .map((hit) => hit.record.id);
        if (rawIds.length > 0) {
          await input.storage.markRecordsAccessed({
            userId: queryInput.userId,
            ids: rawIds,
            at: Date.now(),
          });
        }
      }

      return {
        items,
        rawCount: rawHits.length,
        summaryCount: summaryHits.length,
        hasMore:
          rawResult.hasMore || summaryHasMore || merged.length > pageSize,
      };
    },
  };
}
