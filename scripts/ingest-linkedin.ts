/**
 * ingest-linkedin.ts — LinkedIn Data Export → CareerData JSON
 *
 * Scans data/sources/linkedin/ for CSV files, parses them with PapaParse,
 * normalizes to the CareerData interface, validates with Zod,
 * and writes data/generated/career-data.json.
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
import { PATHS, LINKEDIN_CSV_FILES } from "../lib/config.js";
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
  KnowledgeEntry,
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
  LinkedInEmail,
  IngestResult,
} from "../lib/types.js";

// ─── Date Normalization ──────────────────────────────────────────────────────
// LinkedIn exports dates as "Mon YYYY" (e.g., "Jan 2020"), "YYYY",
// ISO dates ("2020-01-15"), or slash dates ("01/2020").

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

function normalizeDateOrNull(raw: string | undefined | null): string | null {
  const result = normalizeDate(raw);
  return result === "" ? null : result;
}

function safeString(val: string | undefined | null): string {
  return val?.trim() ?? "";
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

/** Strip UTF-8 BOM that Windows LinkedIn exports often prepend. */
function stripBOM(content: string): string {
  return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
}

function parseCSV<T>(filePath: string): T[] {
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
      name: "", headline: "", summary: "", location: "",
      email: "", linkedin: "", website: "",
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

/** Extract primary confirmed email from Email Addresses.csv */
function extractEmail(rows: LinkedInEmail[]): string {
  // Prefer primary + confirmed, then any confirmed, then first available
  const primary = rows.find(
    (r) => safeString(r["Primary"]).toLowerCase() === "yes"
      && safeString(r["Confirmed"]).toLowerCase() === "yes"
  );
  if (primary) return safeString(primary["Email Address"]);

  const confirmed = rows.find(
    (r) => safeString(r["Confirmed"]).toLowerCase() === "yes"
  );
  if (confirmed) return safeString(confirmed["Email Address"]);

  const first = rows[0];
  return first ? safeString(first["Email Address"]) : "";
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

// ─── Knowledge Base Profile Enrichment ──────────────────────────────────────
// career/profile.json has richer data than LinkedIn CSV (URLs, years of
// experience, etc.). Merge it into the CareerProfile to fill gaps.

function enrichProfileFromKnowledge(data: CareerData, knowledgeDir: string): void {
  const profilePath = path.join(knowledgeDir, "career", "profile.json");
  if (!fs.existsSync(profilePath)) return;

  try {
    const raw = fs.readFileSync(profilePath, "utf-8");
    const kbProfile = JSON.parse(raw);

    // Fill empty profile fields from knowledge base
    if (!data.profile.name && kbProfile.name) {
      data.profile.name = kbProfile.name;
    }
    if (!data.profile.headline && kbProfile.headline) {
      data.profile.headline = kbProfile.headline;
    }
    if (!data.profile.summary && kbProfile.summary) {
      data.profile.summary = kbProfile.summary;
    }
    if (!data.profile.location) {
      const loc = kbProfile.location;
      if (typeof loc === "string") {
        data.profile.location = loc;
      } else if (loc?.primary) {
        data.profile.location = loc.primary;
      }
    }
    if (!data.profile.linkedin && kbProfile.linkedin) {
      data.profile.linkedin = kbProfile.linkedin;
    }
    if (!data.profile.website && kbProfile.website) {
      data.profile.website = kbProfile.website;
    }

    console.log("   🔗 Enriched profile from knowledge base (career/profile.json)");
  } catch {
    // Non-fatal — knowledge base profile is supplementary
  }
}

// ─── Knowledge Base Loading ─────────────────────────────────────────────────
// Recursively reads all .json files from data/sources/knowledge/ and its
// subdirectories (career/, brand/, strategy/, agents/, content/).
// Files named "example.json" are skipped.
//
// Knowledge files have heterogeneous schemas — career data, brand narratives,
// strategy objects, etc. Files that already match KnowledgeEntry format are
// loaded directly. Others are wrapped as KnowledgeEntry with the subdirectory
// as category and file content as structured context for Claude.

/** Recursively find all .json files under a directory. */
function findJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(fullPath));
    } else if (
      entry.name.toLowerCase().endsWith(".json") &&
      entry.name.toLowerCase() !== "example.json"
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Check if an object matches the KnowledgeEntry schema. */
function isKnowledgeEntry(obj: unknown): obj is KnowledgeEntry {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "category" in obj &&
    "title" in obj &&
    "content" in obj &&
    typeof (obj as KnowledgeEntry).category === "string" &&
    typeof (obj as KnowledgeEntry).title === "string" &&
    typeof (obj as KnowledgeEntry).content === "string"
  );
}

/** Wrap arbitrary JSON data as a KnowledgeEntry for Claude context. */
function wrapAsKnowledgeEntry(
  filePath: string,
  data: unknown,
): KnowledgeEntry {
  const relPath = path.relative(PATHS.knowledgeDir, filePath);
  const parts = relPath.split(path.sep);
  const category = parts.length > 1 ? parts[0] : "general";
  const fileName = path.basename(filePath, ".json");

  return {
    category,
    title: fileName.replace(/-/g, " "),
    content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    tags: [category, fileName],
  };
}

