/**
 * scripts/validate-docs.ts — Unit tests for the documentation quality check.
 *
 * Tests cover: link extraction, heading slugification, link validation,
 * required docs checking, and full link scanning.
 *
 * Run: npm test -- tests/validate-docs.test.ts
 */

import { describe, it, expect } from "vitest";
import path from "path";
import { _testExports } from "../scripts/validate-docs.js";

const {
  extractLinks,
  extractHeadings,
  headingToSlug,
  validateLink,
  checkRequiredDocs,
  checkLinks,
  findMarkdownFiles,
  REQUIRED_DOCS,
} = _testExports;

// ─── headingToSlug ──────────────────────────────────────────────────────────

describe("headingToSlug", () => {
  it("converts simple heading to slug", () => {
    expect(headingToSlug("Getting Started")).toBe("getting-started");
  });

  it("removes special characters", () => {
    expect(headingToSlug("What's New?")).toBe("whats-new");
  });

  it("collapses em dash into single hyphen", () => {
    expect(headingToSlug("Phase 1 — Current")).toBe("phase-1-current");
  });

  it("handles single word", () => {
    expect(headingToSlug("Overview")).toBe("overview");
  });

  it("trims leading and trailing hyphens", () => {
    expect(headingToSlug("-Hello World-")).toBe("hello-world");
  });
});

// ─── extractLinks ───────────────────────────────────────────────────────────

describe("extractLinks", () => {
  it("extracts relative file links", () => {
    const links = extractLinks("[see docs](docs/README.md)");
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ text: "see docs", target: "docs/README.md" });
  });

  it("extracts fragment-only links", () => {
    const links = extractLinks("[section](#getting-started)");
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ text: "section", target: "#getting-started" });
  });

  it("extracts file links with fragments", () => {
    const links = extractLinks("[setup](README.md#getting-started)");
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ text: "setup", target: "README.md#getting-started" });
  });

  it("skips external URLs", () => {
    const content = `
      [Google](https://google.com)
      [HTTP](http://example.com)
      [local](./docs/README.md)
    `;
    const links = extractLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("./docs/README.md");
  });

  it("skips mailto links", () => {
    const links = extractLinks("[email](mailto:test@example.com)");
    expect(links).toHaveLength(0);
  });

  it("extracts multiple links", () => {
    const content = "[a](file1.md) and [b](file2.md)";
    const links = extractLinks(content);
    expect(links).toHaveLength(2);
  });

  it("returns empty array for content with no links", () => {
    expect(extractLinks("No links here.")).toEqual([]);
  });
});

// ─── extractHeadings ────────────────────────────────────────────────────────

describe("extractHeadings", () => {
  it("extracts H1-H6 headings as slugs", () => {
    const content =
      "# Title\n## Section One\n### Sub Section\n#### Deep\n##### Deeper\n###### Deepest";
    const slugs = extractHeadings(content);
    expect(slugs).toEqual(["title", "section-one", "sub-section", "deep", "deeper", "deepest"]);
  });

  it("returns empty array for content with no headings", () => {
    expect(extractHeadings("Just some text.")).toEqual([]);
  });

  it("handles headings with special characters", () => {
    const slugs = extractHeadings("## What's New?");
    expect(slugs).toEqual(["whats-new"]);
  });
});

// ─── validateLink ───────────────────────────────────────────────────────────

describe("validateLink", () => {
  const root = process.cwd();
  const readmePath = path.join(root, "README.md");

  it("validates existing file link as valid", () => {
    const result = validateLink(readmePath, { text: "contributing", target: "CONTRIBUTING.md" });
    expect(result.valid).toBe(true);
  });

  it("detects broken file link", () => {
    const result = validateLink(readmePath, {
      text: "missing",
      target: "this-does-not-exist.md",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("file not found");
  });

  it("validates directory link as valid", () => {
    const result = validateLink(readmePath, { text: "docs", target: "docs/" });
    expect(result.valid).toBe(true);
  });
});

// ─── findMarkdownFiles ──────────────────────────────────────────────────────

describe("findMarkdownFiles", () => {
  it("finds markdown files in the repo", () => {
    const files = findMarkdownFiles(process.cwd());
    expect(files.length).toBeGreaterThan(0);

    // Should include README.md
    const hasReadme = files.some((f) => f.endsWith("README.md"));
    expect(hasReadme).toBe(true);
  });

  it("excludes node_modules", () => {
    const files = findMarkdownFiles(process.cwd());
    const inNodeModules = files.some((f) => f.includes("node_modules"));
    expect(inNodeModules).toBe(false);
  });
});

// ─── checkRequiredDocs ──────────────────────────────────────────────────────

describe("checkRequiredDocs", () => {
  it("returns a result with required fields", () => {
    const result = checkRequiredDocs();
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("detail");
    expect(result).toHaveProperty("durationMs");
    expect(result.name).toBe("Required docs");
  });

  it("passes when all required docs exist", () => {
    const result = checkRequiredDocs();
    expect(result.passed).toBe(true);
    expect(result.detail).toContain(`${REQUIRED_DOCS.length} required docs present`);
  });
});

// ─── checkLinks ─────────────────────────────────────────────────────────────

describe("checkLinks", () => {
  it("returns a result with required fields", () => {
    const result = checkLinks();
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("detail");
    expect(result).toHaveProperty("durationMs");
    expect(result.name).toBe("Internal links");
  });

  it("passes with current repo state (no broken links)", () => {
    const result = checkLinks();
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("all valid");
  });
});
