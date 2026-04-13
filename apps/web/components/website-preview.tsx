"use client";

import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import { openUrl, openPathCustom, revealItemInDir, isTauri } from "@/lib/tauri";
import { inlineResources } from "@alloomi/shared/inline-resources";

// Bundle optimization: Dynamically import CodePreview
const CodePreview = lazy(() =>
  import("./artifacts/code-preview").then((mod) => ({
    default: mod.CodePreview,
  })),
);

export interface WebsitePreviewProps {
  content: string;
  filename?: string;
  filePath?: string;
  onClose?: () => void;
  className?: string;
}

export function WebsitePreview({
  content,
  filename = "index.html",
  filePath,
  onClose,
  className,
}: WebsitePreviewProps) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [inlineContent, setInlineContent] = useState<string>(content);
  const [isInlining, setIsInlining] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inline CSS and JS resources when content or filePath changes
  useEffect(() => {
    const processContent = async () => {
      // If content has no external resources (no <link href="*.css"> or <script src="*.js">), use as-is
      const hasExternalCss =
        /<link\s+[^>]*href=["'][^"']+\.css["'][^>]*>/i.test(content);
      const hasExternalJs = /<script\s+src=["'][^"']+\.js["'][^>]*>/i.test(
        content,
      );

      if ((!hasExternalCss && !hasExternalJs) || !filePath) {
        setInlineContent(content);
        return;
      }

      setIsInlining(true);
      try {
        let fileDir = "";
        let taskId = "";

        // Extract fileDir from filePath
        const lastSlashIndex = filePath.lastIndexOf("/");
        fileDir = filePath.substring(0, lastSlashIndex);

        // Extract taskId from path if available
        const sessionMatch = filePath.match(/\/\.alloomi\/sessions\/([^\/]+)/);
        if (sessionMatch) {
          taskId = sessionMatch[1];
        }

        const processed = await inlineResources(content, fileDir, taskId);
        setInlineContent(processed);
      } catch (error) {
        console.error("[WebsitePreview] Failed to inline resources:", error);
        setInlineContent(content);
      } finally {
        setIsInlining(false);
      }
    };

    processContent();
  }, [content, filePath]);

  // Use srcdoc instead of blob URL to avoid CSP restrictions in dev mode
  // (Vite dev server CSP blocks blob: in frame-src)
  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inlineContent);
      setCopied(true);
      toast.success("HTML copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy HTML");
    }
  };

  // Handle open in new tab
  const handleOpenExternal = async () => {
    try {
      // In Tauri environment with local file path, open local file with system command
      if (isTauri() && filePath) {
        const success = await openPathCustom(filePath);
        if (!success) {
          toast.error("Failed to open file");
        }
        return;
      }

      // In browser environment or without local path, use blob URL
      const blob = new Blob([inlineContent], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);

      await openUrl(blobUrl);
    } catch (error) {
      console.error("Failed to open external:", error);
      toast.error("Failed to open in new tab");
    }
  };

  // Handle refresh iframe
  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  // Handle show in folder
  const handleShowInFolder = async () => {
    if (!filePath) return;
    try {
      await revealItemInDir(filePath);
    } catch (error) {
      console.error("Failed to show in folder:", error);
      toast.error("Failed to show in folder");
    }
  };

  return (
    <div
      className={cn("bg-background flex h-full flex-col z-[1000]", className)}
    >
      {/* Header */}
      <div className="border-border/50 bg-muted/30 flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {filename}
          </span>
          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
            HTML
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* View Mode Toggle */}
          <div className="bg-muted mr-2 flex items-center gap-1 rounded-lg p-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("preview")}
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
                <p>Preview</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("code")}
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
                <p>View Code</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Refresh Preview */}
          {viewMode === "preview" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  className="size-8"
                >
                  <RemixIcon name="refresh" size="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Refresh Preview</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Copy */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="size-8"
              >
                {copied ? (
                  <RemixIcon
                    name="check"
                    size="size-4"
                    className="text-emerald-500"
                  />
                ) : (
                  <RemixIcon name="copy" size="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{copied ? "Copied!" : "Copy HTML"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Show in Folder */}
          {filePath && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShowInFolder}
                  className="size-8"
                >
                  <RemixIcon name="folder_open" size="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Show in Folder</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Open External */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenExternal}
                className="size-8"
              >
                <RemixIcon name="external_link" size="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Open in New Tab</p>
            </TooltipContent>
          </Tooltip>

          {/* Close */}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="size-8"
                >
                  <RemixIcon name="close" size="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Close</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "preview" ? (
          isInlining ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <RemixIcon
                  name="loader_2"
                  size="size-5"
                  className="animate-spin text-muted-foreground"
                />
                <p className="text-muted-foreground text-sm">
                  Inlining resources...
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white">
              <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={inlineContent}
                className="size-full border-0"
                title={filename}
              />
            </div>
          )
        ) : (
          <div className="bg-muted/30 h-full overflow-auto p-4">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <RemixIcon
                    name="loader_2"
                    size="size-5"
                    className="animate-spin"
                  />
                </div>
              }
            >
              <CodePreview
                code={inlineContent}
                filename={filename}
                language="html"
                maxHeight="100%"
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
