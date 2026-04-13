import { randomUUID } from "node:crypto";

const MAX_FILENAME_LENGTH = 120;

export function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  const normalized = trimmed.replace(/[^\w.-]+/g, "-");
  const collapsed = normalized.replace(/-+/g, "-");
  const limited =
    collapsed.length > MAX_FILENAME_LENGTH
      ? collapsed.slice(0, MAX_FILENAME_LENGTH)
      : collapsed;
  return limited.length > 0 ? limited : `file-${randomUUID()}`;
}

export function ensureExtension(filename: string, fallbackExt: string) {
  if (!fallbackExt) return filename;
  const hasExtension = /\.[A-Za-z0-9]+$/.test(filename);
  if (hasExtension) return filename;
  return `${filename}${
    fallbackExt.startsWith(".") ? fallbackExt : `.${fallbackExt}`
  }`;
}

export function getExtensionFromContentType(contentType: string): string {
  const mapping: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ".pptx",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/zip": ".zip",
  };
  return mapping[contentType] ?? "";
}
