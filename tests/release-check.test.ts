/**
 * scripts/release-check.ts — Unit tests for the release checklist.
 *
 * Tests cover: file existence checks, size formatting, build output validation.
 *
 * Run: npm test -- tests/release-check.test.ts
 */

import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { _testExports } from "../scripts/release-check.js";
import { PATHS, RESUME_FILE_BASE } from "../lib/config.js";

const {
  checkDataFiles,
  checkPublicDownloads,
  checkBuildOutput,
  fileExists,
  fileSize,
  fileHash,
  humanSize,
} = _testExports;

// ─── humanSize formatting ────────────────────────────────────────────────────

describe("humanSize", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(humanSize(0)).toBe("0 B");
  });

  it("returns bytes for values under 1024", () => {
    expect(humanSize(500)).toBe("500 B");
    expect(humanSize(1)).toBe("1 B");
  });

  it("returns KB for values >= 1024", () => {
    expect(humanSize(1024)).toBe("1 KB");
    expect(humanSize(65536)).toBe("64 KB");
    expect(humanSize(1500)).toBe("1 KB"); // rounds down
  });

  it("rounds KB values", () => {
    expect(humanSize(1536)).toBe("2 KB"); // 1.5 rounds up
    expect(humanSize(10240)).toBe("10 KB");
  });
});

// ─── fileExists ──────────────────────────────────────────────────────────────

describe("fileExists", () => {
  it("returns true for an existing file", () => {
    expect(fileExists(path.join(process.cwd(), "package.json"))).toBe(true);
  });

  it("returns false for a non-existent file", () => {
    expect(fileExists(path.join(process.cwd(), "this-file-does-not-exist.xyz"))).toBe(false);
  });

  it("returns false for a directory", () => {
    expect(fileExists(path.join(process.cwd(), "app"))).toBe(false);
  });
});

// ─── fileHash ────────────────────────────────────────────────────────────────

describe("fileHash", () => {
  it("returns a 12-character hex string for existing file", () => {
    const hash = fileHash(path.join(process.cwd(), "package.json"));
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });

  it("returns empty string for non-existent file", () => {
    expect(fileHash(path.join(process.cwd(), "nonexistent.xyz"))).toBe("");
  });

  it("returns consistent hash for same file", () => {
    const pkg = path.join(process.cwd(), "package.json");
    expect(fileHash(pkg)).toBe(fileHash(pkg));
  });

  it("returns different hashes for different files", () => {
    const h1 = fileHash(path.join(process.cwd(), "package.json"));
    const h2 = fileHash(path.join(process.cwd(), "tsconfig.json"));
    expect(h1).not.toBe(h2);
  });
});

// ─── fileSize ────────────────────────────────────────────────────────────────

describe("fileSize", () => {
  it("returns positive bytes for existing file", () => {
    expect(fileSize(path.join(process.cwd(), "package.json"))).toBeGreaterThan(0);
  });

  it("returns 0 for non-existent file", () => {
    expect(fileSize(path.join(process.cwd(), "nonexistent.xyz"))).toBe(0);
  });
});

// ─── checkDataFiles ──────────────────────────────────────────────────────────

describe("checkDataFiles", () => {
  // Both career-data.json and Paul-Prae-Resume.md exist in this repo
  it("passes when data files exist", () => {
    const result = checkDataFiles();
    expect(result.passed).toBe(true);
    expect(result.detail).toContain(RESUME_FILE_BASE);
  });
});

// ─── checkPublicDownloads ────────────────────────────────────────────────────

describe("checkPublicDownloads", () => {
  // Public download files should exist in committed repo
  const mdExists = fs.existsSync(PATHS.publicMd);

  it.skipIf(!mdExists)("reports MD size when public file exists", () => {
    const result = checkPublicDownloads();
    expect(result.detail).toContain("MD");
  });
});

// ─── checkBuildOutput ────────────────────────────────────────────────────────

describe("checkBuildOutput", () => {
  const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
  const buildExists = fs.existsSync(buildIdPath);

  it.skipIf(!buildExists)("passes when build output exists", () => {
    const result = checkBuildOutput();
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("BUILD_ID present");
  });

  it.skipIf(buildExists)("fails gracefully when no build output", () => {
    const result = checkBuildOutput();
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("not found");
  });
});
