/**
 * ingest-linkedin.ts — LinkedIn Data Export → CareerData JSON
 *
 * Scans data/linkedin/ for CSV files, parses them with PapaParse,
 * normalizes to the CareerData interface, validates with Zod,
 * and writes data/career-data.json.
 *
 * Usage: npm run ingest
 *        npx tsx scripts/ingest-linkedin.ts
 *
 * Sources:
 * - LinkedIn CSV schema: TDD §3, Reactive Resume (https://docs.rxresu.me)
 * - PapaParse: https://www.papaparse.com/
 * - Zod: https://zod.dev/
 */

import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { z } from "zod";
import type {
  CareerData,
  CareerPosition,
  CareerEducation,
  CareerCertification,
  CareerProject,
  CareerPublication,
  CareerLanguage,
  CareerRecommendation,
  CareerHonor,
  CareerVolunteering,
  CareerCourse,
  CareerProfile,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInSkill,
  LinkedInCertification,
  LinkedInProject,
  LinkedInPublication,
  LinkedInProfile,
  LinkedInLanguage,
  LinkedInRecommendation,
  LinkedInHonor,
  LinkedInVolunteering,
  LinkedInCourse,
  IngestResult,
} from "../lib/types.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const LINKEDIN_DIR = path.join(process.cwd(), "data", "linkedin");
const OUTPUT_PATH = path.join(process.cwd(), "data", "career-data.json");

// Map of CSV filenames (case-insensitive) → parser function name
const KNOWN_CSV_FILES: Record<string, string> = {
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
};

// ─── Date Normalization ──────────────────────────────────────────────────────
// LinkedIn exports dates as "Mon YYYY" (e.g., "Jan 2020") or just "YYYY"

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normalizeDate(raw: string | undefined | null): string {
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

  // "01/2020" or "1/2020" → "2020-01"
  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    return `${slashDate[2]}-${slashDate[1].padStart(2, "0")}`;
  }

  // Fall through: return as-is
  return trimmed;
}

function normalizeDateOrNull(raw: string | undefined | null): string | null {
  const result = normalizeDate(raw);
  return result === "" ? null : result;
}

function safeString(val: string | undefined | null): string {
  return val?.trim() ?? "";
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSV<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.warn(
        `  ⚠ Parse warning in ${path.basename(filePath)} row ${err.row ?? "?"}: ${err.message}`
      );
    }
  }

  return result.data;
}

// ─── Normalizers (LinkedIn CSV → CareerData) ─────────────────────────────────

function normalizePositions(rows: LinkedInPosition[]): CareerPosition[] {
  return rows
    .filter((r) => safeString(r["Company Name"]) || safeString(r["Title"]))
    .map((r) => ({
      title: safeString(r["Title"]),
      company: safeString(r["Company Name"]),
      location: safeString(r["Location"]),
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDateOrNull(r["Finished On"]),
      description: safeString(r["Description"]),
      highlights: [],
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function normalizeEducation(rows: LinkedInEducation[]): CareerEducation[] {
  return rows
    .filter((r) => safeString(r["School Name"]))
    .map((r) => ({
      school: safeString(r["School Name"]),
      degree: safeString(r["Degree Name"]),
      field: "",
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDate(r["Finished On"]),
      notes: safeString(r["Notes"]),
      activities: safeString(r["Activities"]),
    }));
}

function normalizeSkills(rows: LinkedInSkill[]): string[] {
  return rows
    .map((r) => safeString(r["Name"]))
    .filter((name) => name.length > 0);
}

function normalizeCertifications(
  rows: LinkedInCertification[]
): CareerCertification[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      authority: safeString(r["Authority"]),
      date: normalizeDate(r["Started On"]),
      licenseNumber: safeString(r["License Number"]) || undefined,
      url: safeString(r["Url"]) || undefined,
    }));
}

function normalizeProjects(rows: LinkedInProject[]): CareerProject[] {
  return rows
    .filter((r) => safeString(r["Title"]))
    .map((r) => ({
      title: safeString(r["Title"]),
      description: safeString(r["Description"]),
      url: safeString(r["Url"]) || undefined,
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDate(r["Finished On"]) || undefined,
    }));
}

function normalizePublications(
  rows: LinkedInPublication[]
): CareerPublication[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      publisher: safeString(r["Publisher"]),
      date: normalizeDate(r["Published On"]),
      url: safeString(r["Url"]) || undefined,
      description: safeString(r["Description"]),
    }));
}

function normalizeProfile(rows: LinkedInProfile[]): CareerProfile {
  const row = rows[0];
  if (!row) {
    return {
      name: "",
      headline: "",
      summary: "",
      location: "",
      email: "",
      linkedin: "",
      website: "",
    };
  }
  return {
    name: `${safeString(row["First Name"])} ${safeString(row["Last Name"])}`.trim(),
    headline: safeString(row["Headline"]),
    summary: safeString(row["Summary"]),
    location: safeString(row["Geo Location"]),
    email: "",
    linkedin: "",
    website: "",
  };
}

