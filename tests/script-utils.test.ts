import { describe, it, expect, afterEach } from "vitest";
import { isDirectRun, hasForceFlag } from "../lib/script-utils";

describe("isDirectRun", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("returns true when argv[1] matches script name with .ts extension", () => {
    process.argv = ["node", "/path/to/ingest-linkedin.ts"];
    expect(isDirectRun("ingest-linkedin")).toBe(true);
  });

  it("returns true when argv[1] matches script name with .js extension", () => {
    process.argv = ["node", "/path/to/ingest-linkedin.js"];
    expect(isDirectRun("ingest-linkedin")).toBe(true);
  });

  it("returns false when argv[1] does not match", () => {
    process.argv = ["node", "/path/to/generate-resume.ts"];
    expect(isDirectRun("ingest-linkedin")).toBe(false);
  });

  it("returns false when argv[1] is undefined", () => {
    process.argv = ["node"];
    expect(isDirectRun("ingest-linkedin")).toBe(false);
  });

  it("strips extension correctly regardless of extension type", () => {
    process.argv = ["node", "/path/to/release-check.mjs"];
    expect(isDirectRun("release-check")).toBe(true);
  });

  it("does not match partial names (no suffix collision)", () => {
    process.argv = ["node", "/path/to/my-ingest-linkedin.ts"];
    expect(isDirectRun("ingest-linkedin")).toBe(false);
  });
});

describe("hasForceFlag", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("returns true when --force is present", () => {
    process.argv = ["node", "script.ts", "--force"];
    expect(hasForceFlag()).toBe(true);
  });

  it("returns false when --force is absent", () => {
    process.argv = ["node", "script.ts"];
    expect(hasForceFlag()).toBe(false);
  });

  it("returns true when --force is among other flags", () => {
    process.argv = ["node", "script.ts", "--verbose", "--force", "--dry-run"];
    expect(hasForceFlag()).toBe(true);
  });
});
