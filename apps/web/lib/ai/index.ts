/**
 * @alloomi/ai - AI Layer barrel export
 * Re-exports from @alloomi/agent/ai package and local app-specific modules.
 */

// Package exports (tokens, pricing, compaction, providers, router)
export {
  estimateTokens,
  getInputCredits,
  getOutputCredits,
  getTotalCredits,
  INPUT_TOKENS_PER_CREDIT,
  OUTPUT_TOKENS_PER_CREDIT,
} from "@alloomi/agent/ai";
export type { ModelType } from "@alloomi/agent/ai";
export {
  MODEL_PRICING,
  getModelPricing,
  getModelMultiplier,
  CREDIT_VALUE_USD,
  calculateImageCredits,
  getImageModelPricing,
  IMAGE_MODEL_PRICING,
  getCanonicalImageModel,
  calculateInputCredits,
  calculateOutputCredits,
  calculateTotalCredits,
} from "@alloomi/agent/ai";
export {
  COMPACTION_SOFT_RATIO,
  COMPACTION_HARD_RATIO,
  COMPACTION_EMERGENCY_RATIO,
  COMPACTION_MODEL,
  buildCompactionPrompt,
} from "@alloomi/agent/ai";
export type {
  CompactionLevel,
  CompactionPlatform,
  CompactionResult,
} from "@alloomi/agent/ai";
export { triggerCompaction, triggerCompactionAsync } from "@alloomi/agent/ai";
export type { CompactionOptions, CompactionResponse } from "@alloomi/agent/ai";
export {
  prepareConversationWindows,
  estimateConversationTokens,
  getConversationBucket,
  DEFAULT_CONVERSATION_WINDOW_CONFIG,
} from "@alloomi/agent/ai";
export type {
  ConversationWindowMessage,
  ConversationWindowConfig,
  ConversationWindowBucket,
  ConversationWindowResult,
  TokenizedConversationWindowMessage,
  ConversationWindowBucketStats,
  ConversationWindowRole,
} from "@alloomi/agent/ai";
export {
  getVLMModel,
  createDynamicModel,
  getModelProvider,
  setAIUserContext,
  clearAIUserContext,
  getAIUserContext,
} from "@alloomi/agent/ai";
export type { AIUserContext, UserType } from "@alloomi/agent/ai";
export {
  routeModelCall,
  getRecommendedMode,
  // Note: checkCloudAIAvailability from package is excluded to avoid conflict
  // with cloud-client version below; use checkCloudAIAvailability from ./cloud-client
} from "@alloomi/agent/ai";
export type { ModelCallOptions, ModelCallResult } from "@alloomi/agent/ai";

// Local app-specific cloud client (depends on @/lib/api/remote-client)
export {
  canUseCloudAI,
  checkCloudAIAvailability,
  callCloudAIStream,
  callCloudAI,
  callCloudAIGeneric,
  type CloudAIRequest,
  type CloudAIResponse,
} from "./cloud-client";

// Local app-specific router (extends package router with cloud fallback)
export {
  routeModelCall as routeModelCallLocal,
  routeModelCallCloud,
} from "./router";
export type { CloudAIRequest as RouterCloudAIRequest } from "./router";

// Local app-specific request context (app-specific helpers only)
export {
  extractCloudAuthToken,
  setAIUserContextFromRequest,
} from "./request-context";

// Backward-compatible singletons for web app (non-native mode)
// These delegate to the new function-based API
import { isTauriMode } from "@/lib/env/constants";
import {
  getModelProvider,
  getModel as getModelBase,
  getVLMModel,
} from "@alloomi/agent/ai";

// getModel returns model using isTauriMode() to determine native mode
export function getModel() {
  return getModelBase(isTauriMode());
}

export const modelProvider = getModelProvider(isTauriMode());
export const model = getModelBase(isTauriMode());
export const vlmModel = getVLMModel(isTauriMode());
