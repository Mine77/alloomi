/**
 * Batch API to fetch weight multipliers for multiple insights
 * POST /api/insights/weights
 *
 * Request body:
 * {
 *   insightIds: string[]  // Array of insight IDs to fetch weights for
 * }
 *
 * Response:
 * {
 *   weights: Record<string, number>  // insightId -> weightMultiplier
 *   lastViewedAt: Record<string, string>  // insightId -> ISO timestamp
 * }
 *
 * Note: If an insight has no weight record, default 1.0 is returned
 * Note: lastViewedAt is used for category decay (24h inactive -> downgrade)
 */

import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { insightWeights } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { insightIds } = body as { insightIds: string[] };

    if (!Array.isArray(insightIds)) {
      return NextResponse.json(
        { error: "insightIds must be an array" },
        { status: 400 },
      );
    }

    if (insightIds.length === 0) {
      return NextResponse.json({ weights: {}, lastViewedAt: {} });
    }

    // Fetch weights and lastViewedAt from insightWeights table
    // Only fetch the requested insight IDs for better performance
    const weights = await db
      .select({
        insightId: insightWeights.insightId,
        multiplier: insightWeights.customWeightMultiplier,
        lastViewedAt: insightWeights.lastViewedAt,
      })
      .from(insightWeights)
      .where(
        and(
          eq(insightWeights.userId, session.user.id),
          inArray(insightWeights.insightId, insightIds),
        ),
      );

    // Build result object: insightId -> multiplier (default 1.0)
    const result: Record<string, number> = {};
    const lastViewedAtResult: Record<string, string> = {};

    // Fill in fetched weights and lastViewedAt
    weights.forEach((w: any) => {
      result[w.insightId] = w.multiplier;
      if (w.lastViewedAt) {
        lastViewedAtResult[w.insightId] = w.lastViewedAt.toISOString();
      }
    });

    // Fill in missing IDs with default 1.0
    insightIds.forEach((id) => {
      if (!(id in result)) {
        result[id] = 1.0;
      }
    });

    return NextResponse.json({
      weights: result,
      lastViewedAt: lastViewedAtResult,
    });
  } catch (error) {
    console.error("[API] Failed to fetch insight weights:", error);
    return NextResponse.json(
      { error: "Failed to fetch weights", weights: {}, lastViewedAt: {} },
      { status: 500 },
    );
  }
}
