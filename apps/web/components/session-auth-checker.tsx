"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import { toast } from "@/components/toast";
import { isTauri } from "@/lib/tauri";
import { getAuthToken } from "@/lib/auth/token-manager";

/**
 * Session status checker
 *
 * In Tauri mode, if there is a session but no cloud_auth_token,
 * it means the session has expired or is invalid, need to force logout
 */
export function SessionAuthChecker() {
  const { data: session, status } = useSession();
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check in Tauri environment
    if (!isTauri()) {
      return;
    }

    // Only check once after session loading completes
    if (status === "loading" || hasChecked.current) {
      return;
    }

    hasChecked.current = true;

    const cloudAuthToken = getAuthToken();

    // Has session but no cloud_auth_token, need to force logout
    if (session?.user && !cloudAuthToken) {
      console.log(
        "[SessionAuthChecker] Session exists but no cloud_auth_token, forcing logout",
      );

      toast({
        type: "error",
        description: "Session expired, please login again",
      });

      // Clear other data in localStorage
      localStorage.clear();

      // Force logout and redirect to login page
      signOut({
        redirect: true,
        callbackUrl: "/login?logout=true",
      });
    }
  }, [session, status]);

  return null;
}
