"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import { revealItemInDir, openPathCustom, openUrl } from "@/lib/tauri";
import { CodePreview } from "./artifacts/code-preview";
import ReactMarkdown from "react-markdown";
// Directly import remark-gfm to bypass Turbopack dynamic import issue
import remarkGfm from "remark-gfm";

export interface MarkdownPreviewProps {
  content: string;
  filename?: string;
  filePath?: string;
  onClose?: () => void;
  className?: string;
}

export function MarkdownPreview({
  content,
  filename = "document.md",
  filePath,
  onClose,
  className,
}: MarkdownPreviewProps) {
  const remarkPlugins = [remarkGfm];
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Markdown copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy Markdown");
    }
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

  // Handle open with default app
  const handleOpenWithDefaultApp = async () => {
    if (!filePath) return;
    try {
      await openPathCustom(filePath);
    } catch (error) {
      console.error("Failed to open file:", error);
      toast.error("Failed to open file");
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
            Markdown
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

          {/* Open with Default App */}
          {filePath && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenWithDefaultApp}
                  className="size-8"
                >
                  <RemixIcon name="external_link" size="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Open with Default App</p>
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
                  <RemixIcon name="file_copy" size="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{copied ? "Copied!" : "Copy Markdown"}</p>
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
          <div className="bg-background h-full overflow-auto p-6 text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              components={{
                // Paragraph
                p: ({ node, children, ...props }) => {
                  return (
                    <p className="mb-4 leading-relaxed" {...props}>
                      {children}
                    </p>
                  );
                },
                // Custom code block rendering
                code: ({ node, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const hasLang = match?.[1];
                  return hasLang ? (
                    <div className="relative group my-4">
                      <SyntaxHighlighter
                        language={match[1]}
                        style={
                          document.documentElement.classList.contains("dark")
                            ? vscDarkPlus
                            : vs
                        }
                        customStyle={{
                          margin: 0,
                          borderRadius: "0.5rem",
                          fontSize: "0.875rem",
                        }}
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                // Custom link rendering
                a: ({ node, children, href, ...props }: any) => {
                  return (
                    <button
                      type="button"
                      className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                      onClick={(e) => {
                        e.preventDefault();
                        if (href) {
                          openUrl(href);
                        }
                      }}
                      {...(props as React.ComponentProps<"button">)}
                    >
                      {children}
                    </button>
                  );
                },
                // Custom image rendering
                img: ({ node, src, alt, ...props }: any) => {
                  return (
                    <img
                      src={src}
                      alt={alt || ""}
                      className="rounded-lg border"
                      loading="lazy"
                    />
                  );
                },
                // Custom table rendering
                table: ({ node, children, ...props }: any) => {
                  return (
                    <div className="my-4 overflow-x-auto">
                      <table
                        className="w-full border-collapse border border-zinc-200 dark:border-zinc-700 text-sm"
                        {...props}
                      >
                        {children}
                      </table>
                    </div>
                  );
                },
                thead: ({ node, children, ...props }: any) => {
                  return (
                    <thead
                      className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700"
                      {...props}
                    >
                      {children}
                    </thead>
                  );
                },
                tbody: ({ node, children, ...props }: any) => {
                  return <tbody {...props}>{children}</tbody>;
                },
                tr: ({ node, children, ...props }: any) => {
                  return (
                    <tr
                      className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      {...props}
                    >
                      {children}
                    </tr>
                  );
                },
                th: ({ node, children, ...props }: any) => {
                  return (
                    <th
                      className="px-4 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-50"
                      {...props}
                    >
                      {children}
                    </th>
                  );
                },
                td: ({ node, children, ...props }: any) => {
                  return (
                    <td
                      className="px-4 py-2 text-zinc-700 dark:text-zinc-300"
                      {...props}
                    >
                      {children}
                    </td>
                  );
                },
                // Headings
                h1: ({ node, children, ...props }: any) => {
                  return (
                    <h1 className="text-2xl font-bold mb-4 mt-6" {...props}>
                      {children}
                    </h1>
                  );
                },
                h2: ({ node, children, ...props }: any) => {
                  return (
                    <h2 className="text-xl font-bold mb-3 mt-5" {...props}>
                      {children}
                    </h2>
                  );
                },
                h3: ({ node, children, ...props }: any) => {
                  return (
                    <h3 className="text-lg font-bold mb-3 mt-4" {...props}>
                      {children}
                    </h3>
                  );
                },
                h4: ({ node, children, ...props }: any) => {
                  return (
                    <h4 className="text-base font-bold mb-2 mt-4" {...props}>
                      {children}
                    </h4>
                  );
                },
                h5: ({ node, children, ...props }: any) => {
                  return (
                    <h5 className="text-sm font-bold mb-2 mt-4" {...props}>
                      {children}
                    </h5>
                  );
                },
                h6: ({ node, children, ...props }: any) => {
                  return (
                    <h6 className="text-sm font-bold mb-2 mt-4" {...props}>
                      {children}
                    </h6>
                  );
                },
                // Lists
                ul: ({ node, children, ...props }: any) => {
                  return (
                    <ul
                      className="list-disc list-outside ml-6 mb-4 space-y-1"
                      {...props}
                    >
                      {children}
                    </ul>
                  );
                },
                ol: ({ node, children, ...props }: any) => {
                  return (
                    <ol
                      className="list-decimal list-outside ml-6 mb-4 space-y-1"
                      {...props}
                    >
                      {children}
                    </ol>
                  );
                },
                li: ({ node, children, ...props }: any) => {
                  return (
                    <li className="my-1" {...props}>
                      {children}
                    </li>
                  );
                },
                // Emphasis and italics
                strong: ({ node, children, ...props }: any) => {
                  return (
                    <strong className="font-bold" {...props}>
                      {children}
                    </strong>
                  );
                },
                em: ({ node, children, ...props }: any) => {
                  return (
                    <em className="italic" {...props}>
                      {children}
                    </em>
                  );
                },
                // Blockquote
                blockquote: ({ node, children, ...props }: any) => {
                  return (
                    <blockquote
                      className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-4 italic text-zinc-600 dark:text-zinc-400"
                      {...props}
                    >
                      {children}
                    </blockquote>
                  );
                },
                // Horizontal rule
                hr: ({ node, ...props }: any) => {
                  return (
                    <hr
                      className="my-6 border-zinc-200 dark:border-zinc-700"
                      {...props}
                    />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="bg-muted/30 h-full overflow-auto p-4">
            <CodePreview
              code={content}
              filename={filename}
              language="markdown"
              showLineNumbers={false}
              maxHeight="100%"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Inline SyntaxHighlighter component (avoids circular dependency)
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";
