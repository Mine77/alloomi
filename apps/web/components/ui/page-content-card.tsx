"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Unified large card container for single-column pages
 * Shares consistent styles with AgentLayout center/right areas (rounded corners, background, border, no shadow)
 * Used for single-column pages such as Personal Setting, Subscription, Library, files, scheduled-jobs, skills, etc.
 */
const PageContentCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "content-area-card",
      "overflow-visible flex flex-col flex-1 min-h-0",
      className,
    )}
    {...props}
  />
));
PageContentCard.displayName = "PageContentCard";

export { PageContentCard };
