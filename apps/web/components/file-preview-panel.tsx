"use client";

import { useState, useEffect } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { ErrorBoundary } from "./error-boundary";
import { useTranslation } from "react-i18next";
import { IMAGE_FILE_EXTENSIONS } from "@/lib/utils/file-icons";
import { revealItemInDir, openPathCustom } from "@/lib/tauri";
import {
  isAppleDocumentFile,
  extractApplePreviewPdf,
} from "@/lib/files/apple-preview";

// Helper function: converts Uint8Array to Base64 string (performance optimized)
function uint8ToBase64(uint8Array: Uint8Array): string {
  const len = uint8Array.byteLength;
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow

  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    binary += String.fromCharCode.apply(
      null,
      Array.from(uint8Array.slice(i, end)),
    );
  }

  return btoa(binary);
}

interface FilePreviewPanelProps {
  file: {
    path: string;
    name: string;
    type: string;
  } | null;
  /** Pass taskId for workspace files, fetched via API (non-Tauri environment) */
  taskId?: string;
  onClose: () => void;
}

const MAX_PREVIEW_SIZE = 100 * 1024 * 1024;

/**
 * File preview panel - displays file content in the right sidebar
 *
 * Supports previewing multiple file types:
 * - PPTX presentations (full slide preview)
 * - PDF documents (full rendering preview)
 * - Excel spreadsheets (multi-sheet preview)
 * - Code files (syntax highlighted)
 * - Other file types (show hints)
 */
