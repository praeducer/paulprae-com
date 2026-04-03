/**
 * cron.test.ts — Tests for the cache warmup cron endpoint.
 *
 * Validates auth enforcement and handler shape without making real API calls.
 *
 * Run: npm test -- tests/cron.test.ts
 */

import { describe, it, expect } from "vitest";

// ─── Auth Enforcement ────────────────────────────────────────────────────────

describe("GET /api/cron auth", () => {
  it("exports a GET handler", async () => {
    const { GET } = await import("../app/api/cron/route");
    expect(typeof GET).toBe("function");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("../app/api/cron/route");
    // CRON_SECRET must be set for the check to work correctly
    process.env.CRON_SECRET = "test-secret-value";
    const req = new Request("http://localhost/api/cron");
    const res = await GET(req);
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when Authorization secret is wrong", async () => {
    const { GET } = await import("../app/api/cron/route");
    process.env.CRON_SECRET = "correct-secret";
    const req = new Request("http://localhost/api/cron", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });
});
