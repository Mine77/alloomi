/**
 * iMessage self-message listener auto-initialization component (SDK version)
 *
 * Runs in non-Tauri environment, initializes iMessage self-message listener via API call
 * Uses @photon-ai/imessage-kit SDK
 *
 * Workflow:
 * - Runs in non-Tauri environment (using SDK)
 * - Delay 5 seconds to ensure app is fully loaded
 * - Trigger listener initialization via API call
 */

"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { isTauri } from "@tauri-apps/api/core";
import { getAuthToken } from "@/lib/auth/token-manager";

export function IMessageSelfListenerInit() {
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isTauri()) {
      return;
    }

    const timer = setTimeout(async () => {
      const userId = session?.user?.id;
      const isAuthenticated = session !== null && !!userId;
      if (!isAuthenticated) {
        return;
      }

      try {
        // Get cloud auth token from localStorage for API configuration
        const cloudAuthToken = getAuthToken() || undefined;

        // SDK version needs API call (because it involves database checks)
        await fetch("/api/imessage/init-self-listener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(cloudAuthToken && { authToken: cloudAuthToken }),
          }),
        });
      } catch (error) {
        console.error("[IMessageListenerInit] Initialization failed:", error);
      }
    }, 5000); // 5 second delay, initialize after Telegram and WhatsApp

    return () => clearTimeout(timer);
  }, [session?.user?.id]);
  return null;
}
