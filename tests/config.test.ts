/**
 * lib/config.ts — Unit tests for pipeline configuration.
 *
 * Tests cover: path construction, Claude API config, and CSV file registry.
 *
 * Run: npm test -- tests/config.test.ts
 *
 * Lessons learned:
 * - PATHS are relative to process.cwd(), so tests must account for that
 * - CLAUDE config values must match Anthropic API expectations exactly
 * - CSV registry must be lowercase (LinkedIn exports vary in casing)
 */

import { describe, it, expect } from "vitest";
import path from "path";
import { PATHS, KNOWLEDGE_PATHS, CLAUDE, LINKEDIN_CSV_FILES, RESUME_FILE_BASE, _testExports } from "../lib/config.js";

describe("RESUME_FILE_BASE", () => {
  it("is a non-empty string ending with 'Resume'", () => {
    expect(RESUME_FILE_BASE).toBeTruthy();
    expect(RESUME_FILE_BASE).toMatch(/Resume$/);
  });

  it("uses hyphen-separated name when career data exists", () => {
    // In this repo, career-data.json exists with profile.name = "Paul Prae"
    expect(RESUME_FILE_BASE).toBe("Paul-Prae-Resume");
  });

  it("contains only filename-safe characters (alphanumeric and hyphens)", () => {
    expect(RESUME_FILE_BASE).toMatch(/^[a-zA-Z0-9-]+$/);
  });
});

describe("getResumeFileBase() — edge cases", () => {
  // These test the sanitization logic used in production by simulating the
  // same slug transformation applied in getResumeFileBase().
  const slugify = (name: string): string => {
    const slug = name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    return slug ? `${slug}-Resume` : "Resume";
  };

  it("collapses multiple spaces to single hyphens", () => {
    expect(slugify("Jane   Doe")).toBe("Jane-Doe-Resume");
  });

  it("strips leading and trailing whitespace", () => {
    expect(slugify("  Jane Doe  ")).toBe("Jane-Doe-Resume");
  });

  it("removes special characters (apostrophes, accents, etc.)", () => {
    expect(slugify("O'Brien")).toBe("OBrien-Resume");
    expect(slugify("Jean-Marie")).toBe("Jean-Marie-Resume");
  });

  it("falls back to 'Resume' for empty or whitespace-only names", () => {
    expect(slugify("")).toBe("Resume");
    expect(slugify("   ")).toBe("Resume");
  });

  it("falls back to 'Resume' for names with only special characters", () => {
    expect(slugify("@#$%")).toBe("Resume");
  });

  it("handles hyphenated names correctly", () => {
    expect(slugify("Mary Jane Watson-Parker")).toBe("Mary-Jane-Watson-Parker-Resume");
  });

  it("getResumeFileBase() returns a value matching the current career data", () => {
    // Verify the exported function matches the exported constant
    expect(_testExports.getResumeFileBase()).toBe(RESUME_FILE_BASE);
  });
});

describe("PATHS", () => {
  it("resolves all paths relative to cwd", () => {
    const root = process.cwd();
    expect(PATHS.linkedinDir).toBe(path.join(root, "data", "sources", "linkedin"));
    expect(PATHS.knowledgeDir).toBe(path.join(root, "data", "sources", "knowledge"));
    expect(PATHS.careerDataOutput).toBe(path.join(root, "data", "generated", "career-data.json"));
    expect(PATHS.pdfStylesheet).toBe(path.join(root, "scripts", "resume-pdf.typ"));
    expect(PATHS.versionsDir).toBe(path.join(root, "data", "generated", "versions"));
    expect(PATHS.versionsManifest).toBe(path.join(root, "data", "generated", "VERSIONS.md"));
    expect(PATHS.envFile).toBe(path.join(root, ".env.local"));
  });

  it("uses recruiter-friendly naming convention for resume outputs", () => {
    // Resume files follow the Name-Resume.{ext} convention
    expect(path.basename(PATHS.resumeOutput)).toBe(`${RESUME_FILE_BASE}.md`);
    expect(path.basename(PATHS.pdfOutput)).toBe(`${RESUME_FILE_BASE}.pdf`);
    expect(path.basename(PATHS.docxOutput)).toBe(`${RESUME_FILE_BASE}.docx`);
  });

  it("places resume outputs in data/generated/", () => {
    const root = process.cwd();
    const generatedDir = path.join(root, "data", "generated");
    expect(path.dirname(PATHS.resumeOutput)).toBe(generatedDir);
    expect(path.dirname(PATHS.pdfOutput)).toBe(generatedDir);
    expect(path.dirname(PATHS.docxOutput)).toBe(generatedDir);
  });
});

describe("KNOWLEDGE_PATHS", () => {
  it("defines all expected subdirectories", () => {
    expect(KNOWLEDGE_PATHS.career).toContain("knowledge/career");
    expect(KNOWLEDGE_PATHS.brand).toContain("knowledge/brand");
    expect(KNOWLEDGE_PATHS.strategy).toContain("knowledge/strategy");
    expect(KNOWLEDGE_PATHS.agents).toContain("knowledge/agents");
    expect(KNOWLEDGE_PATHS.content).toContain("knowledge/content");
    expect(KNOWLEDGE_PATHS.meta).toContain("knowledge/_meta");
  });

  it("all paths are under knowledgeDir", () => {
    for (const subdir of Object.values(KNOWLEDGE_PATHS)) {
      expect(subdir.startsWith(PATHS.knowledgeDir)).toBe(true);
    }
  });
});

describe("CLAUDE", () => {
  it("uses claude-opus-4-6 model", () => {
    expect(CLAUDE.model).toBe("claude-opus-4-6");
  });

  it("has reasonable max tokens (>= 16384)", () => {
    expect(CLAUDE.maxTokens).toBeGreaterThanOrEqual(16384);
  });

  it("uses adaptive thinking", () => {
    expect(CLAUDE.thinking).toEqual({ type: "adaptive" });
  });

  it("uses max effort (Opus 4.6 exclusive)", () => {
    expect(CLAUDE.effort).toBe("max");
  });
});

describe("LINKEDIN_CSV_FILES", () => {
  it("maps all 13 expected CSV files", () => {
    const expectedFiles = [
      "positions.csv", "education.csv", "skills.csv", "certifications.csv",
      "projects.csv", "publications.csv", "profile.csv", "languages.csv",
      "recommendations_received.csv", "honors.csv", "volunteering.csv",
      "courses.csv", "email addresses.csv",
    ];
    for (const file of expectedFiles) {
      expect(LINKEDIN_CSV_FILES[file]).toBeDefined();
    }
  });

  it("uses lowercase keys", () => {
    for (const key of Object.keys(LINKEDIN_CSV_FILES)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(LINKEDIN_CSV_FILES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("maps to expected type keys", () => {
    expect(LINKEDIN_CSV_FILES["positions.csv"]).toBe("positions");
    expect(LINKEDIN_CSV_FILES["email addresses.csv"]).toBe("email");
    expect(LINKEDIN_CSV_FILES["recommendations_received.csv"]).toBe("recommendations");
  });
});
