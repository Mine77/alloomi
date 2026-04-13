/**
 * Insight card unread status and time formatting cache
 * Storage and cache logic independent of UI for main component simplification
 */

import { useCallback, useEffect, useRef, useState } from "react";

const LOCAL_STORAGE_KEY = "insightUnreadStatus_v1";
const DEBOUNCE_DELAY = 500;

interface CacheEntry {
  value: string;
  timestamp: number;
}

/** Simple LRU cache for time formatting results */
export class TimeFormatCache {
  private cache = new Map<string, CacheEntry>();
  private maxAge = 60000;
  private maxSize = 100;

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }
}

interface StorageSchema {
  version: 1;
  data: Record<string, boolean>;
}

const DEFAULT_SCHEMA: StorageSchema = { version: 1, data: {} };

export const readStorage = (key: string): StorageSchema => {
  try {
    const storedData = localStorage.getItem(key);
    if (!storedData) return DEFAULT_SCHEMA;
    const parsed = JSON.parse(storedData);
    if (parsed && typeof parsed === "object" && parsed.version === 1) {
      return parsed as StorageSchema;
    }
    if (typeof parsed === "object" && !("version" in parsed)) {
      return { version: 1, data: parsed as Record<string, boolean> };
    }
    return DEFAULT_SCHEMA;
  } catch {
    return DEFAULT_SCHEMA;
  }
};

export const writeStorage = (key: string, data: StorageSchema): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

export const updateInsightStatus = (
  key: string,
  insightId: string,
  isUnread: boolean,
): void => {
  const storage = readStorage(key);
  storage.data[insightId] = isUnread;
  writeStorage(key, storage);
};

/** Unread status of single insight (with debounced persistence) */
export function useUnreadState(insightId: string) {
  const [isUnread, setIsUnread] = useState<boolean>(() => {
    const storage = readStorage(LOCAL_STORAGE_KEY);
    return storage.data[insightId] !== undefined
      ? storage.data[insightId]
      : true;
  });
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateInsightStatus(LOCAL_STORAGE_KEY, insightId, isUnread);
    }, DEBOUNCE_DELAY);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isUnread, insightId]);

  const markAsRead = useCallback(() => setIsUnread(false), []);
  return { isUnread, markAsRead };
}
