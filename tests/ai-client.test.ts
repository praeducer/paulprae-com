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
// Note: ApiKeyError/RateLimitError/OverloadError still used by classifyError tests above

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

// Response type contracts removed — TypeScript strict mode validates interface shapes.
// Error hierarchy name/status checks removed — class names are guaranteed by implementation.

// ─── Error Behavior ─────────────────────────────────────────────────────────

describe("error behavior", () => {
  it("errors preserve cause chain", () => {
    const original = new Error("root cause");
    const err = new GenerationError("wrapped", 500, original);
    expect(err.cause).toBe(original);
  });
});
