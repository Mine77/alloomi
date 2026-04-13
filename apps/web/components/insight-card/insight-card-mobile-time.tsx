"use client";

/**
 * Insight card bottom time (displayed only on mobile)
 * Uses design token: text-muted-foreground
 */

export interface InsightCardMobileTimeProps {
  timeDisplay: string;
}

export function InsightCardMobileTime({
  timeDisplay,
}: InsightCardMobileTimeProps) {
  return (
    <div className="text-xs text-muted-foreground md:hidden no-underline bg-transparent">
      {timeDisplay}
    </div>
  );
}
