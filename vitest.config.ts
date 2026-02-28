import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "out", ".next"],
    testTimeout: 30_000,
    // Silence console.log/warn from pipeline scripts during tests
    silent: false,
  },
});
