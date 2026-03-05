/**
 * chat-api.test.ts — Tests for the chat API route handler.
 *
 * Tests input validation and request hardening. Full streaming tests
 * require Anthropic API mocking and are covered by E2E tests.
 *
 * Run: npm test -- tests/chat-api.test.ts
 */

import { describe, it, expect } from "vitest";
import { POST } from "../app/api/chat/route";

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string, headers?: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody,
  });
}

describe("POST /api/chat", () => {
  // ─── Basic Validation ──────────────────────────────────────────────────────

  it("returns 400 for empty messages array", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing messages", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-array messages", async () => {
    const res = await POST(makeRequest({ messages: "hello" }));
    expect(res.status).toBe(400);
  });

  // ─── JSON Parsing Hardening ────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makeRawRequest("{not valid json}"));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Invalid JSON");
  });

  it("returns 400 for empty body", async () => {
    const res = await POST(makeRawRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 for JSON null body", async () => {
    const res = await POST(makeRawRequest("null"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for JSON array body", async () => {
    const res = await POST(makeRawRequest("[]"));
    expect(res.status).toBe(400);
  });

  // ─── Size and Count Limits ────────────────────────────────────────────────

  it("returns 400 for too many messages", async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      id: `msg-${i}`,
      role: "user",
      content: "hello",
    }));
    const res = await POST(makeRequest({ messages }));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Too many messages");
  });

  it("returns 413 for oversized request body", async () => {
    const largeMessage = "x".repeat(120_000);
    const res = await POST(makeRawRequest(largeMessage));
    expect(res.status).toBe(413);
  });

  it("returns 413 when Content-Length header exceeds limit", async () => {
    const res = await POST(
      makeRequest(
        { messages: [{ id: "1", role: "user", content: "hi" }] },
        {
          "content-length": "200000",
        },
      ),
    );
    expect(res.status).toBe(413);
  });
});
