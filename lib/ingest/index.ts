/**
 * lib/ingest/index.ts — Barrel re-export for ingest modules.
 *
 * Provides a single import path for all ingest functionality:
 *   import { normalizeDate, normalizePositions, findJsonFiles } from "../lib/ingest/index.js";
 */

export {
  MONTH_MAP,
  normalizeDate,
  normalizeDateOrNull,
  safeString,
  stripBOM,
  parseCSV,
  extractLinkedInZip,
  computeInputHash,
  shouldSkipIngest,
  writeIngestHash,
  CareerDataSchema,
  buildStats,
} from "./utils.js";

export {
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
} from "./normalizers.js";

export {
  findJsonFiles,
  isKnowledgeEntry,
  wrapAsKnowledgeEntry,
  loadKnowledgeBase,
  enrichProfileFromKnowledge,
} from "./knowledge.js";
