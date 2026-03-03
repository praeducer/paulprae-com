/**
 * lib/ai/index.ts — Barrel re-export for AI service modules.
 */

export {
  createClient,
  callModel,
  generateWithPrompt,
  classifyError,
  AiError,
  ApiKeyError,
  RateLimitError,
  OverloadError,
  GenerationError,
} from "./client.js";
export type {
  GenerationResponse,
  FullGenerationResponse,
  CallModelOptions,
  GenerateOptions,
} from "./client.js";

export {
  estimateCost,
  estimateTokens,
  logGeneration,
  readTelemetry,
  formatTelemetrySummary,
} from "./telemetry.js";
export type { GenerationTelemetry } from "./telemetry.js";
