"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import * as JSZipModule from "jszip";

/** JSZip module type (export = JSZip, has both constructor and static methods like loadAsync) */
type JSZipType = import("jszip");
const JSZip = ((JSZipModule as { default?: JSZipType }).default ??
  JSZipModule) as JSZipType;
import { RemixIcon } from "@/components/remix-icon";
import { useTranslation } from "react-i18next";

interface DocxParagraph {
  text: string;
  style?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isHeading?: boolean;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  alignment?: "left" | "center" | "right" | "justify";
  listLevel?: number;
}

interface DocxPreviewProps {
  artifact: {
    path: string;
    name: string;
  };
}

const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * DOCX preview component
 *
 * Uses JSZip to parse DOCX files (DOCX is a ZIP format)
 * Extracts word/document.xml content and parses paragraphs and styles
 */
export function DocxPreview({ artifact }: DocxPreviewProps) {
  const { t } = useTranslation();
  const [paragraphs, setParagraphs] = useState<DocxParagraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const paragraphsPerPage = 50; // Number of paragraphs per page

  const handleOpenExternal = async () => {
    if (!artifact.path) return;

    // Check if running in Tauri environment
    const isTauri = !!(window as any).__TAURI__;

    if (!isTauri) {
      // Web environment: show message
      console.warn(
        "[DocxPreview] Opening files externally is only supported in desktop app",
      );
      return;
    }

    try {
      const { openPathCustom } = await import("@/lib/tauri");
      await openPathCustom(artifact.path);
    } catch (err) {
      console.error("[DocxPreview] Failed to open file:", err);
    }
  };

  const handleShowInFolder = async () => {
    if (!artifact.path) return;
    const isTauri = !!(window as any).__TAURI__;
    if (!isTauri) return;
    try {
      const { revealItemInDir } = await import("@/lib/tauri");
      await revealItemInDir(artifact.path);
    } catch (err) {
      console.error("[DocxPreview] Failed to show in folder:", err);
    }
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    async function loadDocx() {
      if (!artifact.path) {
        setError(
          t("common.docxPreview.noPathAvailable", "No file path available"),
        );
        setLoading(false);
        return;
      }

      console.log("[DocxPreview] Loading DOCX from path:", artifact.path);

      // Set timeout - prevent long loading
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          console.error("[DocxPreview] Loading timeout");
          setError(t("common.docxPreview.loadTimeout", "Loading timeout"));
          setLoading(false);
        }
      }, 30000); // 30 second timeout

      try {
        // Only use custom commands in Tauri desktop environment
        const { readFileBinary, fileStat } = await import("@/lib/tauri");

        // Check file size first
        const fileInfo = await fileStat(artifact.path);
        if (!fileInfo) {
          setError("Failed to get file information");
          setLoading(false);
          return;
        }
        if (fileInfo.size > MAX_PREVIEW_SIZE) {
          console.log("[DocxPreview] File too large:", fileInfo.size);
          setFileTooLarge(fileInfo.size);
          setLoading(false);
          return;
        }

        // Read file using Tauri custom command
        const data = await readFileBinary(artifact.path);
        if (!data) {
          setError("Failed to read file");
          setLoading(false);
          return;
        }

        const rawDataInfo = {
          dataType: data.constructor.name,
          byteLength: data.byteLength,
          bufferByteLength: data.buffer.byteLength,
          byteOffset: data.byteOffset,
          firstBytes: Array.from(data.slice(0, 8))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" "),
          lastBytes: Array.from(data.slice(-8))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" "),
        };
        console.log(
          "[DocxPreview] Raw data info:",
          JSON.stringify(rawDataInfo, null, 2),
        );

        // Create a proper Uint8Array slice with correct offset and length
        const sourceArray = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );
        const arrayBuffer = sourceArray.buffer.slice(
          sourceArray.byteOffset,
          sourceArray.byteOffset + sourceArray.byteLength,
        ) as ArrayBuffer;

        const processedInfo = {
          byteLength: arrayBuffer.byteLength,
          firstBytes: Array.from(new Uint8Array(arrayBuffer.slice(0, 8)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" "),
          lastBytes: Array.from(new Uint8Array(arrayBuffer.slice(-8)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" "),
        };
        console.log(
          "[DocxPreview] Processed ArrayBuffer:",
          JSON.stringify(processedInfo, null, 2),
        );

        if (isCancelled) {
          console.log("[DocxPreview] Loading was cancelled");
          return;
        }

        // Check if this is a valid ZIP/DOCX file (should start with PK header: 50 4b)
        const headerView = new Uint8Array(arrayBuffer.slice(0, 4));
        const isZipFile = headerView[0] === 0x50 && headerView[1] === 0x4b; // "PK" signature

        if (!isZipFile) {
          console.warn(
            "[DocxPreview] Not a valid ZIP/DOCX file, treating as text",
          );
          // Not a ZIP file - likely a text file with .docx extension
          // Try to display it as plain text
          const decoder = new TextDecoder("utf-8", { fatal: false });
          try {
            const textContent = decoder.decode(arrayBuffer);
            // Display as plain text paragraphs
            const lines = textContent.split(/\n\n+/);
            const textParagraphs: DocxParagraph[] = lines
              .filter((line) => line.trim())
              .map((line) => ({
                text: line.trim(),
              }));
            setParagraphs(textParagraphs);
            setError(null);
            setLoading(false);
            return;
          } catch (decodeErr) {
            console.error("[DocxPreview] Failed to decode as text:", decodeErr);
            throw new Error(
              "Invalid DOCX file: file is not in valid ZIP or text format",
            );
          }
        }

        // Parse DOCX using JSZip
        const zip = await JSZip.loadAsync(arrayBuffer, {
          checkCRC32: false,
        });

        // Extract document.xml
        const documentXml = await zip
          .file("word/document.xml")
          ?.async("string");

        if (!documentXml) {
          throw new Error("Invalid DOCX: missing word/document.xml");
        }

        // Parse XML
        const parser = new DOMParser();
        const doc = parser.parseFromString(documentXml, "text/xml");

        // Parse paragraphs
        const parsedParagraphs: DocxParagraph[] = [];
        const pElements = doc.querySelectorAll("w\\:p, p");

        pElements.forEach((pEl) => {
          // Extract style
          const pStyle = pEl.querySelector("w\\:pStyle, pStyle");
          const styleName = pStyle?.getAttribute("w\\:val") || "";

          // Check if heading
          const isHeading =
            styleName.toLowerCase().includes("heading") ||
            styleName.toLowerCase().includes("title") ||
            styleName.toLowerCase().startsWith("heading");

          let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | undefined = undefined;
          if (isHeading) {
            const headingMatch = styleName.match(/heading(\d)/);
            if (headingMatch) {
              headingLevel = Number.parseInt(headingMatch[1]) as
                | 1
                | 2
                | 3
                | 4
                | 5
                | 6;
            } else if (styleName.toLowerCase().includes("title")) {
              headingLevel = 1;
            } else {
              headingLevel = 2;
            }
          }

          // Extract alignment
          const jc = pEl.querySelector("w\\:jc, jc");
          const jcVal = jc?.getAttribute("w\\:val");
          const alignment: "left" | "center" | "right" | "justify" =
            jcVal === "both"
              ? "justify"
              : jcVal === "center"
                ? "center"
                : jcVal === "right"
                  ? "right"
                  : "left";

          // Check if list item
          const numPr = pEl.querySelector("w\\:numPr, numPr");
          const ilvl = numPr
            ?.querySelector("w\\:ilvl, ilvl")
            ?.getAttribute("w\\:val");
          const listLevel = ilvl ? Number.parseInt(ilvl) + 1 : undefined;

          // Extract text runs
          const rElements = pEl.querySelectorAll("w\\:r, r");
          let paragraphText = "";
          let isBold = false;
          let isItalic = false;
          let isUnderline = false;

          rElements.forEach((rEl) => {
            // Extract text
            const tElements = rEl.querySelectorAll("w\\:t, t");
            tElements.forEach((tEl) => {
              paragraphText += tEl.textContent || "";
            });

            // Check formatting
            const rPr = rEl.querySelector("w\\:rPr, rPr");
            if (rPr) {
              isBold = isBold || !!rPr.querySelector("w\\:b, b");
              isItalic = isItalic || !!rPr.querySelector("w\\:i, i");
              isUnderline = isUnderline || !!rPr.querySelector("w\\:u, u");
            }
          });

          if (paragraphText.trim()) {
            parsedParagraphs.push({
              text: paragraphText.trim(),
              style: styleName || undefined,
              isBold,
              isItalic,
              isUnderline,
              isHeading,
              headingLevel,
              alignment,
              listLevel,
            });
          }
        });

        console.log(
          "[DocxPreview] Parsed",
          parsedParagraphs.length,
          "paragraphs",
        );
        setParagraphs(parsedParagraphs);
        setError(null);
      } catch (err) {
        console.error("[DocxPreview] Failed to load DOCX:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setLoading(false);
      }
    }

    loadDocx();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [artifact.path]);

  // Pagination
  const totalPages = Math.ceil(paragraphs.length / paragraphsPerPage);
  const currentParagraphs = paragraphs.slice(
    currentPage * paragraphsPerPage,
    (currentPage + 1) * paragraphsPerPage,
  );

  const goToPrev = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const goToNext = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  if (loading) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <RemixIcon
          name="loader_2"
          size="size-8"
          className="text-muted-foreground animate-spin"
        />
        <p className="text-muted-foreground mt-4 text-sm">
          {t("common.docxPreview.loading", "Loading document...")}
        </p>
      </div>
    );
  }

  if (fileTooLarge !== null) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <RemixIcon
              name="file_text"
              size="size-10"
              className="text-blue-500"
            />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("common.docxPreview.fileTooLargeDesc", {
              size: (fileTooLarge / 1024 / 1024).toFixed(1),
              defaultValue:
                "This file ({{size}}MB) is too large to preview. Please open it in Microsoft Word.",
            })}
          </p>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RemixIcon name="external_link" size="size-4" />
            {t("common.docxPreview.openInWord", "Open in Word")}
          </button>
        </div>
      </div>
    );
  }

  if (error || paragraphs.length === 0) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <RemixIcon
              name="file_text"
              size="size-10"
              className="text-blue-500"
            />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm break-all whitespace-pre-wrap">
            {error ||
              t("common.docxPreview.noContent", "No document content found")}
          </p>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RemixIcon name="external_link" size="size-4" />
            {t("common.docxPreview.openInWord", "Open in Word")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Document content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl">
          {currentParagraphs.map((para, idx) => {
            const globalIdx = currentPage * paragraphsPerPage + idx;

            // Render list item
            if (para.listLevel) {
              return (
                <div
                  key={`${globalIdx}-${para.text}`}
                  className={cn(
                    "mb-2 text-base leading-relaxed",
                    para.isBold && "font-semibold",
                    para.isItalic && "italic",
                    para.isUnderline && "underline",
                  )}
                  style={{ marginLeft: `${(para.listLevel - 1) * 24}px` }}
                >
                  <span className="text-foreground/80 mr-2">•</span>
                  {para.text}
                </div>
              );
            }

            // Render heading
            if (para.isHeading || para.style?.toLowerCase().includes("title")) {
              const level = para.headingLevel || 2;
              const headingClasses = cn(
                "text-foreground font-bold mb-4 mt-6",
                level === 1 && "text-3xl",
                level === 2 && "text-2xl",
                level === 3 && "text-xl",
                level > 3 && "text-lg",
              );

              const HeadingTag = `h${level}` as
                | "h1"
                | "h2"
                | "h3"
                | "h4"
                | "h5"
                | "h6";

              return (
                <HeadingTag
                  key={`${globalIdx}-${para.text}`}
                  className={headingClasses}
                >
                  {para.text}
                </HeadingTag>
              );
            }

            // Render normal paragraph
            return (
              <p
                key={`${globalIdx}-${para.text}`}
                className={cn(
                  "mb-4 text-base leading-relaxed",
                  para.alignment === "center" && "text-center",
                  para.alignment === "right" && "text-right",
                  para.alignment === "justify" && "text-justify",
                  para.isBold && "font-semibold",
                  para.isItalic && "italic",
                  para.isUnderline && "underline",
                )}
              >
                {para.text}
              </p>
            );
          })}
        </div>
      </div>

      {/* Footer with pagination and actions */}
      <div className="border-border bg-muted/30 shrink-0 border-t px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPrev}
                disabled={currentPage === 0}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  "bg-background hover:bg-muted",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                <RemixIcon name="chevron_left" size="size-4" />
              </button>
              <span className="text-muted-foreground text-xs">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={goToNext}
                disabled={currentPage >= totalPages - 1}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  "bg-background hover:bg-muted",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                <RemixIcon name="chevron_right" size="size-4" />
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="text-muted-foreground text-xs">
            {paragraphs.length}{" "}
            {t("common.docxPreview.paragraphs", "paragraphs")}
          </div>

          {/* Open in Word button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShowInFolder}
              className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <RemixIcon name="folder_open" size="size-3.5" />
              {t("common.preview.showInFolder", "Show in Folder")}
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <RemixIcon name="external_link" size="size-3.5" />
              {t("common.docxPreview.openInWord", "Open in Word")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
