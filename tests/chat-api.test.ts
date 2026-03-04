/**
 * chat-api.test.ts — Tests for the chat API route handler.
 *
 * Tests input validation only — full streaming tests require
 * Anthropic API mocking and are deferred.
 *
 * Run: npm test -- tests/chat-api.test.ts
 */

import { describe, it, expect } from "vitest";
import { POST } from "../app/api/chat/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
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
});
