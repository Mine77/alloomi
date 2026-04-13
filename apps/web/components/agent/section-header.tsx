"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AgentSectionHeaderProps {
  title: string | ReactNode; // Supports string or ReactNode for complex content (e.g., tabs)
  children?: ReactNode;
  className?: string;
  /** Footer content, used to display extra content inside the header (e.g., filters) */
  footer?: ReactNode;
}

/**
 * Agent page section unified Header component (shared styles)
 *
 * Convention: except for Chat panel, all pages using this component use the shared styles below;
 * Chat in chat-header-panel.tsx overrides padding via className, keeping independent styles.
 *
 * Shared styles:
 * - Vertical spacing: py-6 (24px), consistent with PageSectionHeader
 * - Horizontal spacing: px-6 (24px), consistent with PageSectionHeader
 * - Background: white (bg-card), no border
 * - Title style: text-3xl font-serif font-semibold tracking-tight
 */
export function AgentSectionHeader({
  title,
  children,
  className,
  footer,
}: AgentSectionHeaderProps) {
  const isTitleString = typeof title === "string";
  // Only consider footer as present when it has actual content (exclude null, false, undefined)
  const hasFooter = footer !== undefined && footer !== null && footer !== false;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-card py-6 px-6 shrink-0",
        hasFooter ? "flex flex-col gap-3" : "flex items-center justify-between",
        className,
      )}
    >
      <div className="flex w-full items-center gap-4 min-w-0">
        {isTitleString ? (
          <span className="truncate text-3xl font-serif font-semibold tracking-tight text-foreground flex-1 min-w-0 leading-10">
            {title}
          </span>
        ) : (
          <div className="flex items-center flex-1 min-w-0 font-serif">
            {title}
          </div>
        )}
        {children && (
          <div className="flex items-center gap-2 shrink-0 flex-shrink-0">
            {children}
          </div>
        )}
      </div>
      {hasFooter && <div className="w-full">{footer}</div>}
    </header>
  );
}
