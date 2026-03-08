/**
 * lib/ai/client.ts — Two-tier AI client for Anthropic API calls.
 *
 * Tier 1: generateWithPrompt() — full pipeline with streaming, thinking, caching
 * Tier 2: callModel() — simple direct call for lightweight tasks (judging, etc.)
 *
 * Both return typed GenerationResponse. Error classification maps HTTP status
 * codes to descriptive error classes.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE } from "../config.js";
import { loadPrompt } from "../prompts/loader.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerationResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  stopReason: string | null;
}

export interface FullGenerationResponse extends GenerationResponse {
  thinkingTokens: number;
  cacheStats: { read: number; created: number };
  promptVersion: string;
  model: string;
}

export interface CallModelOptions {
  model?: string;
  maxTokens?: number;
}

export interface GenerateOptions extends CallModelOptions {
  /** Override thinking config (default: adaptive) */
  thinking?: { type: "adaptive" };
  /** Override effort level (default: max) */
  effort?: string;
}

// ─── Error Classification ────────────────────────────────────────────────────

export class AiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export class ApiKeyError extends AiError {
  constructor(cause?: Error) {
    super("Invalid or missing API key. Check ANTHROPIC_API_KEY in .env.local", 401, cause);
    this.name = "ApiKeyError";
  }
}

export class RateLimitError extends AiError {
  constructor(cause?: Error) {
    super("Rate limited. Wait a moment and try again.", 429, cause);
    this.name = "RateLimitError";
  }
}

export class OverloadError extends AiError {
  constructor(cause?: Error) {
    super("API overloaded. Wait a moment and try again.", 529, cause);
    this.name = "OverloadError";
  }
}

export class GenerationError extends AiError {
  constructor(message: string, statusCode: number, cause?: Error) {
    super(message, statusCode, cause);
    this.name = "GenerationError";
  }
}

/** Classify an Anthropic API error into a typed error. */
export function classifyError(err: unknown): AiError {
  if (err instanceof Anthropic.APIError) {
    switch (err.status) {
      case 401:
        return new ApiKeyError(err);
      case 429:
        return new RateLimitError(err);
      case 529:
        return new OverloadError(err);
      default:
        return new GenerationError(`API Error: ${err.status} ${err.message}`, err.status, err);
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return new GenerationError(message, 0, err instanceof Error ? err : undefined);
}

// ─── Client ──────────────────────────────────────────────────────────────────

/** Create an Anthropic client with env validation. */
export function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ApiKeyError();
  }
  return new Anthropic();
}

// ─── Tier 2: Simple Model Call ───────────────────────────────────────────────

/**
 * Simple direct API call without streaming, thinking, or caching.
 * Use for lightweight tasks like LLM judging, summarization, etc.
 */
export async function callModel(
  systemPrompt: string,
  userMessage: string,
  options?: CallModelOptions,
): Promise<GenerationResponse> {
  const client = createClient();
  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: options?.model ?? CLAUDE.model,
      max_tokens: options?.maxTokens ?? 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      durationMs: Date.now() - startTime,
      stopReason: response.stop_reason,
    };
  } catch (err) {
    throw classifyError(err);
  }
}

// ─── Tier 1: Full Pipeline Generation ────────────────────────────────────────

/**
 * Full pipeline generation with streaming, adaptive thinking, prompt caching.
 * Loads the prompt by ID, calls the API with streaming, and returns a rich response.
 */
export async function generateWithPrompt(
  promptId: string,
  userMessage: string,
  options?: GenerateOptions,
): Promise<FullGenerationResponse> {
  const client = createClient();
  const { systemPrompt, config: promptConfig, metadata } = loadPrompt(promptId);

  const model = options?.model ?? promptConfig.model ?? CLAUDE.model;
  const maxTokens = options?.maxTokens ?? promptConfig.maxTokens ?? CLAUDE.maxTokens;
  const promptVersion = `${metadata.id}@${metadata.version}`;

  const startTime = Date.now();

  try {
    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      {
        type: "text" as const,
        text: systemPrompt,
        ...(promptConfig.cacheSystemPrompt !== false
          ? { cache_control: { type: "ephemeral" as const } }
          : {}),
      },
    ];

    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      thinking: options?.thinking ?? CLAUDE.thinking,
      output_config: { effort: (options?.effort ?? CLAUDE.effort) as "max" | "high" | "low" },
      system: systemBlocks,
      messages: [{ role: "user", content: userMessage }],
    });

    const response = await stream.finalMessage();
    const durationMs = Date.now() - startTime;

    // Extract text and thinking tokens
    let text = "";
    let thinkingTokens = 0;
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "thinking") {
        thinkingTokens += block.thinking.length;
      }
    }

    // Extract cache stats (fields exist on Anthropic responses but aren't in SDK types yet)
    const usage = response.usage as unknown as Record<string, unknown>;
    const cacheRead =
      typeof usage.cache_read_input_tokens === "number" ? usage.cache_read_input_tokens : 0;
    const cacheCreation =
      typeof usage.cache_creation_input_tokens === "number" ? usage.cache_creation_input_tokens : 0;

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      durationMs,
      stopReason: response.stop_reason,
      thinkingTokens,
      cacheStats: { read: cacheRead, created: cacheCreation },
      promptVersion,
      model,
    };
  } catch (err) {
    throw classifyError(err);
  }
}
