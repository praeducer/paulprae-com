/**
 * chat-api.test.ts — Tests for the chat API route handler.
 *
 * Tests input validation, request hardening, and security controls.
 * Full streaming tests require Anthropic API mocking and are covered by E2E tests.
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

  // ─── Content-Type Validation ──────────────────────────────────────────────

  it("returns 415 for missing Content-Type header", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it("returns 415 for wrong Content-Type", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ messages: [{ id: "1", role: "user", content: "hi" }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  // ─── Per-Message Content Length ───────────────────────────────────────────

  it("returns 400 for a single message exceeding per-message limit", async () => {
    const longContent = "x".repeat(5_000); // Exceeds MAX_MESSAGE_CHARS (4000)
    const res = await POST(
      makeRequest({
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: longContent }] }],
      }),
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("exceeds maximum length");
  });

  it("allows a message at exactly the per-message limit", async () => {
    const content = "x".repeat(4_000); // Exactly MAX_MESSAGE_CHARS
    const res = await POST(
      makeRequest({
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: content }] }],
      }),
    );
    // Should pass validation (will fail later at Anthropic call, not at validation)
    expect(res.status).not.toBe(400);
  });
});
