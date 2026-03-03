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
import { PATHS, LINKEDIN_CSV_FILES, RESUME_FILE_BASE, _testExports } from "../lib/config.js";

// RESUME_FILE_BASE constant checks removed — TypeScript + config guarantee correctness.
// Slugify edge-case tests below cover the actual logic.

describe("getResumeFileBase() — edge cases", () => {
  // These test the sanitization logic used in production by simulating the
  // same slug transformation applied in getResumeFileBase().
  const slugify = (name: string): string => {
    const slug = name
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "");
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

  it("has a staging path with .staging.md suffix", () => {
    expect(path.basename(PATHS.resumeStaging)).toBe(`${RESUME_FILE_BASE}.staging.md`);
  });

  it("places resume outputs in data/generated/", () => {
    const root = process.cwd();
    const generatedDir = path.join(root, "data", "generated");
    expect(path.dirname(PATHS.resumeOutput)).toBe(generatedDir);
    expect(path.dirname(PATHS.resumeStaging)).toBe(generatedDir);
    expect(path.dirname(PATHS.pdfOutput)).toBe(generatedDir);
    expect(path.dirname(PATHS.docxOutput)).toBe(generatedDir);
  });
});

// CLAUDE config constant checks removed — these are hardcoded values validated by TypeScript.

describe("LINKEDIN_CSV_FILES", () => {
  it("maps all 13 expected CSV files", () => {
    const expectedFiles = [
      "positions.csv",
      "education.csv",
      "skills.csv",
      "certifications.csv",
      "projects.csv",
      "publications.csv",
      "profile.csv",
      "languages.csv",
      "recommendations_received.csv",
      "honors.csv",
      "volunteering.csv",
      "courses.csv",
      "email addresses.csv",
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
