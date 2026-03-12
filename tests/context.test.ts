/**
 * context.test.ts — Tests for the career context builder.
 *
 * Tests cover: career context loading, system prompt building for all modes,
 * and the stripEmpty utility function.
 *
 * Run: npm test -- tests/context.test.ts
 */

import { describe, it, expect } from "vitest";
import { loadCareerContext, buildSystemPrompt } from "../lib/agent/context";
import { stripEmpty } from "../lib/data-utils";
import { RESUME_DOWNLOAD_PATHS, BOOK_INTERVIEW_URL } from "../lib/constants";

// ─── loadCareerContext ──────────────────────────────────────────────────────

describe("loadCareerContext", () => {
  it("returns non-null with profile name Paul Prae", () => {
    const ctx = loadCareerContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.careerData.profile.name).toBe("Paul Prae");
  });

  it("includes knowledge base files", () => {
    const ctx = loadCareerContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.audienceFrameworks).toBeTruthy();
  });

  it("loads company data from knowledge base", () => {
    const ctx = loadCareerContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.companies).toBeTruthy();
    expect(Array.isArray(ctx!.companies)).toBe(true);
  });

  it("does not load career-objectives.json into context", () => {
    const ctx = loadCareerContext();
    expect(ctx).not.toBeNull();
    // CareerContext should not have a careerObjectives field
    expect(ctx).not.toHaveProperty("careerObjectives");
  });
});

// ─── buildSystemPrompt ──────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("chat mode contains Paul Prae and Grounding Rules", () => {
    const prompt = buildSystemPrompt("chat");
    expect(prompt).not.toBeNull();
    expect(prompt).toContain("Paul Prae");
    expect(prompt).toContain("Grounding Rules");
  });

  it("tools mode contains Platform Constraints", () => {
    const prompt = buildSystemPrompt("tools");
    expect(prompt).not.toBeNull();
    expect(prompt).toContain("Platform Constraints");
  });

  it("resume-generator mode loads unified resume-writer prompt", () => {
    const prompt = buildSystemPrompt("resume-generator");
    expect(prompt).not.toBeNull();
    expect(prompt!.toLowerCase()).toMatch(/tailor/);
    // Unified prompt should contain security rules from the former resume-generator
    expect(prompt!).toContain("untrusted user data");
    // Unified prompt should contain quality rules from resume-writer
    expect(prompt!.toLowerCase()).toContain("acceptance_criteria");
  });

  it("injects resume download paths into system prompt", () => {
    const prompt = buildSystemPrompt("chat");
    expect(prompt).not.toBeNull();
    // Template variables should be replaced with actual paths, not remain as placeholders
    expect(prompt).not.toContain("{{RESUME_PDF_PATH}}");
    expect(prompt).not.toContain("{{RESUME_DOCX_PATH}}");
    expect(prompt).not.toContain("{{RESUME_MD_PATH}}");
    expect(prompt).not.toContain("{{RESUME_WEB_PATH}}");
    // Actual paths should be present
    expect(prompt).toContain(RESUME_DOWNLOAD_PATHS.pdf);
    expect(prompt).toContain(RESUME_DOWNLOAD_PATHS.docx);
    expect(prompt).toContain(RESUME_DOWNLOAD_PATHS.md);
    expect(prompt).toContain(RESUME_DOWNLOAD_PATHS.web);
  });

  it("injects booking URL into system prompt", () => {
    const prompt = buildSystemPrompt("chat");
    expect(prompt).not.toBeNull();
    expect(prompt).not.toContain("{{BOOK_INTERVIEW_URL}}");
    expect(prompt).toContain(BOOK_INTERVIEW_URL);
  });

  it("injects company data into chat system prompt", () => {
    const prompt = buildSystemPrompt("chat");
    expect(prompt).not.toBeNull();
    expect(prompt).not.toContain("{{COMPANY_DATA}}");
    // Should contain actual company data (e.g., Arine metrics)
    expect(prompt).toContain("Arine");
    expect(prompt).toContain("45+");
  });

  it("injects company data into resume-generator system prompt", () => {
    const prompt = buildSystemPrompt("resume-generator");
    expect(prompt).not.toBeNull();
    expect(prompt).not.toContain("{{COMPANY_DATA}}");
    expect(prompt).toContain("Arine");
  });

  it("replaces outdated '15 years' in career data with canonical figure", () => {
    const prompt = buildSystemPrompt("chat");
    expect(prompt).not.toBeNull();
    // The career data JSON section (after {{CAREER_DATA}} injection) should
    // have "13+" not "15 years". G2 still mentions "15 years" as a warning —
    // that's intentional. Extract the data block after the last "Career Data" heading.
    const dataSection = prompt!.split("# Career Data").pop()!;
    expect(dataSection).not.toMatch(/With 15 years/i);
    expect(dataSection).toContain("13+ years");
  });
});

// ─── stripEmpty ─────────────────────────────────────────────────────────────

describe("stripEmpty", () => {
  it("removes null and undefined values", () => {
    expect(stripEmpty({ a: null, b: undefined, c: "hello" })).toEqual({ c: "hello" });
  });

  it("removes empty strings", () => {
    expect(stripEmpty({ a: "", b: "ok" })).toEqual({ b: "ok" });
  });

  it("handles nested objects", () => {
    expect(stripEmpty({ a: { b: null, c: "yes" }, d: { e: "" } })).toEqual({
      a: { c: "yes" },
    });
  });

  it("handles empty arrays", () => {
    expect(stripEmpty({ a: [], b: [1, 2] })).toEqual({ b: [1, 2] });
  });

  it("returns undefined for completely empty objects", () => {
    expect(stripEmpty({ a: null, b: "" })).toBeUndefined();
  });

  it("preserves non-empty values", () => {
    expect(stripEmpty({ a: 0, b: false })).toEqual({ a: 0, b: false });
  });
});
