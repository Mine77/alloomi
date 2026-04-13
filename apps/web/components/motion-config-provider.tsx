"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Lazy load framer-motion to reduce initial bundle size
const MotionConfig = dynamic(
  () =>
    import("framer-motion").then((mod) => ({
      default: mod.MotionConfig,
    })),
  { ssr: true },
);

/**
 * Motion configuration component.
 * Reduces animations in Tauri environments or when the user has enabled "Reduce Motion" to improve performance.
 */
export function MotionConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  useEffect(() => {
    // Detect if running in Tauri environment
    const isTauri = !!(window as any).__TAURI__;

    // Detect if user has enabled "Reduce Motion"
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    setShouldReduceMotion(isTauri || prefersReducedMotion);
  }, []);

  return (
    <MotionConfig reducedMotion={shouldReduceMotion ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