function loadKnowledgeBase(): KnowledgeEntry[] {
  if (!fs.existsSync(PATHS.knowledgeDir)) {
    return [];
  }

  const files = findJsonFiles(PATHS.knowledgeDir);

  if (files.length === 0) {
    return [];
  }

  const entries: KnowledgeEntry[] = [];

  for (const filePath of files) {
    const relPath = path.relative(PATHS.knowledgeDir, filePath);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);

      // If the file contains KnowledgeEntry objects, load them directly
      if (Array.isArray(parsed) && parsed.length > 0 && isKnowledgeEntry(parsed[0])) {
        const items = parsed.filter(isKnowledgeEntry);
        entries.push(...items);
        console.log(`   📄 ${relPath} → ${items.length} knowledge entries`);
      } else if (isKnowledgeEntry(parsed)) {
        entries.push(parsed);
        console.log(`   📄 ${relPath} → 1 knowledge entry`);
      } else {
        // Wrap non-KnowledgeEntry JSON as contextual data for Claude
        entries.push(wrapAsKnowledgeEntry(filePath, parsed));
        console.log(`   📄 ${relPath} → 1 contextual entry (wrapped)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`   ⚠ Failed to parse knowledge file ${relPath}: ${message}`);
    }
  }

  return entries;
}

// ─── Zod Validation Schema ───────────────────────────────────────────────────

const CareerDataSchema = z.object({
  profile: z.object({
    name: z.string().min(1, "Profile name is required"),
    headline: z.string(),
    summary: z.string(),
    location: z.string(),
    email: z.string(),
    linkedin: z.string(),
    website: z.string(),
  }),
  positions: z.array(z.object({
    title: z.string().min(1, "Position title is required"),
    company: z.string().min(1, "Company name is required"),
    location: z.string(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().nullable(),
    description: z.string(),
    highlights: z.array(z.string()),
  })),
  education: z.array(z.object({
    school: z.string().min(1, "School name is required"),
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
  knowledge: z.array(z.object({
    category: z.string(),
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    relatedPositions: z.array(z.string()).optional(),
  })),
});

// ─── Main Ingestion Pipeline ─────────────────────────────────────────────────

function ingest(): IngestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("\n📂 LinkedIn Data Ingestion Pipeline\n");
  console.log(`   Source: ${PATHS.linkedinDir}`);
  console.log(`   Output: ${PATHS.careerDataOutput}\n`);

  const emptyStats = { csvFilesFound: 0, csvFilesParsed: 0, positions: 0, education: 0, skills: 0, certifications: 0, projects: 0, publications: 0 };

  // Check source directory exists
  if (!fs.existsSync(PATHS.linkedinDir)) {
    errors.push(
      `Directory not found: ${PATHS.linkedinDir}\n   Create it and add your LinkedIn CSV exports.`
    );
    return { success: false, careerData: null, errors, warnings, stats: emptyStats };
  }

  // Discover CSV files
  const allFiles = fs.readdirSync(PATHS.linkedinDir);
  const csvFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".csv"));

  console.log(`   Found ${csvFiles.length} CSV file(s):\n`);

  if (csvFiles.length === 0) {
    errors.push(
      "No CSV files found in data/sources/linkedin/.\n   Export your data from LinkedIn → Settings → Data Privacy → Get a copy of your data\n   Select \"Download larger data archive\" and place CSV files in data/sources/linkedin/"
    );
    return { success: false, careerData: null, errors, warnings, stats: emptyStats };
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
    knowledge: [],
  };

  let csvFilesParsed = 0;
  // Email is extracted separately and merged after the loop so that
  // Profile.csv (which creates a fresh profile object) can't overwrite it.
  let extractedEmail = "";

  for (const file of csvFiles) {
    const filePath = path.join(PATHS.linkedinDir, file);
    const key = file.toLowerCase();
    const csvType = LINKEDIN_CSV_FILES[key];

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
        case "email":
          extractedEmail = extractEmail(parseCSV<LinkedInEmail>(filePath));
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

  // Load knowledge base
  const knowledgeEntries = loadKnowledgeBase();
  if (knowledgeEntries.length > 0) {
    data.knowledge = knowledgeEntries;
    console.log(`   📚 Loaded ${knowledgeEntries.length} knowledge base entries\n`);
  }

  // Enrich profile from knowledge base (career/profile.json has linkedin, website, github, etc.)
  enrichProfileFromKnowledge(data, PATHS.knowledgeDir);

  // Merge email into profile (after loop so Profile.csv can't overwrite)
  if (extractedEmail) {
    data.profile.email = extractedEmail;
  }

  // Check minimum data requirements
  if (data.positions.length === 0 && data.education.length === 0) {
    errors.push(
      "Insufficient data: no positions and no education records found.\n   Ensure Positions.csv and/or Education.csv are in data/sources/linkedin/\n   Make sure you selected \"Download larger data archive\" when exporting from LinkedIn."
    );
  }

  // Build stats once, reuse for all return paths
  const buildStats = () => ({
    csvFilesFound: csvFiles.length,
    csvFilesParsed,
    positions: data.positions.length,
    education: data.education.length,
    skills: data.skills.length,
    certifications: data.certifications.length,
    projects: data.projects.length,
    publications: data.publications.length,
  });

  if (errors.length > 0) {
    return { success: false, careerData: null, errors, warnings, stats: buildStats() };
  }

  // Validate with Zod
  const validation = CareerDataSchema.safeParse(data);
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      errors.push(`Validation error at ${issue.path.join(".")}: ${issue.message}`);
    }
    return { success: false, careerData: null, errors, warnings, stats: buildStats() };
  }

  // Write output
  const outputDir = path.dirname(PATHS.careerDataOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(PATHS.careerDataOutput, JSON.stringify(data, null, 2), "utf-8");

  const stats = buildStats();

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
  if (data.knowledge.length > 0) console.log(`      ${data.knowledge.length} knowledge entries`);
  if (data.profile.email) console.log(`      email: ${data.profile.email}`);
  console.log(`\n   📝 Written to: ${PATHS.careerDataOutput}\n`);

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
