/**
 * Custom hook for Insight unread status
 * Includes unread status checking and management
 */

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Return value of Insight unread status Hook
 */
interface UseInsightUnreadReturn {
  insightIsUnread: (insightId: string) => boolean;
  unreadStatusVersion: number;
  setUnreadStatusVersion: React.Dispatch<React.SetStateAction<number>>;
  isMountedRef: React.MutableRefObject<boolean>;
}

/**
 * Custom hook for Insight unread status
 * @returns Unread status-related functions and state
 */
export function useInsightUnread(): UseInsightUnreadReturn {
  // Used to track localStorage unread status updates, trigger component re-render
  const [unreadStatusVersion, setUnreadStatusVersion] = useState(0);

  // Used to track if component is mounted, prevent state updates after component unmount
  const isMountedRef = useRef(true);

  // Cache unread status to avoid frequent localStorage reads
  const unreadStatusCacheRef = useRef<Record<string, boolean> | null>(null);
  const cacheVersionRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // When version changes, re-read localStorage to update cache
    if (typeof window === "undefined") return;
    try {
      const storedData = window.localStorage.getItem("insightUnreadStatus");
      if (storedData) {
        unreadStatusCacheRef.current = JSON.parse(storedData) as Record<
          string,
          boolean
        >;
      }
      cacheVersionRef.current = unreadStatusVersion;
    } catch (error) {
      console.error("Failed to read unread status from localStorage:", error);
    }
  }, [unreadStatusVersion]);

  /**
   * Check if insight is unread
   * @param insightId - Insight ID
   * @returns Whether it's in unread status
   */
  const insightIsUnread = useCallback(
    (insightId: string): boolean => {
      if (typeof window === "undefined") return true;

      // Prefer cache
      if (unreadStatusCacheRef.current) {
        return unreadStatusCacheRef.current[insightId] !== undefined
          ? unreadStatusCacheRef.current[insightId]
          : true; // Default unread
      }

      // On cache miss, try reading localStorage
      try {
        const storedData = window.localStorage.getItem("insightUnreadStatus");
        if (storedData) {
          const unreadStatus = JSON.parse(storedData) as Record<
            string,
            boolean
          >;
          unreadStatusCacheRef.current = unreadStatus;
          return unreadStatus[insightId] !== undefined
            ? unreadStatus[insightId]
            : true; // Default unread
        }
        return true; // Default unread
      } catch (error) {
        console.error("Failed to read unread status from localStorage:", error);
        return true;
      }
    },
    [], // Remove unreadStatusVersion dependency to avoid creating a new function on every render
  );

  return {
    insightIsUnread,
    unreadStatusVersion,
    setUnreadStatusVersion,
    isMountedRef,
  };
}
