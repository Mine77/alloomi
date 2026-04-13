"use client";

import { memo, useState } from "react";
import { AvatarDisplay } from "./avatar-display";
import type { AvatarConfiguration } from "./types";

/**
 * Circular frame avatar props.
 */
interface AvatarDisplayFramedProps {
  /** Avatar configuration */
  config: AvatarConfiguration;
  /** Size class for the outer framed container */
  className?: string;
  /** Download callback passthrough */
  onDownloadRef?: (fn: () => void) => void;
  /** Interaction toggle passthrough */
  enableInteractions?: boolean;
  /** Static low-cost mode: centered, no hover tracking, no blinking */
  staticMode?: boolean;
  /** Keep avatar centered (used by selected state in cards) */
  forceCenter?: boolean;
  /** Default to bottom-right offset, center on hover/forceCenter */
  defaultBottomRight?: boolean;
}

/**
 * Avatar display wrapped by a circular frame.
 * Clips avatar rendering inside a round viewport and keeps the existing avatar internals unchanged.
 */
export const AvatarDisplayFramed = memo(function AvatarDisplayFramed({
  config,
  className,
  onDownloadRef,
  enableInteractions = true,
  staticMode = false,
  forceCenter = false,
  defaultBottomRight = false,
}: AvatarDisplayFramedProps) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldTrack = enableInteractions && !staticMode && isHovered;
  const shouldBlink = !staticMode;
  const shouldCenter =
    staticMode || forceCenter || isHovered || !defaultBottomRight;

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-full border border-border/70 bg-background/80 shadow-[0_0_0_2px_rgba(255,255,255,0.45)] ${className ?? "w-[120px]"}`}
      role="img"
      aria-label="Avatar preview"
      onMouseEnter={staticMode ? undefined : () => setIsHovered(true)}
      onMouseLeave={staticMode ? undefined : () => setIsHovered(false)}
    >
      {/* Character cards can use bottom-right default and center on hover/selected. */}
      <div
        className={`size-full flex items-center justify-center transition-transform duration-300 ease-out ${
          shouldCenter
            ? "translate-x-0 translate-y-0"
            : "translate-x-[14%] translate-y-[14%]"
        }`}
      >
        <AvatarDisplay
          config={config}
          className="size-[250%]"
          onDownloadRef={onDownloadRef}
          enableInteractions={enableInteractions}
          enableBlinking={shouldBlink}
          enableGazeTracking={shouldTrack}
        />
      </div>
    </div>
  );
});
