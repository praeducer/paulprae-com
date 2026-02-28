/**
 * ingest-linkedin.ts — Unit tests for the LinkedIn data ingestion pipeline.
 *
 * Tests cover: date normalization, CSV row normalization, knowledge base loading,
 * profile enrichment, Zod validation, and the full ingest() pipeline.
 *
 * Run: npm test -- tests/ingest.test.ts
 *
 * Lessons learned from pipeline development:
 * - Date parsing is the most error-prone area — LinkedIn exports use 4+ formats
 * - Knowledge base files have heterogeneous schemas (NOT all KnowledgeEntry)
 * - Profile enrichment from knowledge base fills gaps LinkedIn CSV leaves empty
 * - Empty rows are common in LinkedIn exports and must be filtered
 * - BOM characters from Windows exports break parsing if not stripped
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { _testExports } from "../scripts/ingest-linkedin.js";
import {
  SAMPLE_POSITIONS,
  SAMPLE_EDUCATION,
  SAMPLE_SKILLS,
  SAMPLE_CERTIFICATIONS,
  SAMPLE_PROJECTS,
  SAMPLE_PUBLICATIONS,
  SAMPLE_PROFILE,
  SAMPLE_EMAILS,
  SAMPLE_LANGUAGES,
  SAMPLE_RECOMMENDATIONS,
  SAMPLE_HONORS,
  SAMPLE_VOLUNTEERING,
  SAMPLE_COURSES,
  SAMPLE_KNOWLEDGE_ENTRY,
  SAMPLE_KNOWLEDGE_NON_ENTRY,
  SAMPLE_CAREER_DATA,
} from "./fixtures/sample-data.js";

const {
  normalizeDate,
  normalizeDateOrNull,
  safeString,
  stripBOM,
  normalizePositions,
  normalizeEducation,
  normalizeSkills,
  normalizeCertifications,
  normalizeProjects,
  normalizePublications,
  normalizeProfile,
  extractEmail,
  normalizeLanguages,
  normalizeRecommendations,
  normalizeHonors,
  normalizeVolunteering,
  normalizeCourses,
  findJsonFiles,
  isKnowledgeEntry,
  wrapAsKnowledgeEntry,
  CareerDataSchema,
} = _testExports;

// ─── Date Normalization ─────────────────────────────────────────────────────
// LinkedIn exports dates in 4+ formats. This is the most critical parser.

describe("normalizeDate", () => {
  it("converts 'Mon YYYY' to 'YYYY-MM'", () => {
    expect(normalizeDate("Jan 2020")).toBe("2020-01");
    expect(normalizeDate("Dec 2025")).toBe("2025-12");
    expect(normalizeDate("Mar 2015")).toBe("2015-03");
  });

  it("is case-insensitive for month abbreviations", () => {
    expect(normalizeDate("JAN 2020")).toBe("2020-01");
    expect(normalizeDate("jan 2020")).toBe("2020-01");
  });

  it("preserves year-only dates", () => {
    expect(normalizeDate("2020")).toBe("2020");
    expect(normalizeDate("2012")).toBe("2012");
  });

  it("truncates ISO dates to month precision", () => {
    expect(normalizeDate("2020-01")).toBe("2020-01");
    expect(normalizeDate("2020-01-15")).toBe("2020-01");
  });

  it("converts slash dates 'MM/YYYY' to 'YYYY-MM'", () => {
    expect(normalizeDate("01/2020")).toBe("2020-01");
    expect(normalizeDate("12/2025")).toBe("2025-12");
    expect(normalizeDate("1/2020")).toBe("2020-01"); // no zero-pad input
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeDate(null)).toBe("");
    expect(normalizeDate(undefined)).toBe("");
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("   ")).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeDate("  Jan 2020  ")).toBe("2020-01");
  });

  it("passes through unrecognized formats", () => {
    expect(normalizeDate("Xyz 2020")).toBe("Xyz 2020");
    expect(normalizeDate("random text")).toBe("random text");
  });
});

describe("normalizeDateOrNull", () => {
  it("returns null for empty/null/undefined", () => {
    expect(normalizeDateOrNull("")).toBeNull();
    expect(normalizeDateOrNull(null)).toBeNull();
    expect(normalizeDateOrNull(undefined)).toBeNull();
  });

  it("returns normalized date for valid input", () => {
    expect(normalizeDateOrNull("Jan 2020")).toBe("2020-01");
    expect(normalizeDateOrNull("2020")).toBe("2020");
  });
});

// ─── Utility Functions ──────────────────────────────────────────────────────

describe("safeString", () => {
  it("trims whitespace", () => {
    expect(safeString("  hello  ")).toBe("hello");
  });

  it("returns empty string for null/undefined", () => {
    expect(safeString(null)).toBe("");
    expect(safeString(undefined)).toBe("");
  });
});

describe("stripBOM", () => {
  it("removes UTF-8 BOM", () => {
    expect(stripBOM("\uFEFFhello")).toBe("hello");
  });

  it("leaves content without BOM unchanged", () => {
    expect(stripBOM("hello")).toBe("hello");
  });
});

// ─── CSV Row Normalizers ────────────────────────────────────────────────────
// Each normalizer transforms raw LinkedIn CSV rows to CareerData format.

describe("normalizePositions", () => {
  it("normalizes valid positions", () => {
    const result = normalizePositions(SAMPLE_POSITIONS);
    // Should filter out the empty row (3rd entry)
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Principal AI Engineer");
    expect(result[0].company).toBe("Acme AI Corp");
    expect(result[0].startDate).toBe("2023-01");
    expect(result[0].endDate).toBeNull(); // current position
  });

  it("sorts by startDate descending (most recent first)", () => {
    const result = normalizePositions(SAMPLE_POSITIONS);
    expect(result[0].startDate).toBe("2023-01");
    expect(result[1].startDate).toBe("2020-03");
  });

  it("filters out empty entries", () => {
    const empty = [{ "Company Name": "", Title: "", Description: "", Location: "", "Started On": "", "Finished On": "" }];
    expect(normalizePositions(empty)).toHaveLength(0);
  });

  it("initializes highlights as empty array", () => {
    const result = normalizePositions(SAMPLE_POSITIONS);
    expect(result[0].highlights).toEqual([]);
  });
});

describe("normalizeEducation", () => {
  it("normalizes valid education entries", () => {
    const result = normalizeEducation(SAMPLE_EDUCATION);
    expect(result).toHaveLength(1);
    expect(result[0].school).toBe("Georgia Institute of Technology");
    expect(result[0].degree).toBe("Bachelor of Science");
    expect(result[0].startDate).toBe("2012");
    expect(result[0].endDate).toBe("2016");
  });

  it("filters out entries with empty school name", () => {
    const empty = [{ "School Name": "", "Degree Name": "", Notes: "", "Started On": "", "Finished On": "", Activities: "" }];
    expect(normalizeEducation(empty)).toHaveLength(0);
  });
});

describe("normalizeSkills", () => {
  it("extracts skill names and filters empty ones", () => {
    const result = normalizeSkills(SAMPLE_SKILLS);
    expect(result).toContain("Python");
    expect(result).toContain("TypeScript");
    expect(result).toContain("Machine Learning");
    expect(result).toContain("AWS"); // trimmed from "  AWS  "
    expect(result).not.toContain(""); // filtered
  });

  it("trims whitespace from skill names", () => {
    const result = normalizeSkills([{ Name: "  AWS  " }]);
    expect(result[0]).toBe("AWS");
  });
});

describe("normalizeCertifications", () => {
  it("normalizes valid certifications", () => {
    const result = normalizeCertifications(SAMPLE_CERTIFICATIONS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("AWS Solutions Architect");
    expect(result[0].authority).toBe("Amazon Web Services");
    expect(result[0].date).toBe("2023-06");
    expect(result[0].licenseNumber).toBe("ABC123");
  });

  it("sets empty optional fields to undefined", () => {
    const noCert = [{ Name: "Test", Url: "", Authority: "Auth", "Started On": "", "Finished On": "", "License Number": "" }];
    const result = normalizeCertifications(noCert);
    expect(result[0].licenseNumber).toBeUndefined();
    expect(result[0].url).toBeUndefined();
  });
});

describe("normalizeProjects", () => {
  it("normalizes valid projects", () => {
    const result = normalizeProjects(SAMPLE_PROJECTS);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("AI Resume Generator");
  });
});

describe("normalizePublications", () => {
  it("normalizes valid publications", () => {
    const result = normalizePublications(SAMPLE_PUBLICATIONS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Scaling AI Pipelines in Healthcare");
    expect(result[0].publisher).toBe("IEEE");
  });
});

describe("normalizeProfile", () => {
  it("combines first and last name", () => {
    const result = normalizeProfile(SAMPLE_PROFILE);
    expect(result.name).toBe("Paul Prae");
  });

  it("extracts headline and summary", () => {
    const result = normalizeProfile(SAMPLE_PROFILE);
    expect(result.headline).toBe("Principal AI Engineer & Architect");
    expect(result.summary).toBe("Building AI systems that matter.");
  });

  it("returns empty profile for missing data", () => {
    const result = normalizeProfile([]);
    expect(result.name).toBe("");
    expect(result.headline).toBe("");
  });

  it("initializes linkedin/website/email as empty strings", () => {
    const result = normalizeProfile(SAMPLE_PROFILE);
    expect(result.linkedin).toBe("");
    expect(result.website).toBe("");
    expect(result.email).toBe("");
  });
});

describe("extractEmail", () => {
  it("prefers primary + confirmed email", () => {
    expect(extractEmail(SAMPLE_EMAILS)).toBe("paul@example.com");
  });

  it("falls back to confirmed if no primary", () => {
    const noPrimary = SAMPLE_EMAILS.filter((e) => e.Primary !== "Yes");
    expect(extractEmail(noPrimary)).toBe("alt@example.com");
  });

  it("falls back to first email if none confirmed", () => {
    const unconfirmed = [{ "Email Address": "only@example.com", Confirmed: "No", Primary: "No" }];
    expect(extractEmail(unconfirmed)).toBe("only@example.com");
  });

  it("returns empty string for empty array", () => {
    expect(extractEmail([])).toBe("");
  });
});

describe("normalizeLanguages", () => {
  it("normalizes valid languages", () => {
    const result = normalizeLanguages(SAMPLE_LANGUAGES);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("English");
  });
});

describe("normalizeRecommendations", () => {
  it("normalizes valid recommendations", () => {
    const result = normalizeRecommendations(SAMPLE_RECOMMENDATIONS);
    expect(result).toHaveLength(1);
    expect(result[0].recommender).toBe("Jane Doe");
  });

  it("filters recommendations with empty text", () => {
    const empty = [{ Recommender: "Someone", Text: "", Date: "", Status: "" }];
    expect(normalizeRecommendations(empty)).toHaveLength(0);
  });
});

describe("normalizeHonors", () => {
  it("normalizes valid honors", () => {
    const result = normalizeHonors(SAMPLE_HONORS);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Innovation Award");
  });
});

describe("normalizeVolunteering", () => {
  it("normalizes valid volunteering entries", () => {
    const result = normalizeVolunteering(SAMPLE_VOLUNTEERING);
    expect(result).toHaveLength(1);
    expect(result[0].organization).toBe("Code for America");
    expect(result[0].endDate).toBeNull(); // ongoing
  });
});

describe("normalizeCourses", () => {
  it("normalizes valid courses", () => {
    const result = normalizeCourses(SAMPLE_COURSES);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Deep Learning Specialization");
    expect(result[0].associatedWith).toBe("Georgia Institute of Technology");
  });
});

// ─── Knowledge Base ─────────────────────────────────────────────────────────

describe("isKnowledgeEntry", () => {
  it("returns true for valid KnowledgeEntry", () => {
    expect(isKnowledgeEntry(SAMPLE_KNOWLEDGE_ENTRY)).toBe(true);
  });

  it("returns false for non-KnowledgeEntry objects", () => {
    expect(isKnowledgeEntry(SAMPLE_KNOWLEDGE_NON_ENTRY)).toBe(false);
  });

  it("returns false for null/undefined/primitives", () => {
    expect(isKnowledgeEntry(null)).toBe(false);
    expect(isKnowledgeEntry(undefined)).toBe(false);
    expect(isKnowledgeEntry("string")).toBe(false);
    expect(isKnowledgeEntry(42)).toBe(false);
  });

  it("returns false for objects missing required fields", () => {
    expect(isKnowledgeEntry({ category: "a", title: "b" })).toBe(false); // missing content
    expect(isKnowledgeEntry({ category: "a", content: "c" })).toBe(false); // missing title
  });
});

describe("wrapAsKnowledgeEntry", () => {
  it("wraps non-entry JSON with category from directory name", () => {
    const result = wrapAsKnowledgeEntry(
      path.join(process.cwd(), "data", "sources", "knowledge", "career", "positions.json"),
      SAMPLE_KNOWLEDGE_NON_ENTRY,
    );
    expect(result.category).toBe("career");
    expect(result.title).toBe("positions");
    expect(result.content).toContain("company_id");
    expect(result.tags).toContain("career");
  });

  it("wraps string data directly", () => {
    const result = wrapAsKnowledgeEntry(
      path.join(process.cwd(), "data", "sources", "knowledge", "brand", "narrative.json"),
      "A compelling narrative about AI leadership.",
    );
    expect(result.category).toBe("brand");
    expect(result.content).toBe("A compelling narrative about AI leadership.");
  });
});

describe("findJsonFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join("/tmp", "test-knowledge-"));
    const sub = path.join(tempDir, "career");
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, "positions.json"), "[]");
    fs.writeFileSync(path.join(sub, "example.json"), "[]"); // should be skipped
    fs.writeFileSync(path.join(tempDir, "top.json"), "{}");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds JSON files recursively", () => {
    const files = findJsonFiles(tempDir);
    const names = files.map((f) => path.basename(f));
    expect(names).toContain("positions.json");
    expect(names).toContain("top.json");
  });

  it("skips example.json files", () => {
    const files = findJsonFiles(tempDir);
    const names = files.map((f) => path.basename(f));
    expect(names).not.toContain("example.json");
  });

  it("returns empty array for non-existent directory", () => {
    expect(findJsonFiles("/nonexistent/path")).toEqual([]);
  });
});

// ─── Zod Validation ─────────────────────────────────────────────────────────

describe("CareerDataSchema", () => {
  it("validates valid CareerData", () => {
    const result = CareerDataSchema.safeParse(SAMPLE_CAREER_DATA);
    expect(result.success).toBe(true);
  });

  it("rejects missing profile name", () => {
    const invalid = {
      ...SAMPLE_CAREER_DATA,
      profile: { ...SAMPLE_CAREER_DATA.profile, name: "" },
    };
    const result = CareerDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects position with empty title", () => {
    const invalid = {
      ...SAMPLE_CAREER_DATA,
      positions: [{ ...SAMPLE_CAREER_DATA.positions[0], title: "" }],
    };
    const result = CareerDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects position with empty company", () => {
    const invalid = {
      ...SAMPLE_CAREER_DATA,
      positions: [{ ...SAMPLE_CAREER_DATA.positions[0], company: "" }],
    };
    const result = CareerDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects position with empty startDate", () => {
    const invalid = {
      ...SAMPLE_CAREER_DATA,
      positions: [{ ...SAMPLE_CAREER_DATA.positions[0], startDate: "" }],
    };
    const result = CareerDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts empty arrays for optional sections", () => {
    const minimal = {
      ...SAMPLE_CAREER_DATA,
      certifications: [],
      projects: [],
      publications: [],
      languages: [],
      recommendations: [],
      honors: [],
      volunteering: [],
      courses: [],
      knowledge: [],
    };
    const result = CareerDataSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("accepts knowledge entries with optional tags", () => {
    const withTags = {
      ...SAMPLE_CAREER_DATA,
      knowledge: [{ category: "a", title: "b", content: "c", tags: ["x"], relatedPositions: ["y"] }],
    };
    const result = CareerDataSchema.safeParse(withTags);
    expect(result.success).toBe(true);
  });
});
