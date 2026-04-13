import type { AssistantModelMessage, ToolModelMessage, UIMessage } from "ai";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ChatMessage } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = ToolModelMessage | AssistantModelMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === "user");
  return userMessages.at(-1);
}

export function getTrailingMessageId({
  messages,
}: {
  messages: Array<ResponseMessage>;
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) return null;

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace("<has_function_call>", "");
}

export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Normalize timestamp to millisecond precision
 * Auto-detects timestamp format: if less than 10000000000 (April 1970), treat as second-level timestamp and convert to milliseconds
 * @param timestamp - Timestamp (can be second-level or millisecond-level)
 * @returns Normalized millisecond-level timestamp
 */
export function normalizeTimestamp(
  timestamp: number | string | null | undefined,
): number {
  if (!timestamp) return Date.now();

  const numTimestamp =
    typeof timestamp === "string" ? Number.parseInt(timestamp, 10) : timestamp;

  if (Number.isNaN(numTimestamp)) return Date.now();

  // If timestamp is less than 10000000000 (April 1970), treat as second-level and convert to milliseconds
  return numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp;
}

export const formatToLocalTime = (time: string | number | Date): string => {
  const date = new Date(time);
  return date.toLocaleString();
};

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return { year, month };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  const formatted = Number.parseFloat(
    (bytes / Math.pow(k, index)).toFixed(dm),
  ).toString();

  return `${formatted} ${sizes[index]}`;
}

// Time utilities
export function coerceDate(input: unknown): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    return new Date(input * (input > 1e12 ? 1 : 1000));
  }
  if (typeof input === "string") {
    const numeric = Number(input);
    if (!Number.isNaN(numeric)) {
      return new Date(numeric * (numeric > 1e12 ? 1 : 1000));
    }
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

export function timeBeforeHours(hours: number): number {
  return Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
}

export function timeBeforeHoursMs(hours: number): number {
  return Date.now() - hours * 60 * 60 * 1000;
}

export function timeBeforeMinutes(minutes: number): number {
  return Math.floor((Date.now() - minutes * 60 * 1000) / 1000);
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
