"use client";

import useSWR from "swr";
import type { IntegrationCatalogEntry } from "@/lib/db/schema";

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as { entries: IntegrationCatalogEntry[] };
};

export function useIntegrationCatalog(category?: string | string[]) {
  const params = new URLSearchParams();
  if (Array.isArray(category) && category.length > 0) {
    params.set("category", category.join(","));
  } else if (typeof category === "string" && category.length > 0) {
    params.set("category", category);
  }

  const key = `/api/integrations/catalog${params.toString() ? `?${params.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<{
    entries: IntegrationCatalogEntry[];
  }>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return {
    entries: data?.entries ?? [],
    isLoading,
    error,
    mutate,
  };
}
