/**
 * ingest-linkedin.ts — LinkedIn Data Export → CareerData JSON
 *
 * Orchestrates the ingestion pipeline: discovers CSVs, normalizes rows,
 * loads knowledge base, validates with Zod, and writes career-data.json.
 *
 * Core logic lives in lib/ingest/ modules:
 *   - utils.ts: dates, CSV parsing, validation schema, skip logic
 *   - normalizers.ts: LinkedIn CSV → CareerData transformers
 *   - knowledge.ts: knowledge base loading and profile enrichment
 *
 * Usage: npm run ingest
 *        npx tsx scripts/ingest-linkedin.ts
 */

import fs from "fs";
import path from "path";
import { isDirectRun, hasForceFlag } from "../lib/script-utils";
import { PATHS, LINKEDIN_CSV_FILES } from "../lib/config.js";
import {
  parseCSV,
  extractLinkedInZip,
  shouldSkipIngest,
  writeIngestHash,
  CareerDataSchema,
  buildStats,
} from "../lib/ingest/utils.js";
import {
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
} from "../lib/ingest/normalizers.js";
import { loadKnowledgeBase, enrichProfileFromKnowledge } from "../lib/ingest/knowledge.js";
import type {
  CareerData,
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

// ─── Main Ingestion Pipeline ─────────────────────────────────────────────────

function ingest(): IngestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("\n📂 LinkedIn Data Ingestion Pipeline\n");

  // Skip if inputs haven't changed
  if (!hasForceFlag() && shouldSkipIngest()) {
    console.log("   ✅ Inputs unchanged (hash match). Skipping ingestion.");
    console.log("   Use --force to override.\n");
    const raw = fs.readFileSync(PATHS.careerDataOutput, "utf-8");
    const data: CareerData = JSON.parse(raw);
    return {
      success: true,
      careerData: data,
      errors: [],
      warnings: [],
      stats: buildStats(0, 0, data),
    };
  }

  console.log(`   Source: ${PATHS.linkedinDir}`);
  console.log(`   Output: ${PATHS.careerDataOutput}\n`);

  // Initialize empty CareerData
  const data: CareerData = {
    profile: {
      name: "",
      headline: "",
      summary: "",
      location: "",
      email: "",
      linkedin: "",
      website: "",
    },
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

  // Check source directory exists
  if (!fs.existsSync(PATHS.linkedinDir)) {
    errors.push(
      `Directory not found: ${PATHS.linkedinDir}\n   Create it and add your LinkedIn CSV exports.`,
    );
    return { success: false, careerData: null, errors, warnings, stats: buildStats(0, 0, data) };
  }

  // Auto-extract LinkedIn zip if CSVs don't exist yet
  extractLinkedInZip(PATHS.linkedinDir);

  // Discover CSV files
  const allFiles = fs.readdirSync(PATHS.linkedinDir);
  const csvFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".csv"));

  console.log(`   Found ${csvFiles.length} CSV file(s):\n`);

  if (csvFiles.length === 0) {
    errors.push(
      'No CSV files found in data/sources/linkedin/.\n   Export your data from LinkedIn → Settings → Data Privacy → Get a copy of your data\n   Select "Download larger data archive" and place CSV files in data/sources/linkedin/',
    );
    return { success: false, careerData: null, errors, warnings, stats: buildStats(0, 0, data) };
  }

  let csvFilesParsed = 0;
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
          data.recommendations = normalizeRecommendations(
            parseCSV<LinkedInRecommendation>(filePath),
          );
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

  // Enrich profile from knowledge base
  enrichProfileFromKnowledge(data, PATHS.knowledgeDir);

  // Merge email into profile (after loop so Profile.csv can't overwrite)
  if (extractedEmail) {
    data.profile.email = extractedEmail;
  }

  // Check minimum data requirements
  if (data.positions.length === 0 && data.education.length === 0) {
    errors.push(
      'Insufficient data: no positions and no education records found.\n   Ensure Positions.csv and/or Education.csv are in data/sources/linkedin/\n   Make sure you selected "Download larger data archive" when exporting from LinkedIn.',
    );
  }

  if (errors.length > 0) {
    return {
      success: false,
      careerData: null,
      errors,
      warnings,
      stats: buildStats(csvFiles.length, csvFilesParsed, data),
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
      stats: buildStats(csvFiles.length, csvFilesParsed, data),
    };
  }

  // Write output
  const outputDir = path.dirname(PATHS.careerDataOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(PATHS.careerDataOutput, JSON.stringify(data, null, 2), "utf-8");

  const stats = buildStats(csvFiles.length, csvFilesParsed, data);

  console.log("   ✅ Ingestion complete:\n");
  console.log(`      ${stats.positions} positions`);
  console.log(`      ${stats.education} education records`);
  console.log(`      ${stats.skills} skills`);
  console.log(`      ${stats.certifications} certifications`);
  console.log(`      ${stats.projects} projects`);
  console.log(`      ${stats.publications} publications`);
  if (data.languages.length > 0) console.log(`      ${data.languages.length} languages`);
  if (data.recommendations.length > 0)
    console.log(`      ${data.recommendations.length} recommendations`);
  if (data.honors.length > 0) console.log(`      ${data.honors.length} honors`);
  if (data.volunteering.length > 0)
    console.log(`      ${data.volunteering.length} volunteering entries`);
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

  // Write input hash for future skip detection
  writeIngestHash();

  return { success: true, careerData: data, errors, warnings, stats };
}

// ─── Exports for Testing ──────────────────────────────────────────────────────
// Legacy _testExports maintained for backward compatibility during migration.
// Tests should migrate to importing directly from lib/ingest/ modules.

export { ingest };

// ─── Execute ─────────────────────────────────────────────────────────────────

if (isDirectRun("ingest-linkedin")) {
  const result = ingest();

  if (!result.success) {
    console.error("\n❌ Ingestion failed:\n");
    for (const err of result.errors) {
      console.error(`   ${err}\n`);
    }
    process.exit(1);
  }
} // end if (isDirectRun)
