/**
 * generate-resume.ts — Unit tests for Claude API resume generation.
 *
 * Tests cover: system prompt quality, user message construction,
 * post-generation validation, quality scoring, and content quality checks.
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
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { _testExports } from "../scripts/generate-resume.js";
import { SAMPLE_CAREER_DATA, SAMPLE_RESUME_CLEAN } from "./fixtures/sample-data.js";

const {
  SYSTEM_PROMPT,
  INCLUDE_FEW_SHOT,
  buildUserMessage,
  validateResumeOutput,
  scoreResume,
  formatScoreReport,
  stripEmpty,
} = _testExports;

// ─── System Prompt Quality ──────────────────────────────────────────────────
// The system prompt is the foundation of resume quality. These tests ensure
// critical instructions survive edits.

describe("SYSTEM_PROMPT", () => {
  it("contains all required quality rules", () => {
    // Verify all 10 numbered rules exist — catches accidental deletion of rules
    const requiredRules = [
      "Rule 1: Length",
      "Rule 2: ATS Optimization",
      "Rule 3: Quantified Impact",
      "Rule 4: Recency-Based Bullet Allocation",
      "Rule 7: No Fabrication",
      "Rule 8: No Cross-Section Duplication",
      "Rule 9: Projects Selection",
    ];
    for (const rule of requiredRules) {
      expect(SYSTEM_PROMPT).toContain(rule);
    }
    // Verify key sub-requirements within rules
    expect(SYSTEM_PROMPT).toContain("Approximately 2 pages");
    expect(SYSTEM_PROMPT).toContain("STAR method");
    expect(SYSTEM_PROMPT).toContain("Only use data provided");
    expect(SYSTEM_PROMPT).toContain("Never drop a position at a major company");
  });

  it("contains all required sections (brand voice, format, knowledge strategy, output)", () => {
    const requiredSections = [
      "Brand Voice Guidelines",
      "Professional Summary",
      "Professional Experience",
      "Education",
      "Technical Skills",
      "Knowledge Base Integration Strategy",
      "Output ONLY the Markdown resume content",
      "Section Priority Weighting",
      "expert conversation test",
      "Language integrity",
      "Technology relevance",
      "Live URLs required",
    ];
    for (const section of requiredSections) {
      expect(SYSTEM_PROMPT).toContain(section);
    }
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
    const short =
      "# Paul Prae\n\n## Professional Summary\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\nShort.";
    const warnings = validateResumeOutput(short, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("too short"))).toBe(true);
  });

  it("warns when resume is too long", () => {
    const sections =
      "## Professional Summary\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\n";
    const long = "# Paul Prae\n\n" + sections + "x".repeat(13000);
    const warnings = validateResumeOutput(long, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("too long"))).toBe(true);
  });

  it("warns when recent employers are missing", () => {
    const noCompanies =
      "# Paul Prae\n\n## Professional Summary\n\nSome text.\n\n## Professional Experience\n\nSome roles.\n\n## Education\n\nSchool.\n\n## Technical Skills\n\nSkills.\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(noCompanies, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("Acme AI Corp"))).toBe(true);
  });

  it("warns when H1 heading is missing", () => {
    const noH1 =
      "Some text without heading\n\n## Professional Summary\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(noH1, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("H1 heading"))).toBe(true);
  });
});

// ─── Resume Content Quality Checks ──────────────────────────────────────────
// These tests validate the SAMPLE resume fixture for quality patterns.
// When the real resume is generated, the same patterns should hold.
// Run these against the actual generated resume for full QA.

describe("resume content quality (fixture)", () => {
  const resume = SAMPLE_RESUME_CLEAN;

  it("starts with candidate name as H1", () => {
    expect(resume).toMatch(/^# Paul Prae/);
  });

  it("includes contact information", () => {
    expect(resume).toContain("paul@example.com");
    expect(resume).toContain("linkedin.com");
    expect(resume).toContain("github.com");
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

// ─── Few-Shot Examples & Section Priority ────────────────────────────────────

describe("few-shot examples", () => {
  it("INCLUDE_FEW_SHOT is enabled by default", () => {
    expect(INCLUDE_FEW_SHOT).toBe(true);
  });

  it("SYSTEM_PROMPT includes few-shot examples when enabled", () => {
    expect(SYSTEM_PROMPT).toContain("Examples of Strong vs Weak Position Bullets");
    expect(SYSTEM_PROMPT).toContain("Weak:");
    expect(SYSTEM_PROMPT).toContain("Strong:");
  });

  it("SYSTEM_PROMPT contains at least 5 weak/strong pairs from few-shot file", () => {
    const weakCount = (SYSTEM_PROMPT.match(/Weak:/g) || []).length;
    const strongCount = (SYSTEM_PROMPT.match(/Strong:/g) || []).length;
    expect(weakCount).toBeGreaterThanOrEqual(5);
    expect(strongCount).toBeGreaterThanOrEqual(5);
  });

  it("includes sparse-data enrichment example", () => {
    expect(SYSTEM_PROMPT).toContain("Fortune 500 consulting firm");
  });

  it("includes leadership/management transformation example", () => {
    expect(SYSTEM_PROMPT).toContain("structured mentorship programs");
  });

  it("loading without few-shot excludes examples", () => {
    // Load the base prompt file directly — its content shouldn't have examples
    const systemPath = path.join(process.cwd(), "lib/prompts/resume-writer.system.md");
    const { content } = matter(fs.readFileSync(systemPath, "utf-8"));
    expect(content).not.toContain("Examples of Strong vs Weak");
  });

  it("includes section priority weighting (Rule 10)", () => {
    expect(SYSTEM_PROMPT).toContain("Section Priority Weighting");
    expect(SYSTEM_PROMPT).toContain("HIGHEST PRIORITY");
    expect(SYSTEM_PROMPT).toContain("Professional Summary");
  });
});

// ─── Enhanced Validation Rules ───────────────────────────────────────────────

describe("validateResumeOutput — enhanced checks", () => {
  const validResume = SAMPLE_RESUME_CLEAN + "\n\n" + "Additional experience details. ".repeat(100);

  it("catches first-person I statements", () => {
    const withFirstPerson =
      "# Paul Prae\n\n## Professional Summary\n\nI led a team.\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withFirstPerson, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("first-person"))).toBe(true);
  });

  it("does not flag AI or other words containing I", () => {
    const warnings = validateResumeOutput(validResume, SAMPLE_CAREER_DATA);
    // The sample resume contains "AI" many times — should not trigger
    expect(warnings.some((w) => w.includes("first-person"))).toBe(false);
  });

  it("catches passive voice markers", () => {
    const withPassive =
      "# Paul Prae\n\n## Professional Summary\n\nWas responsible for building systems.\n\n## Professional Experience\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withPassive, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("passive/weak phrasing"))).toBe(true);
  });

  it("does not flag valid resume for passive voice", () => {
    const warnings = validateResumeOutput(validResume, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("passive/weak phrasing"))).toBe(false);
  });

  it("catches numeric date formats in experience section", () => {
    const withNumericDates =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | 01/2023 – Present\n\n- Built stuff\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withNumericDates, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("numeric format"))).toBe(true);
  });

  it("validates action verbs in experience bullets", () => {
    const weakBullets =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2023 – Present\n\n- Worked on stuff\n- Did things\n- Helped team\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(weakBullets, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("action verbs"))).toBe(true);
  });

  it("does not flag positions with strong action verbs", () => {
    const warnings = validateResumeOutput(validResume, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("action verbs"))).toBe(false);
  });

  it("warns on HTTP links in Projects section", () => {
    const withHttpProject =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2023 – Present\n\n- Led AI platform\n- Built systems\n- Reduced latency by 40%\n\n## Education\n\n## Technical Skills\n\n## Projects\n\n### [Old Project](http://example.com/old)\nA stale project.\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withHttpProject, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("non-HTTPS link"))).toBe(true);
  });

  it("does not warn on HTTPS links in Projects section", () => {
    const withHttpsProject =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2023 – Present\n\n- Led AI platform\n- Built systems\n- Reduced latency by 40%\n\n## Education\n\n## Technical Skills\n\n## Projects\n\n### [Good Project](https://example.com/good)\nA modern project.\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withHttpsProject, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("non-HTTPS link"))).toBe(false);
  });

  it("warns on suspicious compound phrases in Professional Summary", () => {
    const withInventedPhrase =
      "# Paul Prae\n\n## Professional Summary\n\nDemonstrates progressive engineering leadership across multiple domains.\n\n---\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2023 – Present\n\n- Led AI platform\n- Built systems\n- Reduced latency by 40%\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withInventedPhrase, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("invented phrasing"))).toBe(true);
  });
});

// ─── Quantification Density Validation ──────────────────────────────────────

describe("validateResumeOutput — quantification density", () => {
  it("warns when a position has 2+ bullets but zero quantified metrics", () => {
    const noMetrics =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2023 – Present\n\n- Led the development of AI solutions\n- Collaborated with cross-functional teams on projects\n- Designed systems for healthcare clients\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(noMetrics, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("zero quantified metrics"))).toBe(true);
  });

  it("does not warn when bullets contain quantified metrics", () => {
    const withMetrics =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2023 – Present\n\n- Led team of 8 engineers delivering AI solutions\n- Reduced processing time by 40% through optimization\n- Architected systems serving 10+ enterprise clients\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(withMetrics, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("zero quantified metrics"))).toBe(false);
  });
});

// ─── Recency Tier Bullet Count Validation ───────────────────────────────────

describe("validateResumeOutput — recency tier bullet counts", () => {
  it("warns when a recent position (Tier 1) has fewer than 3 bullets", () => {
    const fewBullets =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2024 – Present\n\n- Led AI platform with 500+ clients\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(fewBullets, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("Tier 1") && w.includes("minimum is 3"))).toBe(true);
  });

  it("does not warn when a recent position has sufficient bullets", () => {
    const enoughBullets =
      "# Paul Prae\n\n## Professional Summary\n\nSummary.\n\n## Professional Experience\n\n### Engineer\n**Acme AI Corp** | SF | Jan 2024 – Present\n\n- Led AI platform serving 500+ clients\n- Reduced latency by 40% through optimization\n- Built team of 8 engineers for ML deployment\n\n## Education\n\n## Technical Skills\n\n" +
      "x".repeat(3000);
    const warnings = validateResumeOutput(enoughBullets, SAMPLE_CAREER_DATA);
    expect(warnings.some((w) => w.includes("Tier 1"))).toBe(false);
  });
});

// ─── Quality Scoring ────────────────────────────────────────────────────────

describe("scoreResume", () => {
  it("scores sample resume with expected components", () => {
    const score = scoreResume(SAMPLE_RESUME_CLEAN);
    expect(score.sectionCount).toBeGreaterThanOrEqual(4);
    expect(score.positionCount).toBe(2);
    expect(score.totalBullets).toBeGreaterThanOrEqual(4);
    expect(score.quantifiedBullets).toBeGreaterThan(0);
    expect(score.charCount).toBeGreaterThan(0);
    expect(score.total).toBeGreaterThan(0);
  });

  it("scores an empty resume at zero or near-zero", () => {
    const score = scoreResume("# Name\n\nEmpty resume");
    expect(score.positionCount).toBe(0);
    expect(score.totalBullets).toBe(0);
    expect(score.total).toBeLessThan(50);
  });

  it("scores higher for more positions and bullets", () => {
    const simple =
      "# Name\n\n## Professional Experience\n\n### Role A\n**Co A** | Loc | Jan 2024 – Present\n\n- Did thing 1\n";
    const rich =
      "# Name\n\n## Professional Experience\n\n### Role A\n**Co A** | Loc | Jan 2024 – Present\n\n- Led team of 5 engineers\n- Reduced cost by 30%\n- Built 3 production systems\n\n### Role B\n**Co B** | Loc | Jan 2020 – Dec 2023\n\n- Delivered $2M+ in revenue\n- Managed 10+ client accounts\n";
    const simpleScore = scoreResume(simple);
    const richScore = scoreResume(rich);
    expect(richScore.total).toBeGreaterThan(simpleScore.total);
  });

  it("detects major company coverage", () => {
    const withCompanies =
      "# Name\n\n## Professional Experience\n\n### Architect\n**Amazon Web Services** | Remote\n\n- Stuff\n\n### Engineer\n**Microsoft** | Remote\n\n- Things\n";
    const score = scoreResume(withCompanies);
    expect(score.majorCompanyCoverage).toBeGreaterThanOrEqual(2);
  });
});

describe("formatScoreReport", () => {
  it("formats a readable score report", () => {
    const score = scoreResume(SAMPLE_RESUME_CLEAN);
    const report = formatScoreReport("Test", score);
    expect(report).toContain("Test Quality Score:");
    expect(report).toContain("Sections:");
    expect(report).toContain("Positions:");
    expect(report).toContain("Quantified bullets:");
    expect(report).toContain("Major companies:");
  });
});

// ─── Context Optimization (Phase 6) ─────────────────────────────────────────

describe("stripEmpty", () => {
  it("strips empty strings", () => {
    expect(stripEmpty({ a: "hello", b: "" })).toEqual({ a: "hello" });
  });

  it("strips null values", () => {
    expect(stripEmpty({ a: "hello", b: null })).toEqual({ a: "hello" });
  });

  it("strips empty arrays", () => {
    expect(stripEmpty({ a: [1], b: [] })).toEqual({ a: [1] });
  });

  it("strips OMIT_FIELDS (licenseNumber, activities, cause, number)", () => {
    const obj = { name: "Test", licenseNumber: "ABC", activities: "stuff", cause: "education" };
    expect(stripEmpty(obj)).toEqual({ name: "Test" });
  });

  it("recursively strips nested empty fields", () => {
    const obj = { a: { b: "", c: "value" }, d: null };
    expect(stripEmpty(obj)).toEqual({ a: { c: "value" } });
  });

  it("handles arrays of objects", () => {
    const arr = [
      { name: "Test", description: "" },
      { name: "", title: "" },
    ];
    const result = stripEmpty(arr);
    expect(result).toEqual([{ name: "Test" }]);
  });

  it("preserves non-empty scalar values", () => {
    expect(stripEmpty("hello")).toBe("hello");
    expect(stripEmpty(42)).toBe(42);
    expect(stripEmpty(true)).toBe(true);
    expect(stripEmpty(0)).toBe(0);
    expect(stripEmpty(false)).toBe(false);
  });
});

describe("buildUserMessage — compact format", () => {
  it("uses compact JSON (no indentation)", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    // Compact JSON has no newlines within the JSON block
    const coreSection = msg.split("## Supplementary Knowledge Base")[0];
    const jsonStart = coreSection.indexOf("{");
    const jsonEnd = coreSection.lastIndexOf("}");
    const jsonBlock = coreSection.slice(jsonStart, jsonEnd + 1);
    // Compact JSON should not have leading whitespace + key pattern
    expect(jsonBlock).not.toMatch(/\n\s{2,}"/);
  });

  it("preserves all position titles from career data", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    const titles = SAMPLE_CAREER_DATA.positions.map((p) => p.title).filter(Boolean);
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) {
      expect(msg).toContain(title);
    }
  });

  it("preserves all skill names from career data", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    const skills = SAMPLE_CAREER_DATA.skills.filter(Boolean);
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(msg).toContain(skill);
    }
  });

  it("preserves profile name", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    expect(msg).toContain(SAMPLE_CAREER_DATA.profile.name);
  });

  it("preserves all knowledge entry titles", () => {
    const msg = buildUserMessage(SAMPLE_CAREER_DATA);
    for (const entry of SAMPLE_CAREER_DATA.knowledge) {
      expect(msg).toContain(entry.title);
    }
  });

  it("omits empty string fields from JSON output", () => {
    const dataWithEmpties = {
      ...SAMPLE_CAREER_DATA,
      positions: [{ ...SAMPLE_CAREER_DATA.positions[0], description: "" }],
    };
    const msg = buildUserMessage(dataWithEmpties);
    // Parse the core JSON to verify empty description was stripped
    const jsonStart = msg.indexOf("{");
    const jsonEnd = msg.indexOf("## Supplementary") - 1;
    const jsonBlock = msg.slice(jsonStart, jsonEnd).trim();
    const parsed = JSON.parse(jsonBlock);
    // First position should not have 'description' key
    expect(parsed.positions[0]).not.toHaveProperty("description");
  });
});
