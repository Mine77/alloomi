/**
 * iMessage Agent Runtime Handler (Client Version)
 *
 * Pure frontend version, no database dependency
 * Used for iMessage Tauri frontend environment
 */

import { handleAgentRuntime as sharedHandleAgentRuntime } from "@/lib/ai/runtime/shared-client";

export interface HandleAgentRuntimeOptions {
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
  images?: Array<{ data: string; mimeType: string }>;
  fileAttachments?: Array<{ name: string; data: string; mimeType: string }>;
  userId?: string;
  workDir?: string;
  stream?: boolean;
  aiSoulPrompt?: string | null;
  language?: string | null;
  modelConfig?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

/**
 * Calls the Agent Runtime to process iMessage messages (client version)
 */
export async function handleAgentRuntime(
  prompt: string,
  options: HandleAgentRuntimeOptions,
  callback: (message: string) => Promise<void>,
): Promise<void> {
  return sharedHandleAgentRuntime(prompt, options, callback, "imessage");
}
