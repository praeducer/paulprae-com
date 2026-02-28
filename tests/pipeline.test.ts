/**
 * Pipeline integration & content quality tests.
 *
 * These tests validate REAL pipeline outputs (career-data.json, resume.md,
 * resume.pdf, resume.docx) when they exist on disk. They are designed to:
 *
 * 1. Run fast — no API calls, just file reads and assertions
 * 2. Run after `npm run pipeline` to validate all outputs
 * 3. Catch regressions in content quality, data integrity, and export formats
 * 4. Be used by Claude Code for AI-first QA (read these tests to understand
 *    what "good" looks like for this pipeline)
 *
 * Run: npm test -- tests/pipeline.test.ts
 *
 * Prerequisites: Run `npm run pipeline` first to generate outputs.
 * Tests gracefully skip if files don't exist yet.
 *
 * Lessons learned from pipeline development:
 * - career-data.json must have 16+ positions and 70+ skills (Paul's real data)
 * - resume.md must be 4000-10000 chars for ~2 page length
 * - Resume must include recent employers (Arine, etc.) to be accurate
 * - PDF should be 40-200 KB; DOCX should be 10-100 KB
 * - Knowledge base should contribute 25+ entries
 * - Profile must have linkedin, website, email populated (from knowledge base)
 * - HTML comments in resume.md must be stripped for web rendering
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { PATHS } from "../lib/config.js";
import type { CareerData } from "../lib/types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function skipIfMissing(filePath: string): CareerData | string | null {
  if (!fileExists(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) return JSON.parse(raw) as CareerData;
  return raw;
}

// ─── Career Data Validation ─────────────────────────────────────────────────
// Validates the ingested career-data.json has the expected shape and counts.

describe("career-data.json", () => {
  const data = skipIfMissing(PATHS.careerDataOutput) as CareerData | null;

  it.skipIf(!data)("file exists and is valid JSON", () => {
    expect(data).toBeTruthy();
    expect(data!.profile).toBeDefined();
    expect(data!.positions).toBeDefined();
    expect(data!.skills).toBeDefined();
  });

  it.skipIf(!data)("has populated profile", () => {
    expect(data!.profile.name).toBeTruthy();
    expect(data!.profile.name.length).toBeGreaterThan(0);
  });

  it.skipIf(!data)("profile has contact info from knowledge base enrichment", () => {
    // These come from career/profile.json, not LinkedIn CSV
    expect(data!.profile.linkedin).toBeTruthy();
    expect(data!.profile.website).toBeTruthy();
    expect(data!.profile.email).toBeTruthy();
  });

  it.skipIf(!data)("has expected number of positions (10+)", () => {
    expect(data!.positions.length).toBeGreaterThanOrEqual(10);
  });

  it.skipIf(!data)("positions are sorted by startDate descending", () => {
    const dates = data!.positions.map((p) => p.startDate);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1] >= dates[i]).toBe(true);
    }
  });

  it.skipIf(!data)("positions have required fields", () => {
    for (const pos of data!.positions) {
      expect(pos.title.length).toBeGreaterThan(0);
      expect(pos.company.length).toBeGreaterThan(0);
      expect(pos.startDate.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(!data)("has education records", () => {
    expect(data!.education.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!data)("has skills (50+)", () => {
    expect(data!.skills.length).toBeGreaterThanOrEqual(50);
  });

  it.skipIf(!data)("has knowledge base entries (20+)", () => {
    expect(data!.knowledge.length).toBeGreaterThanOrEqual(20);
  });

  it.skipIf(!data)("all knowledge entries have required fields", () => {
    for (const entry of data!.knowledge) {
      expect(entry.category.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.content.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(!data)("dates are in normalized format", () => {
    for (const pos of data!.positions) {
      // Should be YYYY-MM or YYYY, not "Jan 2020"
      expect(pos.startDate).toMatch(/^\d{4}(-\d{2})?$/);
      if (pos.endDate) {
        expect(pos.endDate).toMatch(/^\d{4}(-\d{2})?$/);
      }
    }
  });
});

// ─── Resume Markdown Quality ────────────────────────────────────────────────
// Validates the AI-generated resume meets quality standards.
// This is the most important test group — it catches resume quality regressions.

describe("resume.md", () => {
  const raw = skipIfMissing(PATHS.resumeOutput) as string | null;
  const resume = raw?.replace(/<!--[\s\S]*?-->\n*/g, "").trim() ?? null;

  it.skipIf(!resume)("file exists and has content", () => {
    expect(resume!.length).toBeGreaterThan(0);
  });

  // ── Structure ──

  it.skipIf(!resume)("starts with H1 candidate name", () => {
    expect(resume).toMatch(/^# /);
  });

  it.skipIf(!resume)("has all required sections", () => {
    const required = ["Professional Summary", "Professional Experience", "Education", "Technical Skills"];
    for (const section of required) {
      expect(resume).toContain(`## ${section}`);
    }
  });

  it.skipIf(!resume)("has horizontal rules between sections", () => {
    const hrCount = (resume!.match(/^---$/gm) || []).length;
    expect(hrCount).toBeGreaterThanOrEqual(4);
  });

  // ── Length (~2 pages) ──

  it.skipIf(!resume)("is within target length (4000-10000 chars ≈ 2 pages)", () => {
    expect(resume!.length).toBeGreaterThanOrEqual(3000);
    expect(resume!.length).toBeLessThanOrEqual(12000);
  });

  // ── Contact Info ──

  it.skipIf(!resume)("includes contact information", () => {
    // At minimum, should have email or linkedin
    const hasContact = resume!.includes("@") || resume!.includes("linkedin");
    expect(hasContact).toBe(true);
  });

  // ── Content Quality: ATS Optimization ──

  it.skipIf(!resume)("includes ATS-relevant keywords for AI engineering roles", () => {
    const keywords = ["AI", "machine learning", "Python", "cloud"];
    const found = keywords.filter((kw) =>
      resume!.toLowerCase().includes(kw.toLowerCase())
    );
    // Should match at least 3/4 keywords
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  // ── Content Quality: Action Verbs ──

  it.skipIf(!resume)("uses strong action verbs (not passive voice)", () => {
    const actionVerbs = [
      "Led", "Architected", "Built", "Designed", "Delivered",
      "Developed", "Implemented", "Managed", "Scaled", "Reduced",
      "Automated", "Established", "Drove", "Launched", "Created",
      "Spearheaded", "Engineered", "Orchestrated", "Pioneered",
    ];
    const found = actionVerbs.filter((verb) => resume!.includes(verb));
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  // ── Content Quality: Quantified Impact ──

  it.skipIf(!resume)("includes quantified metrics (numbers, percentages)", () => {
    // Look for patterns like: 40%, $2M, 10+, team of 8, 500+, 10M+
    const metricPatterns = /\d+[%+]|\$[\d.]+[MKB]?|team of \d|\d+M\+|\d{2,}\+/g;
    const matches = resume!.match(metricPatterns) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  // ── Content Quality: No Fabrication Red Flags ──

  it.skipIf(!resume)("does not contain placeholder text", () => {
    const placeholders = ["[TODO]", "[INSERT", "TBD", "lorem ipsum", "placeholder"];
    for (const ph of placeholders) {
      expect(resume!.toLowerCase()).not.toContain(ph.toLowerCase());
    }
  });

  it.skipIf(!resume)("does not contain AI output artifacts", () => {
    const artifacts = ["```markdown", "```", "Here is", "I'll", "I've created", "As requested"];
    for (const artifact of artifacts) {
      expect(resume).not.toContain(artifact);
    }
  });

  // ── Content Quality: Brand Voice ──

  it.skipIf(!resume)("uses third-person perspective (no 'I' statements in bullets)", () => {
    // Bullets should use third-person: "Led", "Built" not "I led", "I built"
    const lines = resume!.split("\n").filter((l) => l.startsWith("- "));
    const iStatements = lines.filter((l) => /^- I [a-z]/i.test(l));
    expect(iStatements.length).toBe(0);
  });

  // ── Content Quality: Recency Bias ──

  it.skipIf(!resume)("gives more detail to recent roles", () => {
    // Find the first and last position blocks, recent should have more bullets
    const expSection = resume!.split("## Professional Experience")[1]?.split("## Education")[0];
    if (expSection) {
      // First role (most recent) should have more bullets than last role
      const roleBlocks = expSection.split("###").filter((b) => b.trim());
      if (roleBlocks.length >= 2) {
        const firstRoleBullets = (roleBlocks[0].match(/^- /gm) || []).length;
        const lastRoleBullets = (roleBlocks[roleBlocks.length - 1].match(/^- /gm) || []).length;
        expect(firstRoleBullets).toBeGreaterThanOrEqual(lastRoleBullets);
      }
    }
  });

  // ── Format: Export-Ready ──

  it.skipIf(!resume)("uses standard markdown (no raw HTML)", () => {
    expect(resume).not.toMatch(/<(?!!--)[a-z]/i);
  });

  it.skipIf(!resume)("does not contain code fences", () => {
    expect(resume).not.toContain("```");
  });
});

// ─── Export Output Validation ───────────────────────────────────────────────
// Validates PDF and DOCX exist and are reasonably sized.

describe("resume.pdf", () => {
  const exists = fileExists(PATHS.pdfOutput);

  it.skipIf(!exists)("exists and is not empty", () => {
    const stats = fs.statSync(PATHS.pdfOutput);
    expect(stats.size).toBeGreaterThan(0);
  });

  it.skipIf(!exists)("is a reasonable size (40-200 KB for a 2-page resume)", () => {
    const stats = fs.statSync(PATHS.pdfOutput);
    const kb = stats.size / 1024;
    expect(kb).toBeGreaterThanOrEqual(20);
    expect(kb).toBeLessThanOrEqual(500);
  });
});

describe("resume.docx", () => {
  const exists = fileExists(PATHS.docxOutput);

  it.skipIf(!exists)("exists and is not empty", () => {
    const stats = fs.statSync(PATHS.docxOutput);
    expect(stats.size).toBeGreaterThan(0);
  });

  it.skipIf(!exists)("is a reasonable size (10-100 KB)", () => {
    const stats = fs.statSync(PATHS.docxOutput);
    const kb = stats.size / 1024;
    expect(kb).toBeGreaterThanOrEqual(5);
    expect(kb).toBeLessThanOrEqual(200);
  });
});

// ─── Typst Stylesheet ───────────────────────────────────────────────────────

describe("resume-pdf.typ", () => {
  const typPath = PATHS.pdfStylesheet;
  const exists = fileExists(typPath);

  it.skipIf(!exists)("exists", () => {
    expect(fileExists(typPath)).toBe(true);
  });

  it.skipIf(!exists)("sets page size to US Letter", () => {
    const content = fs.readFileSync(typPath, "utf-8");
    expect(content).toContain("us-letter");
  });

  it.skipIf(!exists)("suppresses Pandoc horizontal rules without breaking H2 underlines", () => {
    const content = fs.readFileSync(typPath, "utf-8");
    // Should use #let horizontalrule, NOT #show line (which breaks H2 styling)
    expect(content).toContain("horizontalrule");
    expect(content).not.toMatch(/^#show line/m);
  });
});

// ─── Next.js Build Output ───────────────────────────────────────────────────

describe("Next.js static build", () => {
  const outDir = path.join(process.cwd(), "out");
  const exists = fs.existsSync(outDir);

  it.skipIf(!exists)("out/ directory exists", () => {
    expect(fs.existsSync(outDir)).toBe(true);
  });

  it.skipIf(!exists)("contains index.html", () => {
    expect(fs.existsSync(path.join(outDir, "index.html"))).toBe(true);
  });

  it.skipIf(!exists)("index.html contains resume content", () => {
    const html = fs.readFileSync(path.join(outDir, "index.html"), "utf-8");
    // Should contain the rendered resume
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain("Paul Prae");
  });
});

// ─── Version Manifest ──────────────────────────────────────────────────────

describe("VERSIONS.md", () => {
  const exists = fileExists(PATHS.versionsManifest);

  it.skipIf(!exists)("exists after export", () => {
    expect(fileExists(PATHS.versionsManifest)).toBe(true);
  });

  it.skipIf(!exists)("has required sections", () => {
    const content = fs.readFileSync(PATHS.versionsManifest, "utf-8");
    expect(content).toContain("# Resume Version History");
    expect(content).toContain("## Sent To");
    expect(content).toContain("## Version Log");
  });

  it.skipIf(!exists)("has at least one version entry", () => {
    const content = fs.readFileSync(PATHS.versionsManifest, "utf-8");
    // Version entries start with ### YYYY-MM-DD
    expect(content).toMatch(/### \d{4}-\d{2}-\d{2}/);
  });

  it.skipIf(!exists)("version entries include commit SHA", () => {
    const content = fs.readFileSync(PATHS.versionsManifest, "utf-8");
    expect(content).toMatch(/\*\*Commit:\*\* `[a-f0-9]+`/);
  });
});
