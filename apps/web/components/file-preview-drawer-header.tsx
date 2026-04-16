"use client";

import type { ReactNode } from "react";
import { getLibraryFileIconSrc } from "@/components/library/library-item-row";

export interface FilePreviewDrawerHeaderProps {
  /** File name for display, used to resolve extension and match file icon from library list */
  fileName: string;
  /** Right toolbar area (recommended to contain button group with `flex shrink-0 items-center gap-1`) */
  children?: ReactNode;
}

/**
 * File preview drawer header: shares the same icon slot and title layout with LibraryItemRow library grid bottom bar (icon + title), inline grid top bar, and WebsitePreview.
 */
export function FilePreviewDrawerHeader({
  fileName,
  children,
}: FilePreviewDrawerHeaderProps) {
  const ext = fileName.includes(".")
    ? (fileName.split(".").pop()?.toLowerCase() ?? "")
    : "";
  const fileIconSrc = getLibraryFileIconSrc(ext);

  return (
    <div className="flex shrink-0 min-w-0 items-center justify-between gap-2 border-b border-border/40 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-border/60 p-0.5">
          <img
            src={fileIconSrc}
            alt=""
            draggable={false}
            className="pointer-events-none h-6 w-6 object-contain"
            aria-hidden
          />
        </div>
        <p className="min-w-0 flex-1 truncate text-left text-sm font-normal text-foreground">
          {fileName}
        </p>
      </div>
      {children != null ? (
        <div className="flex max-w-[min(100%,72vw)] shrink-0 flex-wrap items-center justify-end gap-1 sm:max-w-[min(100%,55vw)] md:max-w-none">
          {children}
        </div>
      ) : null}
    </div>
  );
}
