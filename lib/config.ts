/**
 * Pipeline configuration — single source of truth for paths, model settings,
 * and LinkedIn CSV mappings.
 *
 * Both scripts/ingest-linkedin.ts and scripts/generate-resume.ts import
 * from here. Change config in one place, not scattered across files.
 */

import path from "path";

// ─── File Paths ──────────────────────────────────────────────────────────────

const ROOT = process.cwd();

export const PATHS = {
  linkedinDir: path.join(ROOT, "data", "sources", "linkedin"),
  knowledgeDir: path.join(ROOT, "data", "sources", "knowledge"),
  careerDataOutput: path.join(ROOT, "data", "generated", "career-data.json"),
  resumeOutput: path.join(ROOT, "data", "generated", "resume.md"),
  pdfOutput: path.join(ROOT, "data", "generated", "resume.pdf"),
  docxOutput: path.join(ROOT, "data", "generated", "resume.docx"),
  pdfStylesheet: path.join(ROOT, "scripts", "resume-pdf.typ"),
  envFile: path.join(ROOT, ".env.local"),
} as const;

// ─── Knowledge Base Paths ────────────────────────────────────────────────────

export const KNOWLEDGE_PATHS = {
  career: path.join(ROOT, "data", "sources", "knowledge", "career"),
  brand: path.join(ROOT, "data", "sources", "knowledge", "brand"),
  strategy: path.join(ROOT, "data", "sources", "knowledge", "strategy"),
  agents: path.join(ROOT, "data", "sources", "knowledge", "agents"),
  content: path.join(ROOT, "data", "sources", "knowledge", "content"),
  meta: path.join(ROOT, "data", "sources", "knowledge", "_meta"),
} as const;

// ─── Claude API Configuration ────────────────────────────────────────────────

export const CLAUDE = {
  /** Opus 4.6 — latest alias (no date suffix). */
  model: "claude-opus-4-6" as const,
  /** High ceiling so adaptive thinking doesn't crowd out resume output. */
  maxTokens: 32768,
  /** Adaptive thinking: Opus 4.6 dynamically determines reasoning depth. */
  thinking: { type: "adaptive" as const },
  /** Max effort: Opus 4.6 exclusive — no constraints on token spending. */
  effort: "max" as const,
} as const;

// ─── LinkedIn CSV File Registry ──────────────────────────────────────────────
// Maps lowercase filename → internal type key.
// "required" means ingestion fails if the file is missing AND no data exists
// for that section from other sources.

export const LINKEDIN_CSV_FILES: Record<string, string> = {
  "positions.csv": "positions",
  "education.csv": "education",
  "skills.csv": "skills",
  "certifications.csv": "certifications",
  "projects.csv": "projects",
  "publications.csv": "publications",
  "profile.csv": "profile",
  "languages.csv": "languages",
  "recommendations_received.csv": "recommendations",
  "honors.csv": "honors",
  "volunteering.csv": "volunteering",
  "courses.csv": "courses",
  "email addresses.csv": "email",
} as const;
