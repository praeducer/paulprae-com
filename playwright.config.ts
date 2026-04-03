import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Keep default suite fast/stable; run multi-browser matrix on demand.
const runFullMatrix = process.env.PW_FULL_MATRIX === "1";
const port = process.env.PW_PORT ?? "3011";
// BASE_URL lets you run smoke tests against a live deployment without a local server.
// Example: BASE_URL=https://paulprae-com-git-feat-interview-booking-cta-praeducers-projects.vercel.app npx playwright test
// Example: BASE_URL=https://paulprae.com npx playwright test
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: runFullMatrix
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
        {
          name: "mobile-chrome",
          use: { ...devices["Pixel 5"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],
  // Skip local webServer when BASE_URL points to a live deployment.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Use production server for E2E stability.
        // Turbopack dev-mode startup has shown intermittent panics in CI/local.
        command: `npm run build && npm run start -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 240_000,
      },
});
