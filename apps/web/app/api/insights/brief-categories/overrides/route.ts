import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserCategoryOverrides } from "@/lib/insights/brief-category-override";
import type { Insight } from "@/lib/db/schema";

/**
 * Get user's pinned category flags (override EventRank)
 * POST /api/insights/brief-categories/overrides
 * Body: { insights: Insight[] }
 */
export async function POST(request: NextRequest) {
  // Verify user identity
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { insights } = body as { insights: Insight[] };

    if (!Array.isArray(insights)) {
      return NextResponse.json(
        { error: "insights must be an array" },
        { status: 400 },
      );
    }

    // Get user's pinned category flags and unpinned events
    const { overrides, unpinnedIds } = await getUserCategoryOverrides(
      session.user.id,
      insights,
    );

    // Convert Map to plain object for return
    const overridesObj = Object.fromEntries(overrides);

    return NextResponse.json({
      success: true,
      data: { overrides: overridesObj, unpinnedIds: Array.from(unpinnedIds) },
    });
  } catch (error) {
    console.error("[Insights] Failed to get brief category overrides:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
