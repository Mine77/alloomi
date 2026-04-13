/**
 * Chunked upload utility functions
 *
 * Next.js has a 10MB request body limit, large files require chunked upload
 */

export interface ChunkedUploadOptions {
  chunkSize?: number; // Default 5MB, with buffer
  maxRetries?: number;
  onProgress?: (
    fileName: string,
    progress: number,
    uploadedBytes: number,
    totalBytes: number,
  ) => void;
  cloudAuthToken?: string;
}

export interface ChunkedUploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
  fileName?: string;
  contentType?: string;
  extractedLength?: number;
  chunksCount?: number;
  billing?: {
    tokensUsed: number;
    creditCost: number;
  };
  stats?: {
    totalDocuments: number;
    totalChunks: number;
  };
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Chunked file upload
 */
export async function uploadRagFileChunked(
  file: File,
  options: ChunkedUploadOptions = {},
): Promise<ChunkedUploadResult> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxRetries = MAX_RETRIES,
    onProgress,
    cloudAuthToken,
  } = options;

  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const fileName = file.name;
  const contentType = file.type;
  const uploadId = generateUploadId();

  console.log(
    `[ChunkedUpload] Starting upload for ${fileName}, size: ${formatSize(totalSize)}, chunks: ${totalChunks}`,
  );

  try {
    // 1. Initialize upload
    const initResponse = await fetch("/api/rag/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        fileName,
        contentType,
        totalSize,
        totalChunks,
        cloudAuthToken,
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.json();
      return {
        success: false,
        error: error.error || "Failed to initialize upload",
      };
    }

    const initData = await initResponse.json();
    console.log(`[ChunkedUpload] Upload initialized: ${uploadId}`);

    // 2. Upload all chunks
    let uploadedBytes = 0;
    const chunkUploadPromises: Promise<void>[] = [];

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = file.slice(start, end);

      // Use wrapped upload function with retry support
      const uploadPromise = uploadChunkWithRetry(
        uploadId,
        fileName,
        chunkIndex,
        chunk,
        totalChunks,
        maxRetries,
      );

      // Serial upload to ensure order
      await uploadPromise;

      uploadedBytes += end - start;

      // Report progress
      if (onProgress) {
        const progress = (uploadedBytes / totalSize) * 100;
        onProgress(fileName, progress, uploadedBytes, totalSize);
      }
    }

    console.log(`[ChunkedUpload] All chunks uploaded: ${uploadId}`);

    // 3. Complete upload, trigger merge and processing
    const completeResponse = await fetch("/api/rag/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        fileName,
        contentType,
        cloudAuthToken,
      }),
    });

    // Check for scanned PDF error first (returns 400)
    // Must check this BEFORE the general !ok check since 400 is not "ok"
    if (completeResponse.status === 400) {
      const errorData = await completeResponse.json();
      console.log(
        "[ChunkedUpload] Got 400 error, returning scanned PDF marker:",
        errorData.error,
      );
      return {
        success: false,
        error: errorData.error || "Failed to complete upload",
      };
    }

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      return {
        success: false,
        error: error.error || "Failed to complete upload",
      };
    }

    const completeData = await completeResponse.json();

    console.log(
      `[ChunkedUpload] Upload completed: ${uploadId}, documentId: ${completeData.documentId}`,
    );

    return {
      success: true,
      documentId: completeData.documentId,
      fileName: completeData.fileName,
      contentType: completeData.contentType,
      extractedLength: completeData.extractedLength,
      chunksCount: completeData.chunksCount,
      billing: completeData.billing,
      stats: completeData.stats,
    };
  } catch (error) {
    console.error(`[ChunkedUpload] Upload failed for ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload a single chunk (with retry)
 */
async function uploadChunkWithRetry(
  uploadId: string,
  fileName: string,
  chunkIndex: number,
  chunk: Blob,
  totalChunks: number,
  maxRetries: number,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("fileName", fileName);
      formData.append("chunkIndex", chunkIndex.toString());
      formData.append("totalChunks", totalChunks.toString());
      formData.append("chunk", chunk);

      const response = await fetch("/api/rag/upload/chunk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to upload chunk ${chunkIndex}`);
      }

      return; // Upload successful
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        console.warn(
          `[ChunkedUpload] Chunk ${chunkIndex} upload failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * (attempt + 1)),
        );
      }
    }
  }

  throw (
    lastError ||
    new Error(
      `Failed to upload chunk ${chunkIndex} after ${maxRetries} retries`,
    )
  );
}

/**
 * Generate unique upload ID
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Determine if a file needs chunked upload
 * Image files always use chunked upload because image processing calls Vision API, which takes longer
 */
export function shouldUseChunkedUpload(file: File): boolean {
  // Images always use chunked upload to avoid timeout issues from long wait times
  if (file.type.startsWith("image/")) {
    return true;
  }
  return file.size > 8 * 1024 * 1024; // Use chunked upload for files over 8MB
}
