/**
 * generate-resume.ts — Unit tests for Claude API resume generation.
 *
 * Tests cover: system prompt quality, user message construction,
 * post-generation validation, and content quality checks.
 *
 * NOTE: These tests do NOT call the Claude API. They test the prompt
 * engineering, message construction, and validation logic around the API call.
 * For live API tests, see tests/pipeline.test.ts (requires ANTHROPIC_API_KEY).
 *
 * Run: npm test -- tests/generate.test.ts
 *
 * Lessons learned from pipeline development:
 * - System prompt must be >1024 tokens for prompt caching to activate
 * - Streaming API is required for operations >10 minutes (Opus + max effort)
 * - Post-generation validation catches missing sections before deployment
 * - Knowledge base should be separated from core data in the user message
 * - Thinking token estimation is approximate (char count / 4)
 */

import { describe, it, expect } from "vitest";
import { _testExports } from "../scripts/generate-resume.js";
import { SAMPLE_CAREER_DATA, SAMPLE_RESUME_CLEAN } from "./fixtures/sample-data.js";

const { SYSTEM_PROMPT, buildUserMessage, validateResumeOutput } = _testExports;

// ─── System Prompt Quality ──────────────────────────────────────────────────
// The system prompt is the foundation of resume quality. These tests ensure
// critical instructions survive edits.

describe("SYSTEM_PROMPT", () => {
  it("includes brand voice guidelines", () => {
    expect(SYSTEM_PROMPT).toContain("Brand Voice Guidelines");
    expect(SYSTEM_PROMPT).toContain("Confident, technically precise, action-oriented");
  });

  it("includes target roles and compensation", () => {
    expect(SYSTEM_PROMPT).toContain("Principal AI Engineer");
    expect(SYSTEM_PROMPT).toContain("Solutions Architect");
    expect(SYSTEM_PROMPT).toContain("$225,000+");
  });

  it("includes target companies", () => {
    expect(SYSTEM_PROMPT).toContain("Anthropic");
    expect(SYSTEM_PROMPT).toContain("NVIDIA");
    expect(SYSTEM_PROMPT).toContain("Microsoft");
  });

  it("includes resume format structure", () => {
    expect(SYSTEM_PROMPT).toContain("Professional Summary");
    expect(SYSTEM_PROMPT).toContain("Professional Experience");
    expect(SYSTEM_PROMPT).toContain("Education");
    expect(SYSTEM_PROMPT).toContain("Technical Skills");
  });

  it("includes quality criteria", () => {
    expect(SYSTEM_PROMPT).toContain("ATS Optimization");
    expect(SYSTEM_PROMPT).toContain("Quantified Impact");
    expect(SYSTEM_PROMPT).toContain("No Fabrication");
    expect(SYSTEM_PROMPT).toContain("Approximately 2 pages");
  });

  it("includes output format instructions", () => {
    expect(SYSTEM_PROMPT).toContain("Output ONLY the Markdown resume content");
    expect(SYSTEM_PROMPT).toContain("Start directly with the H1 heading");
  });

  it("includes STAR method instruction", () => {
    expect(SYSTEM_PROMPT).toContain("STAR method");
  });

  it("prohibits fabrication", () => {
    expect(SYSTEM_PROMPT).toContain("Only use data provided");
  });

  it("is long enough for prompt caching (>1024 tokens ≈ 4000 chars)", () => {
    // Anthropic prompt caching requires >1024 tokens. System prompt is ~2000 tokens.
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(4000);
  });
});

// ─── User Message Construction ──────────────────────────────────────────────

describe("buildUserMessage", () => {
  it("includes core career data section", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    expect(msg).toContain("## Core Career Data");
    expect(msg).toContain("primary factual source");
  });

  it("includes knowledge base section when entries exist", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    expect(msg).toContain("## Supplementary Knowledge Base");
    expect(msg).toContain("curated context entries");
  });

  it("excludes knowledge base section when empty", () => {
    const noKnowledge = { ...SAMPLE_CAREER_DATA, knowledge: [] };
    const msg = buildUserMessage(noKnowledge);
    expect(msg).not.toContain("## Supplementary Knowledge Base");
  });

  it("includes position data in JSON", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    expect(msg).toContain("Acme AI Corp");
    expect(msg).toContain("Principal AI Engineer");
  });

  it("includes profile data in JSON", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    expect(msg).toContain("Paul Prae");
    expect(msg).toContain("paul@example.com");
  });

  it("separates knowledge from core data (not duplicated)", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    // Core data JSON should not contain knowledge entries as a top-level key
    const coreSection = msg.split("## Supplementary Knowledge Base")[0];
    // Find the JSON block in the core section and parse it
    const jsonMatch = coreSection.match(/\{[\s\S]*\}/);
    expect(jsonMatch).toBeTruthy();
    const coreJson = JSON.parse(jsonMatch![0]);
    expect(coreJson).not.toHaveProperty("knowledge");
  });
});

