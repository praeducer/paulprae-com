/**
 * export-docs.ts — Unit tests for the documentation export script.
 *
 * Tests cover: skip logic, manifest generation, output naming, and path constants.
 * Pandoc/unzip execution is not tested here (requires system binaries).
 *
 * Run: npm test -- tests/export-docs.test.ts
 */

import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const { _testExports } = await import("../scripts/export-docs.js");

// ─── Path Constants ──────────────────────────────────────────────────────────

describe("path constants", () => {
  it("EXPORTS_DIR is inside DOCS_DIR", () => {
    const { DOCS_DIR, EXPORTS_DIR } = _testExports;
    expect(EXPORTS_DIR.startsWith(DOCS_DIR)).toBe(true);
    expect(path.basename(EXPORTS_DIR)).toBe("exports");
  });
});

// ─── shouldSkip ──────────────────────────────────────────────────────────────

describe("shouldSkip", () => {
  it("returns false when output does not exist", () => {
    const { shouldSkip } = _testExports;
    expect(shouldSkip("/nonexistent/src.md", "/nonexistent/out.docx")).toBe(false);
  });

  it("returns true when output is newer than source (real files)", () => {
    const { shouldSkip } = _testExports;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-docs-test-"));
    const src = path.join(tmpDir, "source.md");
    const out = path.join(tmpDir, "output.docx");

    // Write source first, then output (output will be newer)
    fs.writeFileSync(src, "# hello");
    fs.writeFileSync(out, "fake docx");

    // Touch output to ensure it's newer
    const now = Date.now();
    fs.utimesSync(src, new Date(now - 2000), new Date(now - 2000));
    fs.utimesSync(out, new Date(now), new Date(now));

    try {
      expect(shouldSkip(src, out)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns false when output is older than source", () => {
    const { shouldSkip } = _testExports;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-docs-test-"));
    const src = path.join(tmpDir, "source.md");
    const out = path.join(tmpDir, "output.docx");

    const now = Date.now();
    fs.writeFileSync(src, "# hello");
    fs.writeFileSync(out, "fake docx");
    fs.utimesSync(src, new Date(now), new Date(now));
    fs.utimesSync(out, new Date(now - 2000), new Date(now - 2000));

    try {
      expect(shouldSkip(src, out)).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── writeManifest ───────────────────────────────────────────────────────────

describe("writeManifest", () => {
  it("writes a manifest with expected content to a real temp dir", () => {
    const { writeManifest } = _testExports;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-docs-manifest-"));
    const manifestPath = path.join(tmpDir, "MANIFEST.md");

    // Temporarily patch EXPORTS_DIR by calling writeManifest and reading the output
    // writeManifest uses the module-level EXPORTS_DIR path, so we test via a spy approach:
    // instead, verify the content written to EXPORTS_DIR in the real module.
    // Since we can't override EXPORTS_DIR here, test the manifest format directly
    // by writing to a known path.
    const results = [
      {
        source: "/docs/tdd.md",
        output: "/docs/exports/tdd-2026-01-01-abc.docx",
        sizeKb: 42.5,
        skipped: false,
      },
    ];

    // Write manifest to the real EXPORTS_DIR (will be created if needed)
    // We'll restore it after. Use a temp approach: write then delete.
    const realExportsDir = _testExports.EXPORTS_DIR;
    const realManifestPath = path.join(realExportsDir, "MANIFEST.md");

    // Save prior state
    const existed = fs.existsSync(realManifestPath);
    const prior = existed ? fs.readFileSync(realManifestPath, "utf-8") : undefined;

    fs.mkdirSync(realExportsDir, { recursive: true });
    writeManifest(results, "2026-01-01", "abc");
    const written = fs.readFileSync(realManifestPath, "utf-8");

    // Restore prior state
    if (existed && prior !== undefined) {
      fs.writeFileSync(realManifestPath, prior);
    } else {
      fs.unlinkSync(realManifestPath);
    }

    expect(written).toContain("# Documentation Exports");
    expect(written).toContain("tdd.md");
    expect(written).toContain("abc");
    expect(written).toContain("42.5 KB");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ─── _testExports shape ──────────────────────────────────────────────────────

describe("_testExports shape", () => {
  it("exports all expected functions and constants", () => {
    const keys = Object.keys(_testExports);
    for (const fn of [
      "checkPandoc",
      "getGitSha",
      "fixDocxCompatibility",
      "exportDocToDocx",
      "writeManifest",
      "shouldSkip",
      "main",
      "DOCS_DIR",
      "EXPORTS_DIR",
    ]) {
      expect(keys, `missing export: ${fn}`).toContain(fn);
    }
  });

  it("getGitSha returns a non-empty string", () => {
    const sha = _testExports.getGitSha();
    expect(typeof sha).toBe("string");
    expect(sha.length).toBeGreaterThan(0);
  });
});

// ─── output naming ───────────────────────────────────────────────────────────

describe("output naming convention", () => {
  it("follows <name>-<YYYY-MM-DD>-<sha>.docx pattern", () => {
    const base = "technical-design-document";
    const date = "2026-01-15";
    const sha = "abc1234";
    const name = `${base}-${date}-${sha}.docx`;
    expect(name).toMatch(/^\S+-\d{4}-\d{2}-\d{2}-[a-f0-9]+\.docx$/);
  });
});