function normalizeLanguages(rows: LinkedInLanguage[]): CareerLanguage[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      proficiency: safeString(r["Proficiency"]),
    }));
}

function normalizeRecommendations(
  rows: LinkedInRecommendation[]
): CareerRecommendation[] {
  return rows
    .filter((r) => safeString(r["Text"]))
    .map((r) => ({
      recommender: safeString(r["Recommender"]),
      text: safeString(r["Text"]),
      date: normalizeDate(r["Date"]),
    }));
}

function normalizeHonors(rows: LinkedInHonor[]): CareerHonor[] {
  return rows
    .filter((r) => safeString(r["Title"]))
    .map((r) => ({
      title: safeString(r["Title"]),
      issuer: safeString(r["Issuer"]),
      date: normalizeDate(r["Issued On"]),
      description: safeString(r["Description"]),
    }));
}

function normalizeVolunteering(
  rows: LinkedInVolunteering[]
): CareerVolunteering[] {
  return rows
    .filter((r) => safeString(r["Organization"]))
    .map((r) => ({
      organization: safeString(r["Organization"]),
      role: safeString(r["Role"]),
      cause: safeString(r["Cause"]),
      startDate: normalizeDate(r["Started On"]),
      endDate: normalizeDateOrNull(r["Finished On"]),
      description: safeString(r["Description"]),
    }));
}

function normalizeCourses(rows: LinkedInCourse[]): CareerCourse[] {
  return rows
    .filter((r) => safeString(r["Name"]))
    .map((r) => ({
      name: safeString(r["Name"]),
      number: safeString(r["Number"]),
      associatedWith: safeString(r["Associated With"]),
    }));
}

// ─── Zod Validation Schema ───────────────────────────────────────────────────

const CareerDataSchema = z.object({
  profile: z.object({
    name: z.string(),
    headline: z.string(),
    summary: z.string(),
    location: z.string(),
    email: z.string(),
    linkedin: z.string(),
    website: z.string(),
  }),
  positions: z.array(z.object({
    title: z.string(),
    company: z.string(),
    location: z.string(),
    startDate: z.string(),
    endDate: z.string().nullable(),
    description: z.string(),
    highlights: z.array(z.string()),
  })),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string(),
    field: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    notes: z.string(),
    activities: z.string(),
  })),
  skills: z.array(z.string()),
  certifications: z.array(z.object({
    name: z.string(),
    authority: z.string(),
    date: z.string(),
    licenseNumber: z.string().optional(),
    url: z.string().optional(),
  })),
  projects: z.array(z.object({
    title: z.string(),
    description: z.string(),
    url: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
  })),
  publications: z.array(z.object({
    name: z.string(),
    publisher: z.string(),
    date: z.string(),
    url: z.string().optional(),
    description: z.string(),
  })),
  languages: z.array(z.object({
    name: z.string(),
    proficiency: z.string(),
  })),
  recommendations: z.array(z.object({
    recommender: z.string(),
    text: z.string(),
    date: z.string(),
  })),
  honors: z.array(z.object({
    title: z.string(),
    issuer: z.string(),
    date: z.string(),
    description: z.string(),
  })),
  volunteering: z.array(z.object({
    organization: z.string(),
    role: z.string(),
    cause: z.string(),
    startDate: z.string(),
    endDate: z.string().nullable(),
    description: z.string(),
  })),
  courses: z.array(z.object({
    name: z.string(),
    number: z.string(),
    associatedWith: z.string(),
  })),
});

// ─── Main Ingestion Pipeline ─────────────────────────────────────────────────

