/**
 * proxy.test.ts — Tests for Next.js proxy (CORS, origin validation, security headers).
 *
 * Run: npm test -- tests/proxy.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockNextServer = vi.hoisted(() => {
  class MockHeaders {
    private store = new Map<string, string>();

    constructor(initial?: Record<string, string>) {
      if (initial) {
        for (const [key, value] of Object.entries(initial)) {
          this.set(key, value);
        }
      }
    }

    set(key: string, value: string) {
      this.store.set(key.toLowerCase(), value);
    }

    get(key: string) {
      return this.store.get(key.toLowerCase()) ?? null;
    }
  }

  class MockNextResponse {
    status: number;
    headers: MockHeaders;
    body: string | null;

    constructor(
      body: string | null = null,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      this.status = init?.status ?? 200;
      this.headers = new MockHeaders(init?.headers);
      this.body = body;
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }
  }

  return { MockNextResponse };
});

vi.mock("next/server", () => ({
  NextResponse: mockNextServer.MockNextResponse,
  NextRequest: vi.fn(),
}));

import { proxy, isAllowedOrigin, ALLOWED_ORIGINS } from "../proxy";

function makeRequest(pathname: string, method = "POST", origin: string | null = null) {
  return {
    nextUrl: { pathname },
    method,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === "origin") return origin;
        return null;
      },
    },
  };
}

const originalNodeEnv = process.env.NODE_ENV;

describe("origin validation", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("exports expected static allowed origins", () => {
    expect(ALLOWED_ORIGINS.has("https://paulprae.com")).toBe(true);
    expect(ALLOWED_ORIGINS.has("https://www.paulprae.com")).toBe(true);
    expect(ALLOWED_ORIGINS.has("https://paulprae-com-one.vercel.app")).toBe(true);
  });

  it("allows requests with no origin", () => {
    expect(isAllowedOrigin(null)).toBe(true);
  });

  it("allows Vercel preview URL pattern used by production proxy", () => {
    expect(isAllowedOrigin("https://paulprae-com-abc123-praeducers-projects.vercel.app")).toBe(
      true,
    );
  });

  it("blocks disallowed external origins", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
  });

  it("allows localhost only in development mode", () => {
    process.env.NODE_ENV = "development";
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);

    process.env.NODE_ENV = "test";
    expect(isAllowedOrigin("http://localhost:3000")).toBe(false);
  });
});

describe("proxy route protection", () => {
  it("returns 403 for disallowed API cross-origin requests", () => {
    const res = proxy(makeRequest("/api/chat", "POST", "https://evil.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 204 preflight with CORS headers for allowed origin", () => {
    const origin = "https://paulprae.com";
    const res = proxy(makeRequest("/api/chat", "OPTIONS", origin) as never);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("returns 405 for non-POST API requests", () => {
    const res = proxy(makeRequest("/api/chat", "GET", "https://paulprae.com") as never);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("POST");
  });

  it("passes allowed POST API requests and sets response CORS header", () => {
    const origin = "https://paulprae.com";
    const res = proxy(makeRequest("/api/chat", "POST", origin) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("passes non-API requests without API CORS header", () => {
    const res = proxy(makeRequest("/resume", "GET", "https://paulprae.com") as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("Security headers", () => {
  // Verify that vercel.json has the expected security headers configured
  it("vercel.json contains required security headers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf-8"),
    );

    const catchAllHeaders = vercelConfig.headers.find(
      (h: { source: string }) => h.source === "/(.*)",
    );
    expect(catchAllHeaders).toBeDefined();

    const headerNames = catchAllHeaders.headers.map((h: { key: string }) => h.key);
    expect(headerNames).toContain("X-Content-Type-Options");
    expect(headerNames).toContain("X-Frame-Options");
    expect(headerNames).toContain("Strict-Transport-Security");
    expect(headerNames).toContain("Content-Security-Policy");
    expect(headerNames).toContain("Permissions-Policy");
    expect(headerNames).toContain("Referrer-Policy");
  });

  it("vercel.json API routes have no-cache headers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf-8"),
    );

    const apiHeaders = vercelConfig.headers.find(
      (h: { source: string }) => h.source === "/api/(.*)",
    );
    expect(apiHeaders).toBeDefined();

    const headerMap = Object.fromEntries(
      apiHeaders.headers.map((h: { key: string; value: string }) => [h.key, h.value]),
    );
    expect(headerMap["Cache-Control"]).toContain("no-store");
    expect(headerMap["X-Robots-Tag"]).toBe("noindex");
  });
});

describe("Prompt injection defenses", () => {
  it("career-chat system prompt contains security rules", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const prompt = fs.readFileSync(
      path.join(process.cwd(), "lib", "prompts", "career-chat.system.md"),
      "utf-8",
    );
    expect(prompt).toContain("# Security Rules");
    expect(prompt).toContain("untrusted input");
    expect(prompt).toContain("Never reveal");
    expect(prompt).toContain("system prompt");
  });

  it("resume-generator system prompt contains security rules", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const prompt = fs.readFileSync(
      path.join(process.cwd(), "lib", "prompts", "resume-generator.system.md"),
      "utf-8",
    );
    expect(prompt).toContain("# Security Rules");
    expect(prompt).toContain("untrusted user data");
    expect(prompt).toContain("prompt injection");
  });

  it("job-tools system prompt contains security rules", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const prompt = fs.readFileSync(
      path.join(process.cwd(), "lib", "prompts", "job-tools.system.md"),
      "utf-8",
    );
    expect(prompt).toContain("# Security Rules");
    expect(prompt).toContain("untrusted input");
  });
});
