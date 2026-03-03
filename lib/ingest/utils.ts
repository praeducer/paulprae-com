/**
 * lib/ingest/utils.ts — Low-level utilities for LinkedIn data ingestion.
 *
 * Date normalization, string sanitization, CSV parsing, BOM stripping,
 * LinkedIn zip extraction, Zod validation schema, and skip logic.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import Papa from "papaparse";
import { z } from "zod";
import { PATHS } from "../config.js";
import type { CareerData } from "../types.js";

// ─── Date Normalization ──────────────────────────────────────────────────────
// LinkedIn exports dates as "Mon YYYY" (e.g., "Jan 2020"), "YYYY",
// ISO dates ("2020-01-15"), or slash dates ("01/2020").

export const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function normalizeDate(raw: string | undefined | null): string {
  if (!raw || raw.trim() === "") return "";
  const trimmed = raw.trim();

  // "Jan 2020" → "2020-01"
  const monthYear = trimmed.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${month}`;
  }

  // "2020" → "2020"
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  // "2020-01" or "2020-01-15" → "2020-01" (keep month precision)
  const isoDate = trimmed.match(/^(\d{4}-\d{2})(?:-\d{2})?$/);
  if (isoDate) return isoDate[1];

  // "01/2020" or "1/2020" → "2020-01"
  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    return `${slashDate[2]}-${slashDate[1].padStart(2, "0")}`;
  }

  // Fall through: return as-is
  return trimmed;
}

export function normalizeDateOrNull(raw: string | undefined | null): string | null {
  const result = normalizeDate(raw);
  return result === "" ? null : result;
}

export function safeString(val: string | undefined | null): string {
  return val?.trim() ?? "";
}

// ─── LinkedIn Zip Extraction ────────────────────────────────────────────────
// Automatically extracts CSV files from LinkedIn data export zip archives.

export function extractLinkedInZip(
  linkedinDir: string,
): { extracted: number; zipName: string } | null {
  if (!fs.existsSync(linkedinDir)) return null;

  const entries = fs.readdirSync(linkedinDir);
  const csvFiles = entries.filter((f) => f.toLowerCase().endsWith(".csv"));
  const zipFiles = entries.filter((f) => f.toLowerCase().endsWith(".zip"));

  // Skip extraction if CSVs already exist or no zips found
  if (csvFiles.length > 0 || zipFiles.length === 0) return null;

  // Use the most recent zip file (by name, which includes date for LinkedIn exports)
  const zipFile = zipFiles.sort().reverse()[0];
  const zipPath = path.join(linkedinDir, zipFile);

  console.log(`   📦 Found LinkedIn export: ${zipFile}`);
  console.log("   📦 Extracting top-level CSV files...\n");

  // Extract top-level CSVs using Python3's zipfile (stdlib, no install needed)
  const pythonScript = `
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1])
extracted = []
for f in z.infolist():
    if '/' not in f.filename and f.filename.lower().endswith('.csv'):
        z.extract(f, sys.argv[2])
        extracted.append(f.filename)
print(json.dumps(extracted))
`;

  try {
    const result = execFileSync("python3", ["-c", pythonScript, zipPath, linkedinDir], {
      encoding: "utf-8",
      timeout: 30000,
    });
    const extracted: string[] = JSON.parse(result.trim());
    for (const name of extracted) {
      console.log(`      ${name}`);
    }
    console.log(`\n   📦 Extracted ${extracted.length} CSV files from ${zipFile}\n`);
    return { extracted: extracted.length, zipName: zipFile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`   ⚠ Zip extraction failed: ${message}`);
    console.warn(
      "   You can manually extract the zip: unzip <file>.zip -d data/sources/linkedin/\n",
    );
    return null;
  }
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

/** Strip UTF-8 BOM that Windows LinkedIn exports often prepend. */
export function stripBOM(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function parseCSV<T>(filePath: string): T[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const content = stripBOM(raw);
  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.warn(
        `  ⚠ Parse warning in ${path.basename(filePath)} row ${err.row ?? "?"}: ${err.message}`,
      );
    }
  }

  return result.data;
}

// ─── Skip Logic ──────────────────────────────────────────────────────────────
// Hash all input files (LinkedIn CSVs + knowledge JSONs) and compare to a
// stored hash. Skip ingestion if inputs haven't changed.

/** Recursively collect all file paths under a directory. */
function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results.sort();
}

export function computeInputHash(): string {
  const hash = crypto.createHash("sha256");
  const dirs = [PATHS.linkedinDir, PATHS.knowledgeDir];
  for (const dir of dirs) {
    for (const filePath of collectFiles(dir)) {
      hash.update(filePath);
      hash.update(fs.readFileSync(filePath));
    }
  }
  return hash.digest("hex");
}

export function shouldSkipIngest(): boolean {
  if (!fs.existsSync(PATHS.ingestHash)) return false;
  if (!fs.existsSync(PATHS.careerDataOutput)) return false;
  const storedHash = fs.readFileSync(PATHS.ingestHash, "utf-8").trim();
  const currentHash = computeInputHash();
  return storedHash === currentHash;
}

export function writeIngestHash(): void {
  const hash = computeInputHash();
  fs.writeFileSync(PATHS.ingestHash, hash, "utf-8");
}

// ─── Zod Validation Schema ───────────────────────────────────────────────────

export const CareerDataSchema = z.object({
  profile: z.object({
    name: z.string().min(1, "Profile name is required"),
    headline: z.string(),
    summary: z.string(),
    location: z.string(),
    email: z.string(),
    linkedin: z.string(),
    website: z.string(),
    github: z.string().optional(),
  }),
  positions: z.array(
    z.object({
      title: z.string().min(1, "Position title is required"),
      company: z.string().min(1, "Company name is required"),
      location: z.string(),
      startDate: z.string().min(1, "Start date is required"),
      endDate: z.string().nullable(),
      description: z.string(),
      highlights: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      school: z.string().min(1, "School name is required"),
      degree: z.string(),
      field: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      notes: z.string(),
      activities: z.string(),
    }),
  ),
  skills: z.array(z.string()),
  certifications: z.array(
    z.object({
      name: z.string(),
      authority: z.string(),
      date: z.string(),
      licenseNumber: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
  projects: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      url: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
    }),
  ),
  publications: z.array(
    z.object({
      name: z.string(),
      publisher: z.string(),
      date: z.string(),
      url: z.string().optional(),
      description: z.string(),
    }),
  ),
  languages: z.array(
    z.object({
      name: z.string(),
      proficiency: z.string(),
    }),
  ),
  recommendations: z.array(
    z.object({
      recommender: z.string(),
      text: z.string(),
      date: z.string(),
    }),
  ),
  honors: z.array(
    z.object({
      title: z.string(),
      issuer: z.string(),
      date: z.string(),
      description: z.string(),
    }),
  ),
  volunteering: z.array(
    z.object({
      organization: z.string(),
      role: z.string(),
      cause: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      description: z.string(),
    }),
  ),
  courses: z.array(
    z.object({
      name: z.string(),
      number: z.string(),
      associatedWith: z.string(),
    }),
  ),
  knowledge: z.array(
    z.object({
      category: z.string(),
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional(),
      relatedPositions: z.array(z.string()).optional(),
    }),
  ),
});

export function buildStats(csvFilesFound: number, csvFilesParsed: number, data: CareerData) {
  return {
    csvFilesFound,
    csvFilesParsed,
    positions: data.positions.length,
    education: data.education.length,
    skills: data.skills.length,
    certifications: data.certifications.length,
    projects: data.projects.length,
    publications: data.publications.length,
  };
}
