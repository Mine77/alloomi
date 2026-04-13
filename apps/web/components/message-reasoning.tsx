"use client";

import { useState } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { motion, AnimatePresence } from "framer-motion";
import { Markdown } from "./markdown";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

/**
 * Message reasoning block: shows a loading spinner while loading, and the reasoning content can be expanded/collapsed after completion.
 * Style consistent with ToolCallAccordion and NativeToolCall: rounded borders, design tokens.
 */
export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: "auto",
      opacity: 1,
      marginTop: "0",
      marginBottom: "0",
    },
  };

  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card/50 mt-2 mb-2">
      <div className="group flex flex-row gap-1.5 items-center px-3 py-2">
        {isLoading ? (
          <>
            <span className="text-sm text-muted-foreground shrink-0">
              {t("common.reasoning")}
            </span>
            <RemixIcon
              name="loader_2"
              size="size-4"
              className="animate-spin text-muted-foreground shrink-0"
            />
          </>
        ) : (
          <>
            {/* Text and arrow are adjacent, not filling the entire row */}
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("common.reasonedSeconds")}
              </span>
              <button
                data-testid="message-reasoning-toggle"
                type="button"
                className="cursor-pointer p-0.5 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
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
                  className={cn(
                    "transition-transform",
                    !isExpanded && "-rotate-90",
                  )}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </span>
          </>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
            className="pl-2 text-muted-foreground flex flex-col gap-2 border-t border-border/60 mt-0 pt-2 pb-2 px-2"
          >
            <Markdown>{reasoning}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
