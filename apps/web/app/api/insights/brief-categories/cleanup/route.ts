import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { insightBriefCategories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Cleanup user's brief categories records (for debugging)
 * DELETE /api/insights/brief-categories/cleanup
 * By default only deletes records with source "auto", keeps "manual"
 * If ?force=true is passed, deletes all records
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    if (force) {
      // Delete all records
      await db
        .delete(insightBriefCategories)
        .where(eq(insightBriefCategories.userId, session.user.id));
    } else {
      // Only delete records with source "auto", keep "manual"
      await db
        .delete(insightBriefCategories)
        .where(
          and(
            eq(insightBriefCategories.userId, session.user.id),
            eq(insightBriefCategories.source, "auto"),
          ),
        );
    }

    return NextResponse.json({
      success: true,
      message: force
        ? "Cleaned up all brief category records"
        : "Cleaned up auto source records (manual kept)",
    });
  } catch (error) {
    console.error("[Insights] Cleanup failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
