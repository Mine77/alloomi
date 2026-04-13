import { describe, test, expect } from "vitest";
import { buildRssItemInserts, type RssSubscription } from "@alloomi/rss";

const baseSubscription: RssSubscription = {
  id: "sub-1",
  userId: "user-1",
  sourceUrl: "https://example.com/feed.xml",
  status: "active",
  sourceType: "custom",
  title: null,
  category: null,
};

describe("buildRssItemInserts", () => {
  test("generates stable hashes and metadata", () => {
    const inserts = buildRssItemInserts({
      subscription: baseSubscription,
      feedTitle: "Example Feed",
      items: [
        {
          title: "Hello",
          link: "https://example.com/hello",
          guid: "guid-123",
          isoDate: "2024-01-01T00:00:00.000Z",
          categories: ["web3"],
          contentSnippet: "Summary",
          content: "<p>Summary</p>",
        },
      ],
    });

    expect(inserts.length).toBe(1);
    const [item] = inserts;
    expect(item.subscriptionId).toBe(baseSubscription.id);
    expect(item.guidHash.length).toBeGreaterThan(10);
    expect(item.metadata?.categories).toEqual(["web3"]);
    expect(item.metadata?.feedTitle).toBe("Example Feed");
    expect(item.status).toBe("pending");
    expect(item.link).toBe("https://example.com/hello");
  });

  test("respects limit when truncating items", () => {
    const manyItems = Array.from({ length: 50 }, (_, index) => ({
      title: `Item ${index}`,
      guid: `guid-${index}`,
    }));

    const inserts = buildRssItemInserts({
      subscription: baseSubscription,
      items: manyItems,
      limit: 5,
    });

    expect(inserts.length).toBe(5);
    // Check all guidHash are unique
    expect(new Set(inserts.map((item) => item.guidHash)).size).toBe(5);
  });
});
