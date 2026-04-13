"use client";

import { useEffect, useRef, useState } from "react";

interface ShadowHtmlRendererProps {
  html: string;
  className?: string;
}

export function ShadowHtmlRenderer({
  html,
  className,
}: ShadowHtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Gmail-like base styles
    const baseStyles = `
      body {
        margin: 0;
        padding: 0;
        font-family: "Noto Sans SC", "PingFang SC", "Helvetica Neue", -apple-system, BlinkMacSystemFont, sans-serif;
        color: #222;
        line-height: 1.5;
        word-break: break-word;
        background: transparent; /* Transparent background */
        -webkit-font-smoothing: antialiased;
      }
      .email-body {
        width: 100%;
        max-width: 100%;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      .email-body a {
        color: #15c;
        text-decoration: none;
      }
      .email-body a:hover {
        text-decoration: underline;
      }
      .email-body img {
        max-width: 100%;
        height: auto;
        border: 0;
        vertical-align: middle;
      }
      .email-body table {
        border-collapse: collapse;
        border-spacing: 0;
        max-width: 100%;
      }
      .email-body td,
      .email-body th {
        padding: 0;
        vertical-align: top;
      }
      .email-body p {
        margin: 0 0 1em 0;
      }
      .email-body blockquote {
        margin: 0;
        padding-left: 1em;
        border-left: 1px solid #ccc;
        color: #555;
      }
      /* Scrollbar styling for webkit */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #dadce0;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #bdc1c6;
      }
    `;

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>${baseStyles}</style>
        </head>
        <body>
          <div class="email-body">${html}</div>
          <script>
            // Auto-resize logic
            (function() {
              // Check if already initialized
              if (window.__shadowHtmlRendererInitialized) return;
              window.__shadowHtmlRendererInitialized = true;

              function resize() {
                const height = document.body.scrollHeight;
                window.parent.postMessage({ type: 'resize', height: height }, '*');
              }
              window.addEventListener('load', resize);
              window.addEventListener('resize', resize);
              // Observe DOM changes
              const observer = new MutationObserver(resize);
              observer.observe(document.body, { childList: true, subtree: true, attributes: true });
              // Initial resize
              resize();
            })();
          </script>
        </body>
      </html>
    `;

    doc.open();
    doc.write(htmlDoc);
    doc.close();

    const links = doc.querySelectorAll("a");
    links.forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  }, [html]);

  // Listen for resize messages sent from inside the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "resize" &&
        typeof event.data.height === "number"
      ) {
        setIframeHeight(event.data.height);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      className={className}
      sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
      title="Email content"
      style={{
        width: "100%",
        border: "none",
        background: "transparent",
        height: iframeHeight === "auto" ? "auto" : `${iframeHeight}px`,
        minHeight: "auto",
        display: "block",
      }}
    />
  );
}
