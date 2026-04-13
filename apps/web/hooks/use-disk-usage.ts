"use client";

import useSWR, { mutate as mutateGlobal } from "swr";

export const DISK_USAGE_KEY = "/api/storage/disk-usage" as const;
export const SESSIONS_KEY = "/api/storage/sessions" as const;

export type DiskCategory = {
  key: string;
  label: string;
  sizeBytes: number;
};

export type DiskUsageOverview = {
  totalBytes: number;
  categories: DiskCategory[];
};

export type SessionInfo = {
  taskId: string;
  sizeBytes: number;
  modifiedTime: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useDiskUsage() {
  const swr = useSWR<DiskUsageOverview>(
    DISK_USAGE_KEY,
    (url) => fetchJson<DiskUsageOverview>(url),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  return {
    data: swr.data ?? null,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}

export function useSessions() {
  const swr = useSWR<{ sessions: SessionInfo[] }>(
    SESSIONS_KEY,
    (url) => fetchJson<{ sessions: SessionInfo[] }>(url),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  return {
    data: swr.data?.sessions ?? [],
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}

export function invalidateDiskUsage() {
  return mutateGlobal(DISK_USAGE_KEY);
}

export function invalidateSessions() {
  return mutateGlobal(SESSIONS_KEY);
}
