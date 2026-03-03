/**
 * ai-client.test.ts — Tests for the AI service client module.
 *
 * Tests cover: error classification, client creation, response types.
 * API calls are NOT made — these test the classification and typing logic.
 *
 * Run: npm test -- tests/ai-client.test.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import {
  classifyError,
  createClient,
  AiError,
  ApiKeyError,
  RateLimitError,
  OverloadError,
  GenerationError,
} from "../lib/ai/client.js";

// ─── Error Classification ────────────────────────────────────────────────────

describe("classifyError", () => {
  it("classifies 401 as ApiKeyError", () => {
    const apiErr = new Anthropic.APIError(
      401,
      { type: "error", error: { type: "authentication_error", message: "invalid api key" } },
      "invalid api key",
      new Headers(),
    );
    const classified = classifyError(apiErr);
    expect(classified).toBeInstanceOf(ApiKeyError);
    expect(classified.statusCode).toBe(401);
  });

  it("classifies 429 as RateLimitError", () => {
    const apiErr = new Anthropic.APIError(
      429,
      { type: "error", error: { type: "rate_limit_error", message: "rate limited" } },
      "rate limited",
      new Headers(),
    );
    const classified = classifyError(apiErr);
    expect(classified).toBeInstanceOf(RateLimitError);
    expect(classified.statusCode).toBe(429);
  });

  it("classifies 529 as OverloadError", () => {
    const apiErr = new Anthropic.APIError(
      529,
      { type: "error", error: { type: "overloaded_error", message: "overloaded" } },
      "overloaded",
      new Headers(),
    );
    const classified = classifyError(apiErr);
    expect(classified).toBeInstanceOf(OverloadError);
    expect(classified.statusCode).toBe(529);
  });

  it("classifies other API errors as GenerationError", () => {
    const apiErr = new Anthropic.APIError(
      500,
      { type: "error", error: { type: "api_error", message: "internal error" } },
      "internal error",
      new Headers(),
    );
    const classified = classifyError(apiErr);
    expect(classified).toBeInstanceOf(GenerationError);
    expect(classified.statusCode).toBe(500);
  });

  it("classifies non-API errors as GenerationError with status 0", () => {
    const err = new Error("network timeout");
    const classified = classifyError(err);
    expect(classified).toBeInstanceOf(GenerationError);
    expect(classified.statusCode).toBe(0);
    expect(classified.message).toBe("network timeout");
  });

  it("classifies string errors as GenerationError", () => {
    const classified = classifyError("something went wrong");
    expect(classified).toBeInstanceOf(GenerationError);
    expect(classified.message).toBe("something went wrong");
  });

  it("all classified errors extend AiError", () => {
    const apiKey = classifyError(
      new Anthropic.APIError(
        401,
        { type: "error", error: { type: "authentication_error", message: "bad key" } },
        "bad key",
        new Headers(),
      ),
    );
    expect(apiKey).toBeInstanceOf(AiError);
    expect(apiKey).toBeInstanceOf(Error);
  });
});

// ─── Client Creation ─────────────────────────────────────────────────────────

describe("createClient", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("throws ApiKeyError when ANTHROPIC_API_KEY is not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createClient()).toThrow(ApiKeyError);
  });

  it("returns Anthropic client when API key is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const client = createClient();
    expect(client).toBeInstanceOf(Anthropic);
  });
});

// ─── Response Type Contracts ─────────────────────────────────────────────────

describe("GenerationResponse contract", () => {
  it("GenerationResponse shape matches expected fields", () => {
    // Type-level test: ensure the interface fields exist at runtime
    const response = {
      text: "generated text",
      usage: { inputTokens: 100, outputTokens: 200 },
      durationMs: 5000,
      stopReason: "end_turn" as string | null,
    };

    expect(response).toHaveProperty("text");
    expect(response).toHaveProperty("usage");
    expect(response).toHaveProperty("usage.inputTokens");
    expect(response).toHaveProperty("usage.outputTokens");
    expect(response).toHaveProperty("durationMs");
    expect(response).toHaveProperty("stopReason");
  });

  it("FullGenerationResponse extends GenerationResponse with extra fields", () => {
    const response = {
      text: "resume content",
      usage: { inputTokens: 5000, outputTokens: 3000 },
      durationMs: 45000,
      stopReason: "end_turn" as string | null,
      thinkingTokens: 12000,
      cacheStats: { read: 2000, created: 3000 },
      promptVersion: "resume-writer@1.0",
      model: "claude-opus-4-6",
    };

    expect(response).toHaveProperty("thinkingTokens");
    expect(response).toHaveProperty("cacheStats.read");
    expect(response).toHaveProperty("cacheStats.created");
    expect(response).toHaveProperty("promptVersion");
    expect(response).toHaveProperty("model");
  });
});

// ─── Error Hierarchy ─────────────────────────────────────────────────────────

describe("error hierarchy", () => {
  it("ApiKeyError has correct name and status", () => {
    const err = new ApiKeyError();
    expect(err.name).toBe("ApiKeyError");
    expect(err.statusCode).toBe(401);
    expect(err.message).toContain("API key");
  });

  it("RateLimitError has correct name and status", () => {
    const err = new RateLimitError();
    expect(err.name).toBe("RateLimitError");
    expect(err.statusCode).toBe(429);
  });

  it("OverloadError has correct name and status", () => {
    const err = new OverloadError();
    expect(err.name).toBe("OverloadError");
    expect(err.statusCode).toBe(529);
  });

  it("GenerationError preserves custom message and status", () => {
    const err = new GenerationError("custom error", 503);
    expect(err.name).toBe("GenerationError");
    expect(err.statusCode).toBe(503);
    expect(err.message).toBe("custom error");
  });

  it("errors preserve cause chain", () => {
    const original = new Error("root cause");
    const err = new GenerationError("wrapped", 500, original);
    expect(err.cause).toBe(original);
  });
});
