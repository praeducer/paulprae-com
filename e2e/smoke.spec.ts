/**
 * E2E smoke tests — verifies critical pages render and basic interactions work.
 *
 * These tests mock the /api/chat endpoint to avoid burning API tokens.
 * Run: npx playwright test
 */

import { test, expect } from "@playwright/test";

// ─── Page Rendering ─────────────────────────────────────────────────────────

test.describe("page rendering", () => {
  test("homepage renders chat interface with welcome message", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Paul Prae", level: 1 })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("text=Principal AI Engineer").first()).toBeVisible();
  });

  test("homepage shows quick action chips", async ({ page }) => {
    await page.goto("/");
    // Chips render after client hydration — wait for one to appear
    await expect(page.getByRole("button", { name: /tailored resume/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("resume page renders with content", async ({ page }) => {
    await page.goto("/resume");
    await expect(page.getByRole("heading", { name: "Paul Prae" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("heading", { name: "Professional Summary" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("resume page has download links", async ({ page }) => {
    await page.goto("/resume");
    const pdfLink = page.locator('a[href*="Resume.pdf"]');
    await expect(pdfLink).toBeVisible({ timeout: 10_000 });
  });

  test("tools page renders with tool chips", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.locator("text=Job Search Tools")).toBeVisible({ timeout: 10_000 });
  });

  test("tools page has noindex meta tag", async ({ page }) => {
    await page.goto("/tools");
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });
});

// ─── Navigation ─────────────────────────────────────────────────────────────

test.describe("navigation", () => {
  test("homepage has link to resume page", async ({ page }) => {
    await page.goto("/");
    const resumeLink = page.locator('a[href="/resume"]').first();
    await expect(resumeLink).toBeVisible({ timeout: 10_000 });
  });
});

// ─── API Validation ─────────────────────────────────────────────────────────

test.describe("API validation", () => {
  test("/api/chat returns 400 for empty body", async ({ request }) => {
    const res = await request.post("/api/chat", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("/api/chat returns 400 for invalid JSON", async ({ request }) => {
    const res = await request.post("/api/chat", {
      headers: { "Content-Type": "application/json" },
      data: "{invalid json}",
    });
    expect(res.status()).toBe(400);
  });

  test("/api/chat returns 400 for empty messages", async ({ request }) => {
    const res = await request.post("/api/chat", { data: { messages: [] } });
    expect(res.status()).toBe(400);
  });
});

// ─── Chat Interaction (Mocked) ──────────────────────────────────────────────

test.describe("chat interaction", () => {
  test("sending a message shows user message in thread", async ({ page }) => {
    // Mock the chat API to return a simple streaming response
    await page.route("**/api/chat", async (route) => {
      // Return a minimal AI SDK UI message stream response
      const body = [
        '0:{"id":"msg-1","type":"start"}',
        '2:{"id":"msg-1","type":"text-start"}',
        '3:{"id":"msg-1","type":"text-delta","delta":"Hello! I\'m Paul\'s AI assistant."}',
        '4:{"id":"msg-1","type":"text-end"}',
        '5:{"id":"msg-1","type":"end"}',
      ].join("\n");

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body,
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Paul Prae", level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Type a message in the composer
    const composer = page.locator('textarea, input[type="text"], [role="textbox"]').first();
    await composer.fill("Tell me about Paul's experience");
    await composer.press("Enter");

    // The user message should appear in the thread
    await expect(page.locator("text=Tell me about Paul's experience")).toBeVisible({
      timeout: 5_000,
    });
  });
});
