/**
 * lib/ingest/knowledge.ts — Knowledge base loading and profile enrichment.
 *
 * Recursively reads JSON files from data/sources/knowledge/, detects
 * KnowledgeEntry format vs arbitrary JSON, and enriches CareerProfile
 * from career/profile.json.
 */

import fs from "fs";
import path from "path";
import { PATHS } from "../config.js";
import type { CareerData, KnowledgeEntry } from "../types.js";

/** Recursively find all .json files under a directory. */
export function findJsonFiles(dir: string): string[] {
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
export function isKnowledgeEntry(obj: unknown): obj is KnowledgeEntry {
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
export function wrapAsKnowledgeEntry(filePath: string, data: unknown): KnowledgeEntry {
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

export function loadKnowledgeBase(): KnowledgeEntry[] {
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

/** Enrich CareerProfile from knowledge base career/profile.json. */
export function enrichProfileFromKnowledge(data: CareerData, knowledgeDir: string): void {
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
    if (!data.profile.github && kbProfile.github) {
      data.profile.github = kbProfile.github;
    }

    console.log("   🔗 Enriched profile from knowledge base (career/profile.json)");
  } catch {
    // Non-fatal — knowledge base profile is supplementary
  }
}
