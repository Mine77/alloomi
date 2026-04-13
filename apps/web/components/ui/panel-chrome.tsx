"use client";

import { cn } from "@/lib/utils";

/**
 * Glass panel style container: used for agent panels (e.g., events-panel, brief-panel) and other blocks that need a frosted glass effect.
 * Styles: bg-card/90 backdrop-blur-md rounded-2xl border border-border/40, consistent with the design system.
 */
export function PanelChrome({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/90 backdrop-blur-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