// ─── Post-Generation Validation ─────────────────────────────────────────────
// Validates the generated resume meets structural requirements.

describe("validateResumeOutput", () => {
  it("returns no warnings for valid resume of sufficient length", () => {
    // Pad the fixture to realistic length (>3000 chars) since the real resume
    // is ~5000-8000 chars. The fixture is intentionally compact.
    const padded = SAMPLE_RESUME_CLEAN + "\n\n" + "Additional experience details. ".repeat(100);
    const warnings = validateResumeOutput(padded, SAMPLE_CAREER_DATA);
    expect(warnings).toHaveLength(0);
  });

  it("warns about missing required sections", () => {
    const noSections = "# Paul Prae\n\nJust some text without sections.";
    const warnings = validateResumeOutput(noSections, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("Professional Summary"))).toBe(true);
    expect(warnings.some((w) => w.includes("Professional Experience"))).toBe(true);
    expect(warnings.some((w) => w.includes("Education"))).toBe(true);
    expect(warnings.some((w) => w.includes("Technical Skills"))).toBe(true);
  });

  it("warns when resume is too short", () => {
    const short = "# Paul Prae\n\n## Professional Summary\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\nShort.";
    const warnings = validateResumeOutput(short, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("too short"))).toBe(true);
  });

  it("warns when resume is too long", () => {
    const sections = "## Professional Summary\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\n";
    const long = "# Paul Prae\n\n" + sections + "x".repeat(13000);
    const warnings = validateResumeOutput(long, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("too long"))).toBe(true);
  });

  it("warns when recent employers are missing", () => {
    const noCompanies = "# Paul Prae\n\n## Professional Summary\n\nSome text.\n\n## Professional Experience\n\nSome roles.\n\n## Education\n\nSchool.\n\n## Technical Skills\n\nSkills.\n\n" + "x".repeat(3000);
    const warnings = validateResumeOutput(noCompanies, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("Acme AI Corp"))).toBe(true);
  });

  it("warns when H1 heading is missing", () => {
    const noH1 = "Some text without heading\n\n## Professional Summary\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\n" + "x".repeat(3000);
    const warnings = validateResumeOutput(noH1, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("H1 heading"))).toBe(true);
  });
});

// ─── Resume Content Quality Checks ──────────────────────────────────────────
// These tests validate the SAMPLE resume fixture for quality patterns.
// When the real resume is generated, the same patterns should hold.
// Run these against the actual resume.md for full QA.

describe("resume content quality (fixture)", () => {
  const resume = SAMPLE_RESUME_CLEAN;

  it("starts with candidate name as H1", () => {
    expect(resume).toMatch(/^# Paul Prae/);
  });

  it("includes contact information", () => {
    expect(resume).toContain("paul@example.com");
    expect(resume).toContain("linkedin.com");
    expect(resume).toContain("paulprae.com");
  });

  it("uses action verbs in experience bullets", () => {
    const actionVerbs = ["Led", "Architected", "Built", "Reduced", "Established", "Mentored"];
    const hasActionVerbs = actionVerbs.some((verb) => resume.includes(verb));
    expect(hasActionVerbs).toBe(true);
  });

  it("includes quantified metrics", () => {
    // Look for percentage, dollar, or numeric patterns
    const hasMetrics = /\d+[%+]|\$\d|team of \d|\d+M\+|\d+\+/.test(resume);
    expect(hasMetrics).toBe(true);
  });

  it("includes all major sections", () => {
    const sections = [
      "Professional Summary",
      "Professional Experience",
      "Education",
      "Technical Skills",
    ];
    for (const section of sections) {
      expect(resume).toContain(`## ${section}`);
    }
  });

  it("uses horizontal rules between sections", () => {
    const hrCount = (resume.match(/^---$/gm) || []).length;
    expect(hrCount).toBeGreaterThanOrEqual(4);
  });

  it("positions are in reverse chronological order", () => {
    const principalIdx = resume.indexOf("Principal AI Engineer");
    const seniorIdx = resume.indexOf("Senior ML Engineer");
    expect(principalIdx).toBeLessThan(seniorIdx);
  });
});
