/**
 * Pipeline configuration — single source of truth for paths, model settings,
 * and LinkedIn CSV mappings.
 *
 * Both scripts/ingest-linkedin.ts and scripts/generate-resume.ts import
 * from here. Change config in one place, not scattered across files.
 */

import path from "path";
import fs from "fs";

// ─── File Paths ──────────────────────────────────────────────────────────────

const ROOT = process.cwd();

// ─── Resume Filename Convention ─────────────────────────────────────────────
// Recruiter-friendly naming: "Paul-Prae-Resume.{md,pdf,docx}"
// Derived from career-data.json (profile.name) with a static fallback.
// Pipeline order (ingest → generate → export) ensures career-data.json exists
// before resume files are created. Fallback "Resume" covers first-time setup.

function getResumeFileBase(): string {
  const careerDataPath = path.join(ROOT, "data", "generated", "career-data.json");
  try {
    if (fs.existsSync(careerDataPath)) {
      const data = JSON.parse(fs.readFileSync(careerDataPath, "utf-8"));
      const name: string | undefined = data?.profile?.name;
      if (name) {
        // "Paul Prae" → "Paul-Prae-Resume"
        const slug = name.trim().replace(/\s+/g, "-");
        return `${slug}-Resume`;
      }
    }
  } catch {
    // Fall through to default
  }
  return "Resume";
}

/** Filename base for resume outputs, e.g. "Paul-Prae-Resume" or "Resume" (fallback). */
export const RESUME_FILE_BASE = getResumeFileBase();

export const PATHS = {
  linkedinDir: path.join(ROOT, "data", "sources", "linkedin"),
  knowledgeDir: path.join(ROOT, "data", "sources", "knowledge"),
  careerDataOutput: path.join(ROOT, "data", "generated", "career-data.json"),
  resumeOutput: path.join(ROOT, "data", "generated", `${RESUME_FILE_BASE}.md`),
  pdfOutput: path.join(ROOT, "data", "generated", `${RESUME_FILE_BASE}.pdf`),
  docxOutput: path.join(ROOT, "data", "generated", `${RESUME_FILE_BASE}.docx`),
  pdfStylesheet: path.join(ROOT, "scripts", "resume-pdf.typ"),
  versionsDir: path.join(ROOT, "data", "generated", "versions"),
  versionsManifest: path.join(ROOT, "data", "generated", "VERSIONS.md"),
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
