"use client";

import type { ReactNode } from "react";

/**
 * Wraps personalization-related panels.
 *
 * A nested `SWRConfig` with a custom localStorage `provider` was removed: under React 18
 * Strict Mode, SWR deletes the provider from `SWRGlobalState` on unmount but keeps a
 * stale cache ref, so the next `useSWR` run hits `SWRGlobalState.get(cache) === undefined`
 * and throws `undefined is not iterable` (see vercel/swr#2719). Children use the default
 * in-memory SWR cache; preferences still load from the API.
 */
export function PersonalizationSwrBoundary({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
