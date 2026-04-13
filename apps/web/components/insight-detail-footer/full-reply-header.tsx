"use client";

import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import type { ReactNode } from "react";

interface FullReplyHeaderProps {
  onCollapse: () => void;
  sendSuccess: boolean;
  sendError: string | null;
  recipientInput?: ReactNode;
  accountSelector?: ReactNode;
  ccButton?: ReactNode;
}

/**
 * Header of the full reply component
 * Displays recipient input, CC button, account selector, and collapse button
 */
export function FullReplyHeader({
  onCollapse,
  sendSuccess,
  sendError,
  recipientInput,
  accountSelector,
  ccButton,
}: FullReplyHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between gap-2 pt-0 w-full overflow-hidden">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {recipientInput && (
            <div className="flex-1 min-w-0">{recipientInput}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ccButton}
          {accountSelector}
          <button
            type="button"
            onClick={onCollapse}
            className="flex items-center justify-center shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
            aria-label={t("insight.collapseReply", "Collapse reply")}
          >
            <RemixIcon name="minimize_2" size="size-4" />
          </button>
        </div>
      </div>
      {sendSuccess && (
        <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          <RemixIcon name="check" size="size-3.5" />
          {t("insight.replySentBadge", "Sent")}
        </div>
      )}
      {sendError && (
        <div className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
          <RemixIcon name="error_warning" size="size-3.5" />
          {sendError}
        </div>
      )}
    </>
  );
}
