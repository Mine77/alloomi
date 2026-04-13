import { NextResponse } from "next/server";
import { getLandingPromoStats } from "@/lib/db/landing-promo";

/**
 * GET /api/landing/stats
 * Get current landing page promotion statistics
 */
export async function GET() {
  try {
    const stats = await getLandingPromoStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[Landing Stats] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch landing stats",
      },
      { status: 500 },
    );
  }
}
