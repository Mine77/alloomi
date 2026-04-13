/**
 * PDF to Image converter for RAG
 * Converts PDF pages to images for upload via existing image RAG pipeline
 * Designed for client-side (browser) use
 */

import { OCR_MAX_PAGES } from "./config";

/**
 * Dynamically load pdfjs only in browser-facing execution paths.
 * This avoids importing browser-only pdfjs runtime during SSR.
 */
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

/**
 * Convert PDF pages to image files
 * Returns array of image files that can be uploaded via existing image RAG pipeline
 */
export async function convertPDFToImages(
  file: File,
  options?: {
    onProgress?: (currentPage: number, totalPages: number) => void;
  },
): Promise<{
  images: File[];
  totalPages: number;
}> {
  try {
    const pdfjs = await loadPdfJs();
    console.log(
      "[PDF to Images] Starting conversion for:",
      file.name,
      "size:",
      file.size,
    );

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    console.log("[PDF to Images] PDF has", numPages, "pages");

    // Check page limit for OCR processing
    if (numPages > OCR_MAX_PAGES) {
      throw new Error(
        `PDF has ${numPages} pages, which exceeds the OCR limit of ${OCR_MAX_PAGES} pages. Please use a PDF with fewer pages or split it into multiple files.`,
      );
    }

    const images: File[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      options?.onProgress?.(pageNum, numPages);
      console.log("[PDF to Images] Processing page", pageNum, "/", numPages);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

      // Create a canvas to render the page
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to get canvas context");
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to convert canvas to blob"));
        }, "image/png");
      });

      // Create File object from blob
      const imageFile = new File([blob], `page_${pageNum}.png`, {
        type: "image/png",
      });

      images.push(imageFile);
      console.log(
        "[PDF to Images] Page",
        pageNum,
        "converted to image, size:",
        blob.size,
      );
    }

    console.log("[PDF to Images] Total images:", images.length);

    return {
      images,
      totalPages: numPages,
    };
  } catch (error) {
    console.error("[PDF to Images] Error:", error);
    throw new Error(
      `PDF processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Check if a file is a PDF
 */
export function isPDF(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}
