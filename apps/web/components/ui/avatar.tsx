"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, alt, ...props }, ref) => {
  // Simple error handling to show fallback could be added here if needed,
  // but for now relying on CSS/stacking order or user implementation usually handles it.
  // However, Radix Avatar handles this by not rendering Image if it errors.
  // Let's create a visual stack: Image on top, Fallback below.
  // If Image loads, it covers Fallback. If transparent/lazy, might see fallback.
  // Better: use state.
  const [hasError, setHasError] = React.useState(false);

  if (hasError) return null;

  const resolvedAlt = alt ?? "avatar";

  return (
    // biome-ignore lint/a11y/useAltText: alt provided via resolvedAlt default
    <img
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      onError={() => setHasError(true)}
      alt={resolvedAlt}
      aria-label={resolvedAlt}
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
