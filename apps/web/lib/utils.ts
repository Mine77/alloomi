import { AppError, type ErrorCode } from "@alloomi/shared/errors";
import type { ChatMessage } from "@alloomi/shared";
import { formatISO } from "date-fns";
import type { Session } from "next-auth";
import { getAuthToken } from "@/lib/auth/token-manager";
import type { DBMessage } from "@/lib/db/schema";

// Shared utilities from @alloomi/shared
import {
  cn,
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
  sanitizeText,
  getTextFromMessage,
  getCurrentTimestamp,
  normalizeTimestamp,
  formatToLocalTime,
  getCurrentYearMonth,
  formatBytes,
  coerceDate,
  timeBeforeHours,
  timeBeforeHoursMs,
  timeBeforeMinutes,
  delay,
} from "@alloomi/shared";

export {
  cn,
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
  sanitizeText,
  getTextFromMessage,
  getCurrentTimestamp,
  normalizeTimestamp,
  formatToLocalTime,
  getCurrentYearMonth,
  formatBytes,
  coerceDate,
  timeBeforeHours,
  timeBeforeHoursMs,
  timeBeforeMinutes,
  delay,
};

// App-specific utilities
export const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new AppError(code as ErrorCode, cause);
  }

  return response.json();
};

/**
 * Get the home path.
 */
export function getHomePath(): string {
  return "/chat";
}

/**
 * Fetcher with cloud auth token - automatically adds Authorization header
 * Use this for API calls that require AI Provider authentication
 */
export const fetcherWithCloudAuth: typeof fetcher = async (url) => {
  const cloudAuthToken = typeof window !== "undefined" ? getAuthToken() : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (cloudAuthToken) {
    headers.Authorization = `Bearer ${cloudAuthToken}`;
  }

  const response = await fetch(url, {
    headers,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new AppError(code as ErrorCode, cause);
  }

  return response.json();
};

/**
 * Fetch with auth - automatically adds Authorization header for cloud auth
 * Supports all HTTP methods and custom options
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const cloudAuthToken = typeof window !== "undefined" ? getAuthToken() : null;

  const headers = new Headers(init?.headers);

  if (
    init?.body &&
    !headers.has("Content-Type") &&
    typeof init.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (cloudAuthToken) {
    headers.set("Authorization", `Bearer ${cloudAuthToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  return response;
}

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new AppError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new AppError("offline:chat");
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== "undefined") {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  return [];
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: message.parts as any,
    metadata: {
      createdAt: formatISO(message.createdAt),
      ...(message.metadata || {}),
    },
  }));
}

export function createPageUrl(pageName: string) {
  return `/${pageName.toLowerCase().replace(/ /g, "-")}`;
}

export function judgeGuest(session: Session) {
  return session?.user?.type === "guest";
}

/**
 * Navigation URL build options
 */
export interface BuildNavigationUrlOptions {
  /** Current path (required to ensure it works in desktop environments like Tauri) */
  pathname: string;
  /** Current query parameters (string or URLSearchParams object) */
  searchParams?: string | URLSearchParams | null;
  /** Optional: new chatId (will change path to /chat/{chatId} or / when chatId is null) */
  chatId?: string | null;
  /** Query parameters to add/update/delete (setting to null or undefined deletes the parameter) */
  paramsToUpdate?: Record<string, string | null | undefined>;
}

/**
 * Build navigation URL, preserving current path and query parameters
 *
 * **Note**: This function requires explicit `pathname` to ensure it works in all environments including Web and Tauri desktop.
 */
export function buildNavigationUrl(options: BuildNavigationUrlOptions): string {
  const { pathname, searchParams, chatId, paramsToUpdate = {} } = options;

  const params = new URLSearchParams(searchParams?.toString() || "");

  Object.entries(paramsToUpdate).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const queryString = params.toString();

  if (chatId !== undefined) {
    const newPath = chatId ? `/chat/${chatId}` : "/";
    return queryString ? `${newPath}?${queryString}` : newPath;
  }

  return queryString ? `${pathname}?${queryString}` : pathname;
}

/**
 * Filter out tool call text from output.
 * Removes [TOOL_USE] and [TOOL_RESULT] blocks and their associated
 * JSON parameters that are generated during compaction preprocessing.
 */
export function filterToolCallText(text: string): string {
  if (!text) return text;

  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip lines that start with [TOOL_USE N/N] or [TOOL_RESULT N/N]
    if (/^\[TOOL_(USE|RESULT)\s+\d+\/\d+\]/.test(trimmed)) {
      i++;
      // Skip following lines that are clearly part of the tool call block:
      // - Lines with only { or [ (opening JSON)
      // - Lines with only } or ] (closing JSON)
      // - Lines starting with mcp__ or known tool names
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        // Stop if this line is clearly content (has meaningful text that's not JSON/padding)
        if (
          nextTrimmed === "" ||
          nextTrimmed === "}" ||
          nextTrimmed === "]" ||
          nextTrimmed === "{" ||
          /^{[\s]*}$/.test(nextTrimmed) ||
          /^[\s]*\}[;\s]*$/.test(nextTrimmed)
        ) {
          i++;
          continue;
        }
        // Stop if this looks like tool parameters (key: value pairs)
        if (
          /^"command"\s*:/.test(nextTrimmed) ||
          /^"description"\s*:/.test(nextTrimmed) ||
          /^"input"\s*:/.test(nextTrimmed) ||
          /^"output"\s*:/.test(nextTrimmed) ||
          /^"status"\s*:/.test(nextTrimmed) ||
          /^"result"\s*:/.test(nextTrimmed) ||
          /^"name"\s*:/.test(nextTrimmed)
        ) {
          i++;
          continue;
        }
        // Stop if this is a known tool name or mcp tool
        if (
          /^mcp__/.test(nextTrimmed) ||
          /^(Bash|queryIntegrations|Sh|Node|RunCommand)\b/.test(nextTrimmed)
        ) {
          i++;
          continue;
        }
        // Stop if this is another tool call marker
        if (
          /^\[TOOL_(USE|RESULT)\s+\d+\/\d+\]/.test(nextTrimmed) ||
          /^\[TOOL_(USE|RESULT)\]/.test(nextTrimmed)
        ) {
          i++;
          continue;
        }
        // This line is content, stop skipping
        break;
      }
      continue;
    }

    // Skip lines that are [TOOL_USE] or [TOOL_RESULT] without N/N
    if (/^\[TOOL_(USE|RESULT)\]/.test(trimmed)) {
      i++;
      continue;
    }

    // Skip lines that are only closing braces (leftover from tool call JSON blocks)
    if (trimmed === "}" || trimmed === "]") {
      i++;
      continue;
    }

    // Skip lines that look like they start with JSON key-value pairs from tool calls
    if (
      /^"command"\s*:/.test(trimmed) ||
      /^"description"\s*:/.test(trimmed) ||
      /^"input"\s*:/.test(trimmed) ||
      /^"output"\s*:/.test(trimmed) ||
      /^"status"\s*:/.test(trimmed) ||
      /^"result"\s*:/.test(trimmed) ||
      /^"name"\s*:/.test(trimmed)
    ) {
      i++;
      continue;
    }

    result.push(line);
    i++;
  }

  // Final cleanup: remove any remaining orphaned closing braces
  const cleaned = result
    .join("\n")
    .replace(/^\s*}\s*$/gm, "")
    .trim();

  return cleaned;
}
