import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { insight, insightBriefCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { InsightBriefCategory, Insight } from "@/lib/db/schema";

/**
 * Get all pinned insights (not time-limited)
 * GET /api/insights/brief-categories/pinned
 */
export async function GET(request: NextRequest) {
  // Verify user identity
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all brief category records where source != "unpinned"
    const pinnedCategories = await db
      .select()
      .from(insightBriefCategories)
      .where(eq(insightBriefCategories.userId, session.user.id))
      .orderBy(desc(insightBriefCategories.assignedAt));

    // Filter out unpinned records
    const activePinnedCategories = pinnedCategories.filter(
      (c: InsightBriefCategory) => c.source !== "unpinned",
    );

    if (activePinnedCategories.length === 0) {
      return NextResponse.json({
        success: true,
        data: { insights: [] },
      });
    }

    // Get corresponding insights
    const pinnedInsightIds = activePinnedCategories.map(
      (c: InsightBriefCategory) => c.insightId,
    );
    const insights = await db.select().from(insight);

    // Manually filter pinned insights
    const pinnedInsights = insights.filter((i: Insight) =>
      pinnedInsightIds.includes(i.id),
    );

    // Merge categories info
    const insightsWithCategories = pinnedInsights.map((insight: Insight) => {
      const categoryRecord = activePinnedCategories.find(
        (c: InsightBriefCategory) => c.insightId === insight.id,
      );
      return {
        ...insight,
        // Ensure keep-focused category is included
        categories: (() => {
          const raw = insight.categories;
          const current = Array.isArray(raw)
            ? raw
            : typeof raw === "string"
              ? JSON.parse(raw || "[]")
              : [];
          if (!current.includes("keep-focused")) {
            return [...current, "keep-focused"];
          }
          return current;
        })(),
        // Add briefCategory info
        briefCategory: categoryRecord?.category || "monitor",
      };
    });

    return NextResponse.json({
      success: true,
      data: { insights: insightsWithCategories },
    });
  } catch (error) {
    console.error("[Insights] Failed to get pinned insights:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
