"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface FilePreviewDrawerShellProps {
  /** Close when clicking mask or pressing Escape/Enter/Space */
  onClose: () => void;
  /** Drawer body (usually a preview area with header, internally uses `min-h-0 flex-1` for scrolling) */
  children: ReactNode;
  /** Whether expanded; false used for slide-out animation (default true when visible) */
  open?: boolean;
  /**
   * Override right drawer width (Tailwind); if not passed, uses md:w-[800px] lg:w-[900px].
   * For example, global chat preview uses min(100vw, ...) as the cap.
   */
  drawerClassName?: string;
}

/**
 * Preview drawer mounted to document.body via Portal, with mask and drawer relative to the full page viewport (100dvh) to avoid being clipped by main content area overflow.
 * Locks html/body scroll when opened, consistent with {@link FilePreviewOverlay} behavior.
 */
export function FilePreviewDrawerShell({
  onClose,
  children,
  open = true,
  drawerClassName,
}: FilePreviewDrawerShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [mounted, open]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <>
      <div
        role="button"
        tabIndex={0}
        className="fixed inset-0 z-[1000] bg-slate-950/30 transition-opacity duration-300 ease-out pointer-events-none md:pointer-events-auto"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
        style={{ opacity: open ? 1 : 0 }}
      />
      <div
        className={cn(
          "fixed top-0 right-0 z-[1001] flex h-[100dvh] max-h-[100dvh] min-h-0 min-w-0 w-full flex-col overflow-hidden border-l border-border/60 bg-background shadow-2xl transition-transform duration-300 ease-out",
          drawerClassName ?? "md:w-[800px] lg:w-[900px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
