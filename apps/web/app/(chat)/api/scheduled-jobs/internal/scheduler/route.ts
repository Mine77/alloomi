/**
 * Internal API for Local Scheduler
 * This endpoint starts the local scheduler in Tauri/Desktop environment
 */

import { NextResponse } from "next/server";
import {
  startLocalScheduler,
  getSchedulerStatus,
  setSchedulerUserId,
} from "@/lib/cron/local-scheduler";
import { setCloudAuthToken } from "@/lib/auth/token-manager";
import { isTauriMode } from "@/lib/env";
import { auth } from "@/app/(auth)/auth";

let schedulerStarted = false;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  console.log("[SchedulerAPI] GET request received");
  console.log(`   URL: ${request.url}`);
  console.log(`   isTauriMode: ${isTauriMode()}`);

  // Get cloudAuthToken from URL params
  const url = new URL(request.url);
  const cloudAuthToken = url.searchParams.get("cloudAuthToken") || undefined;

  try {
    // Only allow in Tauri mode
    if (!isTauriMode()) {
      console.log("[SchedulerAPI] Not in Tauri mode, returning 400");
      return NextResponse.json(
        {
          error: "Local scheduler is only available in Tauri/Desktop mode",
        },
        { status: 400 },
      );
    }

    // Get current user from session
    let userId: string | undefined;
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch (e) {
      // auth() may throw when no session exists
      userId = undefined;
    }

    if (!userId) {
      return NextResponse.json(
        {
          error: "User not authenticated",
        },
        { status: 401 },
      );
    }

    // Start the scheduler if not already started
    if (!schedulerStarted) {
      // Set cloud auth token for scheduled job execution
      setCloudAuthToken(cloudAuthToken);
      // Set current user ID for job filtering
      setSchedulerUserId(userId);
      await startLocalScheduler();
      schedulerStarted = true;
    }

    const status = getSchedulerStatus();
    console.log("[SchedulerAPI] Returning status:", status);

    return NextResponse.json({
      success: true,
      scheduler: status,
    });
  } catch (error) {
    console.error("[SchedulerAPI] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
