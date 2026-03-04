import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "out", ".next"],
    environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
    testTimeout: 30_000,
    // Silence console.log/warn from pipeline scripts during tests
    silent: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
