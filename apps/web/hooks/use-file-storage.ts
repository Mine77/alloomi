"use client";

import useSWR, { mutate as mutateGlobal } from "swr";

export const FILE_STORAGE_USAGE_KEY = "/api/files/usage" as const;

export type FileStorageUsage = {
  usedBytes: number;
  quotaBytes: number;
};

async function fetchUsage(url: string): Promise<FileStorageUsage> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load storage usage.");
  }

  return response.json();
}

export function useFileStorageUsage(enabled = true) {
  const swr = useSWR<FileStorageUsage>(
    enabled ? FILE_STORAGE_USAGE_KEY : null,
    fetchUsage,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    },
  );

  return {
    usage: swr.data ?? null,
    isLoading: enabled ? swr.isLoading : false,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}

export function invalidateFileStorageUsage() {
  return mutateGlobal(FILE_STORAGE_USAGE_KEY);
}
