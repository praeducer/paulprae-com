/**
 * export-resume.ts — Unit tests for the PDF/DOCX export pipeline.
 *
 * Tests cover: markdown comment stripping, format parsing, and output validation.
 * Binary tool tests (Pandoc/Typst) are in tests/pipeline.test.ts since they
 * require system binaries.
 *
 * Run: npm test -- tests/export.test.ts
 *
 * Lessons learned from pipeline development:
 * - HTML comment stripping regex must handle multi-line comments
 * - The Typst stylesheet #show line rule can interfere with H2 underlines
 * - Pandoc/Typst stderr capture is critical for debugging export failures
 * - Zero-byte output check catches silent Pandoc/Typst failures
 */

import { describe, it, expect } from "vitest";
import { stripHtmlComments } from "../lib/markdown.js";
import { SAMPLE_RESUME_MD, SAMPLE_RESUME_CLEAN } from "./fixtures/sample-data.js";

// ─── Markdown Comment Stripping ─────────────────────────────────────────────
// The export pipeline strips HTML comment headers before converting.
// This logic is duplicated in export-resume.ts and page.tsx, so test both patterns.

describe("HTML comment stripping", () => {
  it("strips generation metadata comments", () => {
    const result = stripHtmlComments(SAMPLE_RESUME_MD);
    expect(result).not.toContain("<!-- This file is GENERATED");
    expect(result).not.toContain("<!-- Generated:");
  });

  it("preserves all content after comments", () => {
    const result = stripHtmlComments(SAMPLE_RESUME_MD);
    expect(result).toContain("# Paul Prae");
    expect(result).toContain("## Professional Summary");
    expect(result).toContain("## Professional Experience");
  });

  it("starts with H1 heading after stripping", () => {
    const result = stripHtmlComments(SAMPLE_RESUME_MD);
    expect(result).toMatch(/^# Paul Prae/);
  });

  it("handles content without comments", () => {
    const noComments = "# Paul Prae\n\nSome content.";
    expect(stripHtmlComments(noComments)).toBe(noComments);
  });

  it("handles empty input", () => {
    expect(stripHtmlComments("")).toBe("");
  });
});

// ─── Format Validation ──────────────────────────────────────────────────────

describe("format argument parsing", () => {
  // Test the parsing logic without importing the script (it has side effects)
  const parseFormat = (args: string[]): string => {
    const formatArg = args.find((arg) => arg.startsWith("--format"));
    if (!formatArg) return "all";
    let value: string | undefined;
    if (formatArg.includes("=")) {
      value = formatArg.split("=")[1];
    } else {
      const idx = args.indexOf(formatArg);
      value = args[idx + 1];
    }
    if (value === "pdf" || value === "docx" || value === "all") return value;
    return "invalid";
  };

  it("defaults to 'all' when no format specified", () => {
    expect(parseFormat([])).toBe("all");
  });

  it("parses --format pdf (space-separated)", () => {
    expect(parseFormat(["--format", "pdf"])).toBe("pdf");
  });

  it("parses --format=pdf (equals-separated)", () => {
    expect(parseFormat(["--format=pdf"])).toBe("pdf");
  });

  it("parses --format docx", () => {
    expect(parseFormat(["--format", "docx"])).toBe("docx");
  });

  it("parses --format=all", () => {
    expect(parseFormat(["--format=all"])).toBe("all");
  });

  it("rejects invalid format", () => {
    expect(parseFormat(["--format", "txt"])).toBe("invalid");
  });
});

// ─── Resume Markdown Quality for Export ─────────────────────────────────────
// Validates that the resume markdown will produce good PDF/DOCX output.

describe("resume markdown export readiness", () => {
  const resume = SAMPLE_RESUME_CLEAN;

  it("uses standard markdown headers (not HTML)", () => {
    expect(resume).toMatch(/^# /m);
    expect(resume).toMatch(/^## /m);
    expect(resume).toMatch(/^### /m);
    expect(resume).not.toContain("<h1>");
    expect(resume).not.toContain("<h2>");
  });

  it("uses standard markdown bullets", () => {
    expect(resume).toMatch(/^- /m);
  });

  it("uses --- for horizontal rules", () => {
    expect(resume).toContain("---");
  });

  it("uses **bold** for emphasis (Pandoc-compatible)", () => {
    expect(resume).toMatch(/\*\*[^*]+\*\*/);
  });

  it("does not contain markdown code fences (bad for PDF)", () => {
    expect(resume).not.toContain("```");
  });

  it("does not contain raw HTML (bad for Typst)", () => {
    expect(resume).not.toMatch(/<(?!!--)[a-z]/i); // Allow HTML comments, reject tags
  });
});
