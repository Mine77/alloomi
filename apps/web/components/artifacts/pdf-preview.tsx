"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@alloomi/ui";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PdfPreviewProps {
  file: File | string | ArrayBuffer | Uint8Array;
  className?: string;
  maxHeight?: string;
  path?: string;
}

export interface RenderedPage {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

async function loadPdfData(
  file: File | string | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (typeof file === "string") {
    if (file.startsWith("blob:") || file.startsWith("http")) {
      const res = await fetch(file);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
    throw new Error("Unsupported string path");
  }
  if (file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  return new Uint8Array(file);
}

async function renderPdfToImages(
  data: Uint8Array,
  scale: number,
  onPage: (page: RenderedPage, current: number, total: number) => void,
  onError: (err: Error) => void,
) {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }

    const doc = await pdfjsLib.getDocument({ data: data }).promise;
    const total = doc.numPages;

    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas 2D context");
      await page.render({ canvasContext: ctx, viewport } as any).promise;

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) {
        onError(new Error(`Failed to render page ${i}`));
        return;
      }

      const buf = await blob.arrayBuffer();
      const dataUrl = `data:image/png;base64,${uint8ToBase64(new Uint8Array(buf))}`;
      onPage(
        {
          index: i - 1,
          dataUrl,
          width: viewport.width,
          height: viewport.height,
        },
        i,
        total,
      );
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

function uint8ToBase64(uint8Array: Uint8Array): string {
  const len = uint8Array.byteLength;
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    binary += String.fromCharCode.apply(
      null,
      Array.from(uint8Array.slice(i, end)) as unknown as number[],
    );
  }
  return btoa(binary);
}

export function PdfPreview({
  file,
  className,
  maxHeight = "800px",
  path,
}: PdfPreviewProps) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const blobUrlRef = useRef<string | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  // Load PDF data and render
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    setCurrentPage(1);

    (async () => {
      try {
        const data = await loadPdfData(file);
        if (cancelled) return;
        dataRef.current = data;

        const rendered: RenderedPage[] = [];
        await renderPdfToImages(
          data,
          scale,
          (page) => {
            if (!cancelled) {
              rendered.push(page);
              setPages([...rendered]);
              setTotalPages(page.index + 1);
            }
          },
          (err) => {
            if (!cancelled) setError(err.message);
          },
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]); // scale intentionally excluded — re-render only when file changes

  // Re-render when scale changes (only re-render current page + adjacent)
  useEffect(() => {
    if (!dataRef.current || pages.length === 0) return;

    const rendered: RenderedPage[] = [];
    const done = 0;
    setPages([]);

    renderPdfToImages(
      dataRef.current,
      scale,
      (page) => {
        rendered.push(page);
        setPages([...rendered]);
      },
      (err) => setError(err.message),
    );
  }, [scale]);

  // Build blob URL for download
  useEffect(() => {
    (async () => {
      try {
        const data = await loadPdfData(file);
        const blob = new Blob([new Uint8Array(data)], {
          type: "application/pdf",
        });
        blobUrlRef.current = URL.createObjectURL(blob);
      } catch {
        // ignore
      }
    })();
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [file]);

  const handleDownload = () => {
    const url = blobUrlRef.current;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download =
      file instanceof File
        ? file.name
        : typeof file === "string" && !file.startsWith("blob:")
          ? "document.pdf"
          : "document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShowInFolder = async () => {
    if (!path) return;
    if (!(window as any).__TAURI__) return;
    try {
      const { revealItemInDir } = await import("@/lib/tauri");
      await revealItemInDir(path);
    } catch (err) {
      console.error("[PdfPreview] Failed to show in folder:", err);
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 h-full",
          className,
        )}
        style={maxHeight !== "100%" ? { maxHeight } : undefined}
      >
        <RemixIcon
          name="error_warning"
          size="size-12"
          className="text-destructive mb-4"
        />
        <p className="font-medium mb-2 text-center">
          {t("common.pdfPreview.loadFailed")}
        </p>
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 h-full gap-3",
          className,
        )}
        style={maxHeight !== "100%" ? { maxHeight } : undefined}
      >
        <RemixIcon
          name="loader_2"
          size="size-8"
          className="animate-spin text-primary"
        />
        <p className="text-sm text-muted-foreground">
          {t("common.filePreview.loading") || "Loading PDF..."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      style={maxHeight !== "100%" ? { maxHeight } : undefined}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted border-b shrink-0">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            <RemixIcon name="arrow-left" size="size-4" />
          </Button>
          <span className="text-sm min-w-[60px] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage >= totalPages}
            title="Next page"
          >
            <RemixIcon name="arrow-right" size="size-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            title="Zoom out"
          >
            <RemixIcon name="zoom-out" size="size-4" />
          </Button>
          <span className="text-sm min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            title="Zoom in"
          >
            <RemixIcon name="zoom-in" size="size-4" />
          </Button>
        </div>

        {/* File actions */}
        <div className="flex items-center gap-1">
          {path && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShowInFolder}
              title="Show in Folder"
            >
              <RemixIcon name="folder_open" size="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            title="Download"
          >
            <RemixIcon name="download" size="size-4" />
          </Button>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        {pages.length > 0 && (
          <div className="flex flex-col items-center gap-4 p-4">
            {pages.map((page) => (
              <div
                key={page.index}
                className={cn(
                  "flex justify-center",
                  page.index + 1 !== currentPage && "hidden sm:flex",
                )}
              >
                <img
                  src={page.dataUrl}
                  alt={`Page ${page.index + 1}`}
                  className="max-w-full shadow-md bg-white"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
