"use client";

import { memo } from "react";

interface CodeBlockProps {
  node: any;
  inline?: boolean;
  className?: string;
  children: any;
}

function CodeBlockImpl({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  if (!inline) {
    return (
      <div className="not-prose flex flex-col min-w-0">
        <pre
          {...props}
          className={
            "text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900"
          }
        >
          <code className="whitespace-pre font-mono min-w-0">{children}</code>
        </pre>
      </div>
    );
  }
  return (
    <code
      className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
      {...props}
    >
      {children}
    </code>
  );
}

// rerender-memo: use memo to avoid unnecessary re-renders
export const CodeBlock = memo(CodeBlockImpl);