function ingest(): IngestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("\n📂 LinkedIn Data Ingestion Pipeline\n");
  console.log(`   Source: ${LINKEDIN_DIR}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);

  // Check source directory exists
  if (!fs.existsSync(LINKEDIN_DIR)) {
    errors.push(
      `Directory not found: ${LINKEDIN_DIR}\n   Create it and add your LinkedIn CSV exports.`
    );
    return { success: false, careerData: null, errors, warnings, stats: { csvFilesFound: 0, csvFilesParsed: 0, positions: 0, education: 0, skills: 0, certifications: 0, projects: 0, publications: 0 } };
  }

  // Discover CSV files
  const allFiles = fs.readdirSync(LINKEDIN_DIR);
  const csvFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".csv"));

  console.log(`   Found ${csvFiles.length} CSV file(s):\n`);

  if (csvFiles.length === 0) {
    errors.push(
      "No CSV files found in data/linkedin/.\n   Export your data from LinkedIn → Settings → Data Privacy → Get a copy of your data\n   Select \"Download larger data archive\" and place CSV files in data/linkedin/"
    );
    return { success: false, careerData: null, errors, warnings, stats: { csvFilesFound: 0, csvFilesParsed: 0, positions: 0, education: 0, skills: 0, certifications: 0, projects: 0, publications: 0 } };
  }

  // Initialize empty CareerData
  const data: CareerData = {
    profile: { name: "", headline: "", summary: "", location: "", email: "", linkedin: "", website: "" },
    positions: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    publications: [],
    languages: [],
    recommendations: [],
    honors: [],
    volunteering: [],
    courses: [],
  };

  let csvFilesParsed = 0;

  for (const file of csvFiles) {
    const filePath = path.join(LINKEDIN_DIR, file);
    const key = file.toLowerCase();
    const csvType = KNOWN_CSV_FILES[key];

    if (!csvType) {
      console.log(`   ⏭ ${file} (not career-relevant, skipping)`);
      warnings.push(`Skipped unrecognized CSV: ${file}`);
      continue;
    }

    console.log(`   📄 ${file} → ${csvType}`);

    try {
      switch (csvType) {
        case "positions":
          data.positions = normalizePositions(parseCSV<LinkedInPosition>(filePath));
          break;
        case "education":
          data.education = normalizeEducation(parseCSV<LinkedInEducation>(filePath));
          break;
        case "skills":
          data.skills = normalizeSkills(parseCSV<LinkedInSkill>(filePath));
          break;
        case "certifications":
          data.certifications = normalizeCertifications(parseCSV<LinkedInCertification>(filePath));
          break;
        case "projects":
          data.projects = normalizeProjects(parseCSV<LinkedInProject>(filePath));
          break;
        case "publications":
          data.publications = normalizePublications(parseCSV<LinkedInPublication>(filePath));
          break;
        case "profile":
          data.profile = normalizeProfile(parseCSV<LinkedInProfile>(filePath));
          break;
        case "languages":
          data.languages = normalizeLanguages(parseCSV<LinkedInLanguage>(filePath));
          break;
        case "recommendations":
          data.recommendations = normalizeRecommendations(parseCSV<LinkedInRecommendation>(filePath));
          break;
        case "honors":
          data.honors = normalizeHonors(parseCSV<LinkedInHonor>(filePath));
          break;
        case "volunteering":
          data.volunteering = normalizeVolunteering(parseCSV<LinkedInVolunteering>(filePath));
          break;
        case "courses":
          data.courses = normalizeCourses(parseCSV<LinkedInCourse>(filePath));
          break;
      }
      csvFilesParsed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to parse ${file}: ${message}`);
      console.warn(`   ⚠ Error parsing ${file}: ${message}`);
    }
  }

  console.log("");

  // Check minimum data requirements
  if (data.positions.length === 0 && data.education.length === 0) {
    errors.push(
      "Insufficient data: no positions and no education records found.\n   Ensure Positions.csv and/or Education.csv are in data/linkedin/\n   Make sure you selected \"Download larger data archive\" when exporting from LinkedIn."
    );
  }

  if (errors.length > 0) {
    return {
      success: false,
      careerData: null,
      errors,
      warnings,
      stats: { csvFilesFound: csvFiles.length, csvFilesParsed, positions: data.positions.length, education: data.education.length, skills: data.skills.length, certifications: data.certifications.length, projects: data.projects.length, publications: data.publications.length },
    };
  }

  // Validate with Zod
  const validation = CareerDataSchema.safeParse(data);
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      errors.push(`Validation error at ${issue.path.join(".")}: ${issue.message}`);
    }
    return {
      success: false,
      careerData: null,
      errors,
      warnings,
      stats: { csvFilesFound: csvFiles.length, csvFilesParsed, positions: data.positions.length, education: data.education.length, skills: data.skills.length, certifications: data.certifications.length, projects: data.projects.length, publications: data.publications.length },
    };
  }

  // Write output
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), "utf-8");

  const stats = {
    csvFilesFound: csvFiles.length,
    csvFilesParsed,
    positions: data.positions.length,
    education: data.education.length,
    skills: data.skills.length,
    certifications: data.certifications.length,
    projects: data.projects.length,
    publications: data.publications.length,
  };

  console.log("   ✅ Ingestion complete:\n");
  console.log(`      ${stats.positions} positions`);
  console.log(`      ${stats.education} education records`);
  console.log(`      ${stats.skills} skills`);
  console.log(`      ${stats.certifications} certifications`);
  console.log(`      ${stats.projects} projects`);
  console.log(`      ${stats.publications} publications`);
  if (data.languages.length > 0) console.log(`      ${data.languages.length} languages`);
  if (data.recommendations.length > 0) console.log(`      ${data.recommendations.length} recommendations`);
  if (data.honors.length > 0) console.log(`      ${data.honors.length} honors`);
  if (data.volunteering.length > 0) console.log(`      ${data.volunteering.length} volunteering entries`);
  if (data.courses.length > 0) console.log(`      ${data.courses.length} courses`);
  console.log(`\n   📝 Written to: ${OUTPUT_PATH}\n`);

  if (warnings.length > 0) {
    console.log("   ⚠ Warnings:");
    for (const w of warnings) {
      console.log(`     - ${w}`);
    }
    console.log("");
  }

  return { success: true, careerData: data, errors, warnings, stats };
}

// ─── Execute ─────────────────────────────────────────────────────────────────

const result = ingest();

if (!result.success) {
  console.error("\n❌ Ingestion failed:\n");
  for (const err of result.errors) {
    console.error(`   ${err}\n`);
  }
  process.exit(1);
}
