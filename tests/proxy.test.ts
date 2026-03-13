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

/** Grab a known-good origin from the exported set for use as a test fixture. */
const KNOWN_ALLOWED_ORIGIN = [...ALLOWED_ORIGINS][0];

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

describe("origin validation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports expected static allowed origins", () => {
    // Verify the exported ALLOWED_ORIGINS set contains exactly the expected entries.
    // These strings are intentionally hardcoded here as contract tests — they assert
    // that production won't silently drop a required origin.
    const expectedOrigins = [
      "https://paulprae.com",
      "https://www.paulprae.com",
      "https://paulprae-com-one.vercel.app",
    ];
    for (const origin of expectedOrigins) {
      expect(ALLOWED_ORIGINS.has(origin)).toBe(true);
    }
    expect(ALLOWED_ORIGINS.size).toBe(expectedOrigins.length);
  });

  it("allows requests with no origin", () => {
    expect(isAllowedOrigin(null)).toBe(true);
  });

  it("isAllowedOrigin accepts every entry in ALLOWED_ORIGINS", () => {
    for (const origin of ALLOWED_ORIGINS) {
      expect(isAllowedOrigin(origin)).toBe(true);
    }
  });

  it("allows Vercel preview URL pattern used by production proxy", () => {
    // NOTE: The Vercel preview regex is internal to isAllowedOrigin and not
    // separately exported. If the regex changes in proxy.ts, this test string
    // may drift — keep it in sync manually.
    expect(isAllowedOrigin("https://paulprae-com-abc123-praeducers-projects.vercel.app")).toBe(
      true,
    );
  });

  it("blocks disallowed external origins", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
  });

  it("allows localhost only in development mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);

    vi.stubEnv("NODE_ENV", "test");
    expect(isAllowedOrigin("http://localhost:3000")).toBe(false);
  });
});

describe("proxy route protection", () => {
  it("returns 403 for disallowed API cross-origin requests", () => {
    const res = proxy(makeRequest("/api/chat", "POST", "https://evil.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 204 preflight with CORS headers for allowed origin", () => {
    const res = proxy(makeRequest("/api/chat", "OPTIONS", KNOWN_ALLOWED_ORIGIN) as never);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(KNOWN_ALLOWED_ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("returns 405 for non-POST API requests", () => {
    const res = proxy(makeRequest("/api/chat", "GET", KNOWN_ALLOWED_ORIGIN) as never);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("POST");
  });

  it("passes allowed POST API requests and sets response CORS header", () => {
    const res = proxy(makeRequest("/api/chat", "POST", KNOWN_ALLOWED_ORIGIN) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(KNOWN_ALLOWED_ORIGIN);
  });

  it("passes non-API requests without API CORS header", () => {
    const res = proxy(makeRequest("/resume", "GET", KNOWN_ALLOWED_ORIGIN) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns 403 for OPTIONS preflight from unauthorized origin", () => {
    const res = proxy(makeRequest("/api/chat", "OPTIONS", "https://evil.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 204 for same-origin OPTIONS (no origin header)", () => {
    const res = proxy(makeRequest("/api/chat", "OPTIONS", null) as never);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("");
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
  it.each([
    [
      "career-chat.system.md",
      ["# Security Rules", "untrusted input", "Never reveal", "system prompt"],
    ],
    ["resume-writer.system.md", ["security_rules", "untrusted user data", "prompt injection"]],
    ["job-tools.system.md", ["# Security Rules", "untrusted input"]],
  ])("%s contains security rules", async (filename, expectedStrings) => {
    const fs = await import("fs");
    const path = await import("path");
    const prompt = fs.readFileSync(path.join(process.cwd(), "lib", "prompts", filename), "utf-8");
    for (const s of expectedStrings) {
      expect(prompt).toContain(s);
    }
  });
});
