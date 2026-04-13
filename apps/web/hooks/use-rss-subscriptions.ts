"use client";

import useSWR from "swr";
import type { RssSubscription } from "@/lib/db/schema";

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as { subscriptions: RssSubscription[] };
};

export function useRssSubscriptions() {
  const { data, error, isLoading, mutate } = useSWR<{
    subscriptions: RssSubscription[];
  }>("/api/integrations/rss", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return {
    subscriptions: data?.subscriptions ?? [],
    isLoading,
    error,
    mutate,
  };
}
