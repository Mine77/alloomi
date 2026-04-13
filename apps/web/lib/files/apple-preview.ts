import JSZip from "jszip";

/**
 * Extract iCloud preview PDF from Apple files (.pages, .numbers, .keynote)
 *
 * Apple files are actually ZIP format, with the preview PDF located at QuickLook/Preview.pdf
 *
 * @param arrayBuffer - ArrayBuffer of the file
 * @returns Preview PDF as Uint8Array, or null if not found
 */
export async function extractApplePreviewPdf(
  arrayBuffer: ArrayBufferLike,
): Promise<Uint8Array | null> {
  try {
    // Ensure a separate ArrayBuffer copy is created (JSZip does not support SharedArrayBuffer)
    const source = new Uint8Array(arrayBuffer);
    const buffer = new ArrayBuffer(source.byteLength);
    new Uint8Array(buffer).set(source);

    const zip = await JSZip.loadAsync(buffer);

    // Locate the preview PDF file path
    const previewPath = "QuickLook/Preview.pdf";
    const previewFile = zip.file(previewPath);

    if (!previewFile) {
      console.warn(
        "[ApplePreview] No preview PDF found in file. Paths:",
        Object.keys(zip.files),
      );
      return null;
    }

    const pdfData = await previewFile.async("uint8array");
    return pdfData;
  } catch (error) {
    console.error("[ApplePreview] Failed to extract preview PDF:", error);
    return null;
  }
}

/**
 * Check if a file is an Apple document format
 */
export function isAppleDocumentFile(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return ["pages", "numbers", "keynote"].includes(ext || "");
}
