"use client";

import { RemixIcon } from "@/components/remix-icon";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getToolDisplayName } from "@/lib/utils/tool-names";

interface ToolExecutionItemProps {
  toolName: string;
  status: "running" | "completed" | "error" | "warning";
  toolInput?: any;
  toolOutput?: string;
  timestamp?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

/**
 * Tool execution item display component
 */
export function ToolExecutionItem({
  toolName,
  status,
  toolInput,
  toolOutput,
  timestamp,
  isFirst,
  isLast,
}: ToolExecutionItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return (
          <RemixIcon
            name="loader_2"
            size="size-4"
            className="animate-spin text-yellow-500"
          />
        );
      case "completed":
        return (
          <RemixIcon
            name="circle_check"
            size="size-4"
            className="text-emerald-500"
          />
        );
      case "error":
        return (
          <RemixIcon
            name="error_warning"
            size="size-4"
            className="text-red-500"
          />
        );
      case "warning":
        return (
          <RemixIcon
            name="error_warning"
            size="size-4"
            className="text-yellow-500"
          />
        );
      default:
        return null;
    }
  };

  const formatToolInput = () => {
    if (!toolInput) return null;

    // Extract tool name without prefix
    const toolNameWithoutPrefix = toolName.includes("__")
      ? toolName.split("__").pop() || toolName
      : toolName;

    if (toolNameWithoutPrefix === "Bash" && toolInput.command) {
      return (
        <div className="mt-2 px-2 py-1 bg-black text-green-400 rounded text-xs font-mono">
          <span className="text-gray-500">$</span> {toolInput.command}
        </div>
      );
    }

    if (toolNameWithoutPrefix === "WebSearch" && toolInput.query) {
      return (
        <div className="mt-2 px-2 py-1 bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 rounded text-xs">
          🔎 "{toolInput.query}"
        </div>
      );
    }

    if (
      (toolNameWithoutPrefix === "Read" || toolNameWithoutPrefix === "Edit") &&
      toolInput.file_path
    ) {
      return (
        <div className="mt-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-mono truncate">
          📁 {toolInput.file_path}
        </div>
      );
    }

    // Handle MCP tools with specific inputs
    if (
      (toolNameWithoutPrefix === "chatInsight" ||
        toolNameWithoutPrefix === "searchKnowledgeBase") &&
      toolInput.query
    ) {
      return (
        <div className="mt-2 px-2 py-1 bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 rounded text-xs">
          🔎 "{toolInput.query}"
        </div>
      );
    }

    if (toolNameWithoutPrefix === "chatInsight" && toolInput.filterDefinition) {
      return (
        <div className="mt-2 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs">
          🔍
        </div>
      );
    }

    // Default to JSON display
    try {
      const inputStr =
        typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput);
      if (inputStr && inputStr.length > 0 && inputStr.length < 200) {
        return (
          <div className="mt-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs font-mono truncate">
            {inputStr}
          </div>
        );
      }
    } catch (e) {
      // Ignore JSON serialization errors
    }

    return null;
  };

  // Detect image paths in tool output
  const imagePaths = useMemo(() => {
    if (!toolOutput || typeof toolOutput !== "string") return [];

    // Supported image extensions
    const imageExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".bmp",
      ".ico",
    ];

    // Match pattern: /path/to/file.png or file.png
    const pathRegex = /([^\s]+\.(png|jpg|jpeg|gif|svg|webp|bmp|ico))/gi;
    const matches = toolOutput.match(pathRegex) || [];

    return matches.filter((path) => {
      const ext = path.toLowerCase().slice(path.lastIndexOf("."));
      return imageExtensions.includes(ext);
    });
  }, [toolOutput]);

  const formatToolOutput = () => {
    if (!toolOutput || typeof toolOutput !== "string") return null;

    // Limit output length
    const maxLength = 500;
    const displayOutput =
      toolOutput.length > maxLength
        ? `${toolOutput.substring(0, maxLength)}...`
        : toolOutput;

    return (
      <div className="mt-2 space-y-2">
        {/* Text output */}
        <div className="p-2 bg-white/50 dark:bg-black/20 rounded text-xs font-mono max-h-32 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-all">{displayOutput}</pre>
        </div>

        {/* Image preview */}
        {imagePaths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <RemixIcon name="file_image" size="size-3" />
              <span>{imagePaths.length} images</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {imagePaths.map((imagePath) => (
                <div
                  key={imagePath}
                  className="relative group rounded-md overflow-hidden border border-border/50 bg-muted/30"
                >
                  <img
                    src={
                      imagePath.startsWith("http")
                        ? imagePath
                        : `file://${imagePath}`
                    }
                    alt={imagePath}
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      // If image fails to load, show placeholder
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-[10px] text-white truncate font-mono">
                      {imagePath.split("/").pop()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasDetails = toolInput || toolOutput;

  return (
    <div className="relative">
      {/* Connector line */}
      {!isFirst && (
        <div className="absolute left-[7px] -top-3 h-3 w-px bg-border" />
      )}

      <div className={cn("flex items-start gap-2 py-2", isLast && "pb-0")}>
        {/* Status icon */}
        <div className="flex shrink-0 mt-0.5">{getStatusIcon()}</div>

        {/* Tool info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {getToolDisplayName(toolName, t)}
            </span>
            {hasDetails && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <RemixIcon name="chevron_up" size="size-3" />
                ) : (
                  <RemixIcon name="chevron_down" size="size-3" />
                )}
              </button>
            )}
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-2 space-y-2">
              {formatToolInput()}
              {formatToolOutput()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
