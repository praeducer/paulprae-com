/**
 * lib/resume-parser.ts — Unit tests for resume section parsing and assembly.
 *
 * Run: npm test -- tests/resume-parser.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseResume, assembleResume } from "../lib/resume-parser.js";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const SAMPLE_RESUME = `# Paul Prae

Principal AI Engineer & Architect

## Professional Experience

### Senior AI Engineer — Arine (Sep 2023 – Present)
- Built ML pipelines for healthcare optimization
- Led team of 5 engineers

### Software Engineer — Slalom (2019 – 2023)
- Delivered enterprise solutions for Fortune 500 clients

## Technical Skills

**AI & Machine Learning:** PyTorch, TensorFlow, Claude API

**Cloud & Infrastructure:** AWS, GCP, Azure

## Education

### Georgia Institute of Technology
B.S. Computer Science (2008 – 2012)
`;

const MINIMAL_RESUME = `# Name

Summary paragraph here.
`;

const NO_SECTIONS_RESUME = `Just a paragraph of text with no headings at all.

Another paragraph.
`;

// ─── parseResume() ───────────────────────────────────────────────────────────

describe("parseResume()", () => {
  it("extracts front matter before the first ## heading", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    expect(parsed.frontMatter).toContain("# Paul Prae");
    expect(parsed.frontMatter).toContain("Principal AI Engineer");
    expect(parsed.frontMatter).not.toContain("## ");
  });

  it("extracts all H2 sections", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    expect(parsed.sections).toHaveLength(3);
    expect(parsed.sections.map((s) => s.heading)).toEqual([
      "Professional Experience",
      "Technical Skills",
      "Education",
    ]);
  });

  it("generates correct slugs for sections", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    expect(parsed.sections.map((s) => s.slug)).toEqual([
      "professional-experience",
      "technical-skills",
      "education",
    ]);
  });

  it("preserves section content including the ## heading line", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    const experience = parsed.sections[0];
    expect(experience.content).toContain("## Professional Experience");
    expect(experience.content).toContain("Arine");
    expect(experience.content).toContain("Slalom");
  });

  it("counts non-empty lines per section", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    // Professional Experience: ## heading + 2 H3 lines + 3 bullet lines = 6+
    expect(parsed.sections[0].lineCount).toBeGreaterThan(3);
  });

  it("stores the raw markdown", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    expect(parsed.raw).toBe(SAMPLE_RESUME);
  });

  it("handles markdown with no H2 sections", () => {
    const parsed = parseResume(NO_SECTIONS_RESUME);
    expect(parsed.sections).toHaveLength(0);
    expect(parsed.frontMatter).toContain("Just a paragraph");
  });

  it("handles minimal resume with only front matter", () => {
    const parsed = parseResume(MINIMAL_RESUME);
    expect(parsed.sections).toHaveLength(0);
    expect(parsed.frontMatter).toContain("# Name");
    expect(parsed.frontMatter).toContain("Summary paragraph");
  });

  it("handles empty string", () => {
    const parsed = parseResume("");
    expect(parsed.sections).toHaveLength(0);
    expect(parsed.frontMatter).toBe("");
    expect(parsed.raw).toBe("");
  });

  it("does not split on H3 or other heading levels", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    // H3 headings (### Senior AI Engineer) should stay inside their parent section
    const experience = parsed.sections[0];
    expect(experience.content).toContain("### Senior AI Engineer");
    expect(experience.content).toContain("### Software Engineer");
  });
});

// ─── assembleResume() ────────────────────────────────────────────────────────

describe("assembleResume()", () => {
  it("round-trips: parse → assemble preserves content", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    const assembled = assembleResume(parsed.frontMatter, parsed.sections);

    // Both should contain the same key content
    expect(assembled).toContain("# Paul Prae");
    expect(assembled).toContain("## Professional Experience");
    expect(assembled).toContain("## Technical Skills");
    expect(assembled).toContain("## Education");
    expect(assembled).toContain("Arine");
    expect(assembled).toContain("Georgia Institute of Technology");
  });

  it("produces valid markdown with blank lines between sections", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    const assembled = assembleResume(parsed.frontMatter, parsed.sections);

    // Every ## heading should be preceded by a blank line
    const lines = assembled.split("\n");
    const h2Indices = lines
      .map((line, i) => (line.startsWith("## ") ? i : -1))
      .filter((i) => i > 0);

    for (const idx of h2Indices) {
      expect(lines[idx - 1].trim()).toBe("");
    }
  });

  it("ends with a trailing newline", () => {
    const parsed = parseResume(SAMPLE_RESUME);
    const assembled = assembleResume(parsed.frontMatter, parsed.sections);
    expect(assembled.endsWith("\n")).toBe(true);
  });

  it("handles empty sections array", () => {
    const assembled = assembleResume("# Just a title\n", []);
    expect(assembled).toContain("# Just a title");
    expect(assembled.endsWith("\n")).toBe(true);
  });

  it("allows mixing sections from different parsed resumes", () => {
    const resumeA = parseResume(SAMPLE_RESUME);
    const alternateResume = `# Other Person

## Technical Skills

**Languages:** Rust, Go, Python

## Awards

Winner of XYZ Competition
`;

    const resumeB = parseResume(alternateResume);

    // Take front matter from A, skills from B, experience from A
    const composite = assembleResume(resumeA.frontMatter, [
      resumeA.sections[0], // Professional Experience from A
      resumeB.sections[0], // Technical Skills from B
    ]);

    expect(composite).toContain("# Paul Prae");
    expect(composite).toContain("## Professional Experience");
    expect(composite).toContain("Rust, Go, Python"); // From B
    expect(composite).not.toContain("## Education"); // Not included
  });
});
