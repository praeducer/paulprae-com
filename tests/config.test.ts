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
import { PATHS, KNOWLEDGE_PATHS, CLAUDE, LINKEDIN_CSV_FILES } from "../lib/config.js";

describe("PATHS", () => {
  it("resolves all paths relative to cwd", () => {
    const root = process.cwd();
    expect(PATHS.linkedinDir).toBe(path.join(root, "data", "sources", "linkedin"));
    expect(PATHS.knowledgeDir).toBe(path.join(root, "data", "sources", "knowledge"));
    expect(PATHS.careerDataOutput).toBe(path.join(root, "data", "generated", "career-data.json"));
    expect(PATHS.resumeOutput).toBe(path.join(root, "data", "generated", "resume.md"));
    expect(PATHS.pdfOutput).toBe(path.join(root, "data", "generated", "resume.pdf"));
    expect(PATHS.docxOutput).toBe(path.join(root, "data", "generated", "resume.docx"));
    expect(PATHS.pdfStylesheet).toBe(path.join(root, "scripts", "resume-pdf.typ"));
    expect(PATHS.envFile).toBe(path.join(root, ".env.local"));
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