export function FilePreviewPanel({
  file,
  taskId,
  onClose,
}: FilePreviewPanelProps) {
  const { t } = useTranslation();

  // Use dynamic imports to avoid circular imports
  const [PptxPreview, setPptxPreview] = useState<any>(null);
  const [DocxPreviewComp, setDocxPreviewComp] = useState<any>(null);
  const [CodePreviewComp, setCodePreviewComp] = useState<any>(null);
  const [ExcelPreviewComp, setExcelPreviewComp] = useState<any>(null);
  const [PdfPreviewComp, setPdfPreviewComp] = useState<any>(null);
  const [WebsitePreviewComp, setWebsitePreviewComp] = useState<any>(null);
  const [MarkdownPreviewComp, setMarkdownPreviewComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [pdfContent, setPdfContent] = useState<Uint8Array | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState<number | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fullArtifactPath, setFullArtifactPath] = useState<string | null>(null);

  // Clean file type: remove whitespace (including newlines)
  const cleanType = file?.type?.trim() || "";

  // Use shared image extension constants (without dot)
  const imageFileTypes = IMAGE_FILE_EXTENSIONS.map((ext) => ext.slice(1));

  // Dynamic import preview components
  useEffect(() => {
    Promise.all([
      import("./artifacts/pptx-preview"),
      import("./artifacts/docx-preview"),
      import("./artifacts/code-preview"),
      import("./artifacts/excel-preview"),
      import("./artifacts/pdf-preview"),
      import("./website-preview"),
      import("./markdown-preview"),
    ])
      .then(
        ([
          pptxModule,
          docxModule,
          codeModule,
          excelModule,
          pdfModule,
          websiteModule,
          markdownModule,
        ]) => {
          setPptxPreview(() => pptxModule.PptxPreview);
          setDocxPreviewComp(() => docxModule.DocxPreview);
          setCodePreviewComp(() => codeModule.CodePreview);
          setExcelPreviewComp(() => excelModule.ExcelPreview);
          setPdfPreviewComp(() => pdfModule.PdfPreview);
          setWebsitePreviewComp(() => websiteModule.WebsitePreview);
          setMarkdownPreviewComp(() => markdownModule.MarkdownPreview);
          setLoading(false);
        },
      )
      .catch((err) => {
        console.error(
          "[FilePreviewPanel] Failed to load preview components:",
          err,
        );
        setError(t("common.filePreview.componentLoadFailed"));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!file || loading) return;

    const codeFileTypes = [
      "py",
      "js",
      "ts",
      "tsx",
      "jsx",
      "css",
      "json",
      "txt",
      "sh",
      "bash",
    ];
    const isCodeFile = codeFileTypes.includes(cleanType);
    const isHtmlFile = cleanType === "html" || cleanType === "htm";
    const isMarkdownFile = cleanType === "md" || cleanType === "markdown";
    const isPdfFile = cleanType === "pdf";
    const isImageFile = imageFileTypes.includes(cleanType);
    const isAppleFile = isAppleDocumentFile(cleanType);

    if (
      !isCodeFile &&
      !isHtmlFile &&
      !isMarkdownFile &&
      !isPdfFile &&
      !isImageFile &&
      !isAppleFile
    )
      return;

    const readFileContent = async () => {
      try {
        // If taskId exists, fetch workspace file content via API (applicable to library page, etc.)
        if (taskId && file.path) {
          // For image and PDF files, need to fetch binary data
          if (isPdfFile || isImageFile || isAppleFile) {
            const mimeType = isImageFile
              ? `image/${cleanType === "jpg" ? "jpeg" : cleanType}`
              : "application/octet-stream";
            const res = await fetch(
              `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(file.path)}?binary=true`,
              {
                headers: {
                  Accept: mimeType,
                },
              },
            );
            if (!res.ok) {
              setError(
                t("common.filePreview.loadFailed") || "Failed to load file",
              );
              return;
            }
            const arrayBuffer = await res.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            if (isPdfFile) {
              setPdfContent(uint8Array);
            } else if (isImageFile) {
              const dataUrl = `data:${mimeType};base64,${uint8ToBase64(uint8Array)}`;
              setImageDataUrl(dataUrl);
            } else if (isAppleFile) {
              // Apple file: extract iCloud preview PDF
              const pdfData = await extractApplePreviewPdf(arrayBuffer);
              if (pdfData) {
                setPdfContent(pdfData);
              } else {
                setError(
                  t("common.filePreview.previewNotAvailable") ||
                    "No preview available for this Apple document",
                );
              }
            }
            return;
          }

          // For code/text files, fetch JSON format content
          const res = await fetch(
            `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(file.path)}`,
          );
          if (!res.ok) {
            setError(
              t("common.filePreview.loadFailed") || "Failed to load file",
            );
            return;
          }
          const data = await res.json();
          const content = data.content as string | undefined;
          if (content == null) {
            setError(t("common.filePreview.loadFailed") || "No content");
            return;
          }
          setCodeContent(content);
          return;
        }

        // Check if in Tauri environment
        const isTauri = !!(window as any).__TAURI__;

        if (!isTauri) {
          setError(t("common.filePreview.tauriOnly"));
          return;
        }

        const { readFileBinary, fileStat } = await import("@/lib/tauri");

        // Parse file path: prefer resolved fullArtifactPath, otherwise try to expand ~
        let filePath = fullArtifactPath || file.path;
        const originalPath = file.path;

        // Clean path: remove trailing whitespace, parentheses, quotes, etc.
        filePath = filePath.trim().replace(/[()\s"'\]]+$/g, "");

        // If path starts with ~ and not resolved, try to expand
        if (filePath.startsWith("~/") && !fullArtifactPath) {
          try {
            const { homeDirCustom } = await import("@/lib/tauri");
            const homePath = await homeDirCustom();
            if (homePath) {
              filePath = filePath.replace(/^~/, homePath);
            }
          } catch (pathErr) {
            console.error(
              "[FilePreviewPanel] Failed to expand ~ path:",
              pathErr,
            );
          }
        }

        // Verify path is absolute
        if (!filePath.startsWith("/")) {
          console.warn(
            "[FilePreviewPanel] Relative path detected, this should have been resolved before",
            filePath,
          );
        }

        const fileInfo = await fileStat(filePath);
        if (!fileInfo) {
          setError("Failed to get file info");
          return;
        }
        if (fileInfo.size > MAX_PREVIEW_SIZE) {
          setFileTooLarge(fileInfo.size);
          return;
        }

        const data = await readFileBinary(filePath);
        if (!data) {
          setError("Failed to get file content");
          return;
        }

        if (isPdfFile) {
          // PDF file: create completely independent Uint8Array copy
          // Use Array.from to create completely independent copy, avoid sharing underlying buffer
          const sourceArray = new Uint8Array(
            data.buffer,
            data.byteOffset,
            data.byteLength,
          );
          const uint8Array = new Uint8Array(sourceArray.length);
          for (let i = 0; i < sourceArray.length; i++) {
            uint8Array[i] = sourceArray[i];
          }
          setPdfContent(uint8Array);
        } else if (isImageFile) {
          // Image file: convert to Data URL
          const uint8Array = new Uint8Array(
            data.buffer,
            data.byteOffset,
            data.byteLength,
          );
          const mimeType = `image/${cleanType === "jpg" ? "jpeg" : cleanType}`;
          const dataUrl = `data:${mimeType};base64,${uint8ToBase64(uint8Array)}`;
          setImageDataUrl(dataUrl);
        } else if (isAppleFile) {
          // Apple file: extract iCloud preview PDF
          const arrayBuffer = data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
          );
          const pdfData = await extractApplePreviewPdf(arrayBuffer);
          if (pdfData) {
            setPdfContent(pdfData);
          } else {
            setError(
              t("common.filePreview.previewNotAvailable") ||
                "No preview available for this Apple document",
            );
          }
        } else {
          // Code file: decode to text
          const decoder = new TextDecoder("utf-8");
          const textContent = decoder.decode(data);
          setCodeContent(textContent);
        }
      } catch (err) {
        console.error("[FilePreviewPanel] Failed to read file:", {
          error: err,
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          path: file.path,
          type: cleanType,
        });
        setError(
          `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    readFileContent();
  }, [file, taskId, loading]);

  // Calculate absolute path needed in Tauri environment (for Excel/PPTX/DOCX components)
  useEffect(() => {
    const resolveFullPath = async () => {
      if (!file) {
        setFullArtifactPath(null);
        return;
      }

      // If taskId already exists, construct full path for Tauri use
      if (taskId && file.path) {
        // Construct: ~/.alloomi/sessions/{taskId}/{relativePath}
        try {
          const { homeDirCustom } = await import("@/lib/tauri");
          const homePath = await homeDirCustom();
          if (homePath) {
            setFullArtifactPath(
              `${homePath}/.alloomi/sessions/${taskId}/${file.path}`,
            );
            return;
          }
        } catch (pathErr) {
          console.error(
            "[FilePreviewPanel] Failed to resolve full path:",
            pathErr,
          );
        }
      }

      // If path is already absolute (e.g., passed from Library page), use directly
      if (file.path?.startsWith("/")) {
        setFullArtifactPath(file.path);
        return;
      }

      // If path starts with ~, expand to user home directory path
      if (file.path?.startsWith("~/")) {
        try {
          const { homeDirCustom } = await import("@/lib/tauri");
          const homePath = await homeDirCustom();
          if (homePath) {
            setFullArtifactPath(file.path.replace(/^~/, homePath));
            return;
          }
        } catch (pathErr) {
          console.error("[FilePreviewPanel] Failed to expand ~ path:", pathErr);
        }
      }

      setFullArtifactPath(null);
    };

    resolveFullPath();
  }, [file, taskId]);

  const getFileTypeIconName = (type: string): string => {
    const iconMap: Record<string, string> = {
      pptx: "presentation",
      ppt: "presentation",
      pdf: "file_text",
      xlsx: "file_spreadsheet",
      xls: "file_spreadsheet",
      csv: "file_spreadsheet",
      docx: "file_text",
      doc: "file_text",
      py: "code",
      js: "code",
      ts: "code",
      tsx: "code",
      jsx: "code",
      html: "code",
      css: "code",
      json: "file_text",
      md: "file_type",
      markdown: "file_type",
      txt: "file_text",
      png: "file_image",
      jpg: "file_image",
      jpeg: "file_image",
      gif: "file_image",
      svg: "file_image",
      // Apple office suite format
      pages: "file_text",
      numbers: "file_spreadsheet",
      keynote: "presentation",
    };
    return iconMap[type] ?? "file";
  };

  if (!file) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <RemixIcon
          name="file_text"
          size="size-12"
          className="text-muted-foreground/50 mb-4"
        />
        <p className="text-sm text-muted-foreground">
          {t("common.filePreview.selectFile")}
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <RemixIcon
          name="loader_2"
          size="size-8"
          className="animate-spin text-primary mb-4"
        />
        <p className="text-sm text-muted-foreground">
          {t("common.filePreview.loading")}
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <RemixIcon
              name={getFileTypeIconName(cleanType)}
              size="size-5"
              className="text-primary shrink-0"
            />
            <span className="font-medium truncate">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
          >
            <RemixIcon name="close" size="size-4" />
          </button>
        </div>

        {/* Error Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-6xl mb-4">❌</p>
          <p className="text-lg font-medium mb-2">
            {t("common.filePreview.loadFailed")}
          </p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // HTML file preview - directly use WebsitePreview, no extra Header needed
  if (
    (cleanType === "html" || cleanType === "htm") &&
    WebsitePreviewComp &&
    codeContent
  ) {
    return (
      <WebsitePreviewComp
        content={codeContent}
        filename={file.name}
        filePath={fullArtifactPath || undefined}
        onClose={onClose}
      />
    );
  }

  // Markdown file preview - directly use MarkdownPreview, no extra Header needed
  if (
    (cleanType === "md" || cleanType === "markdown") &&
    MarkdownPreviewComp &&
    codeContent
  ) {
    return (
      <MarkdownPreviewComp
        content={codeContent}
        filename={file.name}
        filePath={fullArtifactPath || undefined}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <RemixIcon
            name={getFileTypeIconName(cleanType)}
            size="size-5"
            className="text-primary shrink-0"
          />
          <span className="font-medium truncate">{file.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {fullArtifactPath && (
            <>
              <button
                type="button"
                onClick={() => revealItemInDir(fullArtifactPath)}
                className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                title="Show in Folder"
              >
                <RemixIcon name="folder_open" size="size-4" />
              </button>
              <button
                type="button"
                onClick={() => openPathCustom(fullArtifactPath)}
                className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                title="Open with Default App"
              >
                <RemixIcon name="external_link" size="size-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
          >
            <RemixIcon name="close" size="size-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* PPTX file preview - protected by error boundary */}
        {cleanType === "pptx" &&
        PptxPreview &&
        (fullArtifactPath || (!taskId && file.path?.startsWith("/"))) ? (
          <ErrorBoundary
            fallback={
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <p className="text-6xl mb-4">📊</p>
                <p className="text-lg font-medium mb-2">
                  {t("common.filePreview.pptxFailed")}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  {t("common.filePreview.pptxFailedHint")}
                </p>
              </div>
            }
          >
            <PptxPreview
              artifact={{ ...file, path: fullArtifactPath || file.path }}
            />
          </ErrorBoundary>
        ) : null}

        {/* DOCX file preview */}
        {(cleanType === "docx" || cleanType === "doc") &&
        DocxPreviewComp &&
        (fullArtifactPath || (!taskId && file.path?.startsWith("/"))) ? (
          <ErrorBoundary
            fallback={
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <p className="text-6xl mb-4">📄</p>
                <p className="text-lg font-medium mb-2">
                  {t(
                    "common.filePreview.docxFailed",
                    "Failed to preview document",
                  )}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  {t(
                    "common.filePreview.docxFailedHint",
                    "Please try opening the file in Microsoft Word",
                  )}
                </p>
              </div>
            }
          >
            <DocxPreviewComp
              artifact={{ ...file, path: fullArtifactPath || file.path }}
            />
          </ErrorBoundary>
        ) : null}

        {/* Excel file preview - requires absolute path to read */}
        {["xlsx", "xls", "csv"].includes(cleanType) &&
        ExcelPreviewComp &&
        (fullArtifactPath || (!taskId && file.path?.startsWith("/"))) ? (
          <ErrorBoundary
            fallback={
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <p className="text-6xl mb-4">📊</p>
                <p className="text-lg font-medium mb-2">
                  {t("common.filePreview.excelFailed")}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  {t("common.filePreview.excelFailedHint")}
                </p>
              </div>
            }
          >
            <ExcelPreviewComp
              artifact={{ ...file, path: fullArtifactPath || file.path }}
            />
          </ErrorBoundary>
        ) : null}

        {/* Code file preview */}
        {[
          "py",
          "js",
          "ts",
          "tsx",
          "jsx",
          "css",
          "json",
          "txt",
          "sh",
          "bash",
        ].includes(cleanType) &&
          CodePreviewComp && (
            <div className="p-4">
              {fileTooLarge ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-6xl mb-4">📦</p>
                  <p className="text-lg font-medium mb-2">
                    {t("common.filePreview.fileTooLarge")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("common.filePreview.fileTooLargeDesc", {
                      size: (fileTooLarge / 1024 / 1024).toFixed(2),
                    })}
                  </p>
                </div>
              ) : codeContent ? (
                <CodePreviewComp
                  code={codeContent}
                  filename={file.name}
                  language={cleanType}
                  maxHeight="100%"
                />
              ) : (
                <div className="flex items-center justify-center p-8">
                  <RemixIcon
                    name="loader_2"
                    size="size-6"
                    className="animate-spin text-primary"
                  />
                </div>
              )}
            </div>
          )}

        {/* PDF file preview */}
        {(cleanType === "pdf" ||
          (isAppleDocumentFile(cleanType) && pdfContent)) &&
          PdfPreviewComp && (
            <ErrorBoundary
              fallback={
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <p className="text-6xl mb-4">📕</p>
                  <p className="text-lg font-medium mb-2">
                    {isAppleDocumentFile(cleanType)
                      ? t("common.filePreview.previewNotAvailable")
                      : t("common.filePreview.pdfFailed")}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    {isAppleDocumentFile(cleanType)
                      ? t("common.filePreview.applePreviewFailed") ||
                        "This Apple document may not have an iCloud preview"
                      : t("common.filePreview.pdfFailedHint")}
                  </p>
                </div>
              }
            >
              {pdfContent ? (
                <PdfPreviewComp file={pdfContent} maxHeight="100%" />
              ) : (
                <div className="flex items-center justify-center p-8">
                  <RemixIcon
                    name="loader_2"
                    size="size-6"
                    className="animate-spin text-primary"
                  />
                </div>
              )}
            </ErrorBoundary>
          )}

        {/* Image file preview */}
        {imageFileTypes.includes(cleanType) && (
          <div className="flex items-center justify-center p-4 h-full bg-muted/30">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-md shadow-sm"
              />
            ) : (
              <div className="flex items-center justify-center">
                <RemixIcon
                  name="loader_2"
                  size="size-6"
                  className="animate-spin text-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Other file types */}
        {!["pptx", "docx", "doc", "pdf", "xlsx", "xls", "csv"]
          .concat([
            "py",
            "js",
            "ts",
            "tsx",
            "jsx",
            "html",
            "htm",
            "css",
            "json",
            "md",
            "markdown",
            "txt",
            "sh",
            "bash",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "svg",
            "webp",
            "bmp",
            "ico",
            // Apple office suite format
            "pages",
            "numbers",
            "keynote",
          ])
          .includes(cleanType) && (
          <div className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-muted">
              <RemixIcon
                name={getFileTypeIconName(cleanType)}
                size="size-10"
                className="text-muted-foreground"
              />
            </div>
            <p className="text-lg font-medium mb-2">
              {t("common.filePreview.previewNotAvailable")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">{file.name}</p>
            <p className="text-xs text-muted-foreground max-w-md">
              {t("common.filePreview.fileTypeNotSupported", {
                type: cleanType,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
