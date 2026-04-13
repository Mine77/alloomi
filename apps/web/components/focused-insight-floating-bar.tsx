"use client";

import { useChatContext } from "./chat-context";
import { FocusedInsightCard } from "./focused-insight-card";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface FocusedInsightFloatingBarProps {
  /** Content below the floating bar; accordion floats above, does not occupy document flow, does not squeeze content */
  children?: React.ReactNode;
  /** Container class same width as FocusedInsightCard (e.g., max-w-3xl) for centering */
  contentClassName?: string;
}

/**
 * Floating bar container for focused insight card:
 * - With children: accordion floats above, does not occupy document flow, does not squeeze content below
 * - Without children: only renders the floating card (external positioning required)
 */
export const FocusedInsightFloatingBar = memo(
  function FocusedInsightFloatingBar({
    children,
    contentClassName = "mx-auto w-full max-w-3xl min-w-0",
  }: FocusedInsightFloatingBarProps) {
    const { focusedInsights } = useChatContext();
    const hasBar = focusedInsights.length > 0;

    // When children exist, use wrapper mode (accordion floats above)
    if (children) {
      return (
        <>
          {hasBar && (
            <div
              className="absolute top-0 left-0 right-0 z-10 flex justify-center px-4 pointer-events-none"
              aria-hidden="false"
            >
              <div className={cn("pointer-events-auto", contentClassName)}>
                <FocusedInsightCard floating />
              </div>
            </div>
          )}
          <div className="min-h-0 w-full">{children}</div>
        </>
      );
    }

    // Without children, only render floating card (for standalone floating scenarios)
    if (!hasBar) return null;

    return (
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-center px-4 pointer-events-none">
        <div className={cn("pointer-events-auto", contentClassName)}>
          <FocusedInsightCard floating />
        </div>
      </div>
    );
  },
);
