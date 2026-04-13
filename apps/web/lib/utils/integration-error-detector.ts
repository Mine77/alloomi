/**
 * Tool names that require at least one connected account.
 * When these tools fail (isError: true), the user needs to connect.
 */
export const INTEGRATION_TOOL_NAMES = new Set(["sendReply", "queryContacts"]);

/**
 * Tool names that query which integrations are connected.
 * When these tools return bots: [], the user has no connected accounts.
 */
export const QUERY_INTEGRATION_TOOL_NAMES = new Set([
  "queryIntegrations",
  "queryContacts",
]);

/**
 * Checks whether a tool name is an integration-dependent tool.
 */
export function isIntegrationTool(toolName: string): boolean {
  const baseName = toolName.includes("__")
    ? (toolName.split("__").pop() ?? toolName)
    : toolName;
  return INTEGRATION_TOOL_NAMES.has(baseName);
}

/**
 * Checks whether a tool name queries integration accounts.
 */
export function isQueryIntegrationTool(toolName: string): boolean {
  const baseName = toolName.includes("__")
    ? (toolName.split("__").pop() ?? toolName)
    : toolName;
  return QUERY_INTEGRATION_TOOL_NAMES.has(baseName);
}

/**
 * Extracts the inner JSON object from tool output.
 * Tool output may be:
 * 1. A plain JSON object string: '{"success":true,"bots":[]}'
 * 2. A stringified MCP content array: '[{"type":"text","text":"{...}"}]'
 */
function extractInnerObject(
  toolOutput: string,
): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(toolOutput);
  } catch {
    return null;
  }

  // If it's already an object with a "bots" field, return directly
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  // If it's an MCP content array, extract the first text entry and parse it
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).type === "text" &&
        typeof (item as Record<string, unknown>).text === "string"
      ) {
        try {
          return JSON.parse((item as Record<string, unknown>).text as string);
        } catch {
          // fall through
        }
      }
    }
  }

  return null;
}

/**
 * Detects whether queryIntegrations returned zero bots.
 * Format: { "success": true, "bots": [], "count": 0, ... }
 */
export function hasNoBotsInResponse(toolOutput: unknown): boolean {
  if (!toolOutput) return false;

  let obj: Record<string, unknown> | null;

  if (typeof toolOutput === "string") {
    obj = extractInnerObject(toolOutput);
  } else if (typeof toolOutput === "object") {
    obj = toolOutput as Record<string, unknown>;
  } else {
    return false;
  }

  if (!obj) return false;

  const bots = obj.bots;
  return Array.isArray(bots) && bots.length === 0;
}
