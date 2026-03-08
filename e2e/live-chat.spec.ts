/**
 * live-chat.spec.ts — Optional real API verification.
 *
 * Disabled by default to avoid token/cost usage.
 * Run with: E2E_LIVE_CHAT=1 npx playwright test e2e/live-chat.spec.ts
 */

import { test, expect } from "@playwright/test";

const runLiveChat = process.env.E2E_LIVE_CHAT === "1";

test.describe("live chat (env-gated)", () => {
  test.skip(!runLiveChat, "Set E2E_LIVE_CHAT=1 to run live API chat checks.");

  test("homepage sends message and renders live assistant response", async ({ page }) => {
    await page.goto("/");

    const userPrompt = "Give a concise one-sentence overview of Paul.";
    const chatResponse = page.waitForResponse(
      (res) => res.url().includes("/api/chat") && res.request().method() === "POST",
    );

    const composer = page.getByRole("textbox", { name: "Chat message" });
    await composer.fill(userPrompt);
    await composer.press("Enter");

    await expect(page.getByText(userPrompt)).toBeVisible({ timeout: 10_000 });

    const res = await chatResponse;
    expect(res.status()).toBe(200);

    // Assistant action controls appear only after assistant content exists.
    await expect(page.getByLabel("Copy message").first()).toBeVisible({ timeout: 20_000 });
  });
});
