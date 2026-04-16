"use client";

import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

export interface FilePreviewDrawerRichTextToolbarProps {
  /** markdown: only show "Open with default app" for local paths; html: always allow external open (blob/Tauri) */
  format: "markdown" | "html";
  viewMode: "preview" | "code";
  onViewModeChange: (mode: "preview" | "code") => void;
  filePath?: string;
  onClose?: () => void;
  copied: boolean;
  onCopy: () => void;
  /** Refresh iframe in HTML preview mode */
  onRefreshPreview?: () => void;
  onRevealInFolder?: () => void;
  showOpenExternal: boolean;
  onOpenExternal: () => void;
  /** Description for external open button (different text for Markdown and HTML in Tauri/browser, determined by parent component) */
  openExternalTooltip: string;
}

/**
 * Right operation area in Markdown/HTML preview drawer header: shared with "My Files" and "Chat Space" with the same order and style.
 */
export function FilePreviewDrawerRichTextToolbar({
  format,
  viewMode,
  onViewModeChange,
  onClose,
  copied,
  onCopy,
  onRefreshPreview,
  onRevealInFolder,
  showOpenExternal,
  onOpenExternal,
  openExternalTooltip,
}: FilePreviewDrawerRichTextToolbarProps) {
  const { t } = useTranslation();
  const showFolder = Boolean(onRevealInFolder);
  const showRefresh =
    format === "html" &&
    viewMode === "preview" &&
    typeof onRefreshPreview === "function";

  const copyLabel =
    format === "markdown"
      ? t("common.filePreview.copyMarkdown", "Copy Markdown")
      : t("common.filePreview.copyHtml", "Copy HTML");

  return (
    <>
      <div className="bg-muted mr-2 flex items-center gap-1 rounded-lg p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onViewModeChange("preview")}
              className={cn(
                "h-7 px-2",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RemixIcon name="eye" size="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("common.filePreview.previewModePreview", "Preview")}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onViewModeChange("code")}
              className={cn(
                "h-7 px-2",
                viewMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RemixIcon name="code" size="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("common.filePreview.previewModeCode", "View Code")}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {showRefresh && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={onRefreshPreview}
              className="size-8"
            >
              <RemixIcon name="refresh" size="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("common.filePreview.refreshPreview", "Refresh preview")}</p>
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onCopy}
            className="size-8"
          >
            {copied ? (
              <RemixIcon
                name="check"
                size="size-4"
                className="text-emerald-500"
              />
            ) : (
              <RemixIcon name="file_copy" size="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            {copied
              ? t("common.filePreview.richTextCopied", "Copied!")
              : copyLabel}
          </p>
        </TooltipContent>
      </Tooltip>

      {showFolder && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={onRevealInFolder}
              className="size-8"
            >
              <RemixIcon name="folder_open" size="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("common.filePreview.showInFolder", "Show in Folder")}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {showOpenExternal && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={onOpenExternal}
              className="size-8"
            >
              <RemixIcon name="external_link" size="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{openExternalTooltip}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {onClose && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={onClose}
              className="size-8"
            >
              <RemixIcon name="close" size="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("common.close", "Close")}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
