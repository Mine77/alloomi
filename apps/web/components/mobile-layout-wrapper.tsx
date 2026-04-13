"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile layout wrapper component
 * Provides unified min-height and padding.
 * Server and first client render output the same structure (div > placeholder child),
 * replaced with real children after mount to avoid useSearchParams/usePathname etc.
 * causing server/client HTML mismatch triggering Hydration errors.
 * Uses requestAnimationFrame to delay setMounted, ensuring children render after hydration completes,
 * avoiding server/client tree structure differences caused by Suspense boundaries in layout.
 */
export function MobileLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={cn("min-h-screen", "md:pb-0")}>
      {mounted ? (
        children
      ) : (
        /* Placeholder node: ensures server and client initial DOM structure match, avoiding Hydration errors */
        <div aria-hidden style={{ display: "none" }} />
      )}
    </div>
  );
}
