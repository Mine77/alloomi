"use client";

import { useEffect } from "react";
import { getAuthToken } from "@/lib/auth/token-manager";

/**
 * Scheduled Jobs Auto-Initialization Component
 *
 * This component should be imported in the app root layout (Tauri environment only)
 * It automatically starts the local scheduler on app startup for executing scheduled user tasks
 */
export function ScheduledJobsInit() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      return;
    }

    // Check if running in Tauri environment
    const isTauri = !!(window as any).__TAURI__;
    if (!isTauri) {
      return; // Non-Tauri environment, skip initialization
    }

    // Delay execution to ensure app is fully loaded
    const timer = setTimeout(async () => {
      try {
        // Call scheduler API to start the local scheduler
        // Get cloud auth token from localStorage for Tauri mode
        const cloudAuthToken = getAuthToken();
        const response = await fetch(
          `/api/scheduled-jobs/internal/scheduler${
            cloudAuthToken
              ? `?cloudAuthToken=${encodeURIComponent(cloudAuthToken)}`
              : ""
          }`,
        );

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const data = await response.json();

            if (data.success && data.scheduler.isRunning) {
              console.log(
                "[Scheduled Jobs] ✅ Local scheduler is running (checks every",
                data.scheduler.checkInterval / 1000,
                "seconds)",
              );
            }
          } else {
            console.warn(
              "[Scheduled Jobs Init] Unexpected response content-type:",
              contentType,
            );
          }
        } else {
          console.warn(
            "[Scheduled Jobs Init] API returned non-OK status:",
            response.status,
          );
        }
      } catch (error) {
        console.error("[Scheduled Jobs Init] Failed to initialize:", error);
      }
    }, 3000); // Delay 3 seconds to ensure Next.js fully starts

    return () => clearTimeout(timer);
  }, []);

  // This component does not render any content
  return null;
}
