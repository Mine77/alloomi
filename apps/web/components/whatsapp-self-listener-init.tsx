/**
 * WhatsApp Self Message Listener Auto-Init Component
 *
 * Automatically starts WhatsApp self-message listener (Note to Self monitoring)
 * when app starts in Tauri/desktop environment.
 *
 * This component:
 * - Only runs in Tauri environment (skips in web)
 * - Delays 3 seconds to ensure app is fully loaded on initial page load
 * - Immediately triggers init when a WhatsApp account is authorized
 * - Re-triggers on session change
 */

"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getAuthToken } from "@/lib/auth/token-manager";

async function triggerInit(userId: string) {
  try {
    const cloudAuthToken = getAuthToken() || undefined;
    const response = await fetch("/api/whatsapp/init-self-listener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(cloudAuthToken && { authToken: cloudAuthToken }),
      }),
    });
    if (!response.ok) return;
    void response.text();
  } catch {
    /* handle silently */
  }
}

export function WhatsAppSelfListenerInit() {
  const { data: session } = useSession();
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTauri =
      // @ts-ignore - __TAURI__ is injected by Tauri
      (window as any).__TAURI__;
    if (!isTauri) return;

    const scheduleInit = (uid: string) => {
      userIdRef.current = uid;
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        if (userIdRef.current === uid) {
          void triggerInit(uid);
        }
      }, 3000);
    };

    // On session load, schedule init
    if (session?.user?.id) {
      scheduleInit(session.user.id);
    }

    // Trigger immediately when a WhatsApp account is authorized (no page refresh needed)
    const handleAccountAuthorized = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.platform === "whatsapp") {
        console.log(
          "[WhatsAppSelfListenerInit] WhatsApp account authorized, triggering init immediately",
        );
        if (initTimerRef.current) clearTimeout(initTimerRef.current);
        if (session?.user?.id) {
          void triggerInit(session.user.id);
        }
      }
    };
    window.addEventListener(
      "integration:accountAuthorized",
      handleAccountAuthorized,
    );

    return () => {
      window.removeEventListener(
        "integration:accountAuthorized",
        handleAccountAuthorized,
      );
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
    };
  }, [session?.user?.id]);

  return null;
}
