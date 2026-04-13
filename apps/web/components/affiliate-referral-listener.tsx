"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { fetchWithErrorHandlers } from "@/lib/utils";
import { isTauriMode } from "@/lib/env/client-mode";

export function AffiliateReferralListener() {
  // Tauri local version does not need affiliate marketing tracking
  if (isTauriMode()) {
    return null;
  }

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const appliedRef = useRef<Record<string, boolean>>({}); // Use object to store tracked keys to avoid duplicates
  const abortControllerRef = useRef<AbortController | null>(null); // Manage request cancellation

  // 1. Extract valid referral code (optimized logic to avoid duplicate map)
  const getReferralCode = useCallback(() => {
    if (!searchParams) return null;
    const candidateKeys = ["ref", "aff", "via", "r"];
    // Iterate candidate keys, return first non-empty value
    for (const key of candidateKeys) {
      const value = searchParams.get(key);
      if (value?.trim()) return value.trim();
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    // 2. Initialize AbortController to prevent memory leaks
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const trackReferral = async () => {
      const code = getReferralCode();
      if (!code) return;

      // 3. Generate unique key (includes full query params to avoid duplicate tracking)
      const uniqueKey = `${pathname}?${searchParams.toString()}-${code}`;
      // If already tracked this key, return directly
      if (appliedRef.current[uniqueKey]) return;
      appliedRef.current[uniqueKey] = true;

      try {
        // 4. Pass abort signal to support request cancellation
        await fetchWithErrorHandlers("/api/affiliate/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            url: window.location.href, // In client component + useEffect, window is guaranteed to exist, no extra check needed
          }),
          signal, // Bind cancel signal
        });
      } catch (error) {
        // 5. Preserve error logs (for debugging, doesn't affect user) instead of completely silent
        console.warn("[Affiliate Tracking] Failed to track referral:", error);
      }
    };

    trackReferral();

    // 6. Cancel incomplete requests when component unmounts
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [searchParams, pathname, getReferralCode]);

  return null; // Pure listener component, no UI output
}
