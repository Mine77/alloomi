"use client";

import { useSession } from "next-auth/react";
import useSWR, { mutate as mutateGlobal } from "swr";
import { getAuthToken } from "@/lib/auth/token-manager";

export const SUBSCRIPTION_KEY = "/api/stripe/subscription" as const;

const SUBSCRIPTION_STORAGE_KEY = "cached_subscription";

export interface SubscriptionData {
  planId: string | null;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string | null;
  billingCycle?: "monthly" | "yearly" | null;
}

/**
 * Read cached subscription information from localStorage
 */
function getCachedSubscription(): SubscriptionData | undefined {
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached) as SubscriptionData;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Save subscription information to localStorage
 */
function setCachedSubscription(data: SubscriptionData): void {
  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

type SubscriptionFetcherError = Error & { status?: number };

/**
 * Subscription information fetch function
 */
async function fetchSubscription(url: string): Promise<SubscriptionData> {
  // Get cloud auth token for local mode
  let cloudAuthToken: string | undefined;
  try {
    cloudAuthToken = getAuthToken() || undefined;
  } catch (error) {
    console.error("[useSubscription] Failed to read cloud_auth_token:", error);
  }

  // Prepare headers
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add Authorization header if token exists (for local mode)
  if (cloudAuthToken) {
    headers.Authorization = `Bearer ${cloudAuthToken}`;
  }

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch (error) {
    // If body isn't valid JSON, keep data as null so we can surface a useful error below.
  }

  if (!response.ok) {
    const error = new Error(
      `Failed to fetch subscription (${response.status})`,
    ) as SubscriptionFetcherError;
    error.status = response.status;
    throw error;
  }

  // Check response format
  if (!data || typeof data !== "object") {
    throw new Error("Subscription response payload malformed");
  }

  const payload = data as { subscription?: SubscriptionData };

  // If no subscription, return default value (don't throw error)
  if (!payload.subscription) {
    const data = {
      planId: null,
      isActive: false,
      cancelAtPeriodEnd: false,
    };
    setCachedSubscription(data);
    return data;
  }

  const subscription = payload.subscription;
  setCachedSubscription(subscription);
  return subscription;
}

/**
 * Subscription Hook
 * Uses SWR global cache for subscription information, avoiding duplicate fetches by multiple components
 *
 * @returns Subscription data and loading state
 */
export function useSubscription() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  // Get cached data from localStorage as fallback
  const cachedSubscription = getCachedSubscription();

  const swr = useSWR<SubscriptionData>(
    isAuthenticated ? SUBSCRIPTION_KEY : null,
    fetchSubscription,
    {
      fallbackData: cachedSubscription,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10_000, // Don't make duplicate requests within 10 seconds
      shouldRetryOnError: false,
    },
  );

  return {
    subscription: swr.data,
    isLoading: isAuthenticated ? swr.isLoading : false,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
    mutate: swr.mutate,
    isAuthenticated,
  };
}

/**
 * Clear subscription cache
 */
export function invalidateSubscriptionCache() {
  return mutateGlobal(SUBSCRIPTION_KEY);
}
