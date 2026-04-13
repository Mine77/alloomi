/**
 * Get execution history for a scheduled job
 */

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getJobExecutions } from "@/lib/cron/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    // Get job to verify ownership
    const { getJob } = await import("@/lib/cron/service");
    const job = await getJob(session.user.id, id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 10, 1),
      50,
    );
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const { executions, total } = await getJobExecutions(id, { limit, offset });

    return NextResponse.json({
      executions,
      total,
      hasMore: offset + executions.length < total,
    });
  } catch (error) {
    console.error("[ScheduledJobs] GET executions error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get executions",
      },
      { status: 500 },
    );
  }
}
