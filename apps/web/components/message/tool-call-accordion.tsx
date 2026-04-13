"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getToolDisplayName } from "@/lib/utils/tool-names";
import {
  isQueryIntegrationTool,
  hasNoBotsInResponse,
} from "@/lib/utils/integration-error-detector";

export interface ToolCallPart {
  key: string;
  toolName: string;
  status?: string;
  toolOutput?: any;
  generatedFile?: {
    path: string;
    name: string;
    type: string;
  };
  codeFile?: {
    path: string;
    name: string;
    language: string;
  };
  toolInput?: any;
  isExecuting?: boolean;
}

/** Options used by renderToolCall: marks sub-items when multiple tools are expanded, used to remove the outer border of sub-items */
export type ToolCallRenderOptions = {
  embeddedInAccordion?: boolean;
  hasConnectedAccounts?: boolean;
};

interface ToolCallAccordionProps {
  parts: ToolCallPart[];
  renderToolCall: (
    part: ToolCallPart,
    options?: ToolCallRenderOptions,
  ) => React.ReactNode;
  isExecuting?: boolean;
  /** Whether the user has any connected integration accounts */
  hasConnectedAccounts?: boolean;
}

/**
 * Groups consecutive tool-native parts into a collapsible accordion.
 * MiniMax style: no borders, minimal spacing, clean text-only display.
 */
export function ToolCallAccordion({
  parts,
  renderToolCall,
  isExecuting: externalIsExecuting,
  hasConnectedAccounts = true,
}: ToolCallAccordionProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (parts.length === 0) return null;

  const executingCount = parts.filter((p) => p.status === "executing").length;

  // Prefer external isExecuting state (based on text content), otherwise use internal state
  // Show executing state when expanding/collapsing
  const isExecuting = externalIsExecuting ?? executingCount > 0;

  // Check if any part in the accordion needs a Connect Account button
  let connectButtonPlatform: string | null = null;
  for (const part of parts) {
    if (
      isQueryIntegrationTool(part.toolName) &&
      hasNoBotsInResponse(part.toolOutput)
    ) {
      connectButtonPlatform =
        typeof part.toolInput === "object" && part.toolInput !== null
          ? ((part.toolInput as Record<string, unknown>).platform as string)
          : null;
      break; // Found it, stop
    }
  }

  /** "Connect Account" button rendered after all tool calls */
  const connectButton =
    connectButtonPlatform !== null ? (
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("alloomi:request-integration", {
                detail: { platform: connectButtonPlatform },
              }),
            );
          }}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22v-5" />
            <path d="M9 8V2" />
            <path d="M15 8V2" />
            <path d="M18 8H6a2 2 0 0 0-2 2v3a6 6 0 0 0 12 0v-3a2 2 0 0 0-2-2Z" />
          </svg>
          {t("common.nativeToolCall.connectAccount", "Connect Account")}
        </button>
      </div>
    ) : null;

  // Single tool call - no wrapper needed; NativeToolCall has its own rounded border
  if (parts.length === 1) {
    const result = renderToolCall(
      { ...parts[0], isExecuting },
      { hasConnectedAccounts },
    );
    return (
      <>
        {result}
        {connectButton}
      </>
    );
  }

  // Get the name of the tool currently executing
  const executingPart =
    isExecuting && parts.length > 0 ? parts[parts.length - 1] : null;

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "group flex items-center gap-1.5 w-full text-left transition-colors px-3 py-2 rounded-md",
          "text-sm text-muted-foreground hover:text-foreground",
        )}
        aria-expanded={isExpanded}
      >
        <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" x2="20" y1="19" y2="19" />
          </svg>
        </span>

        {/* Text and arrow next to each other, not filling the full width */}
        <span className="flex items-center gap-1.5 shrink-0 min-w-0">
          <span
            className={cn(
              "text-sm min-w-0 truncate",
              !isExecuting &&
                "text-muted-foreground group-hover:text-foreground transition-colors",
            )}
            style={
              isExecuting
                ? {
                    background:
                      "linear-gradient(90deg, #9ca3af 0%, #d1d5db 50%, #9ca3af 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 3s linear infinite",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }
                : undefined
            }
          >
            {isExecuting && executingPart
              ? `${t("common.nativeToolCall.executing", "Executing")} ${getToolDisplayName(executingPart.toolName, t)}`
              : `${parts.length} ${t("common.nativeToolCall.toolCallsCount", "tool calls completed")}`}
          </span>
          <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "transition-transform",
                !isExpanded && "-rotate-90",
              )}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </span>
      </button>

      {/* Expanded Tool Calls - expanded content below */}
      {isExpanded && (
        <div className="border-t border-border/60 pt-2 pb-2 px-2 mt-0 space-y-2">
          {parts.map((part, index) => {
            const isLastTool = index === parts.length - 1;
            return (
              <div key={part.key} className="relative">
                <div>
                  {renderToolCall(
                    {
                      ...part,
                      isExecuting: isLastTool ? isExecuting : false,
                    },
                    { embeddedInAccordion: true, hasConnectedAccounts },
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Account button rendered after all tool calls, outside the collapsible area */}
      {connectButton}
    </div>
  );
}
