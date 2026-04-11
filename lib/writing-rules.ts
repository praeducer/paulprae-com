/**
 * lib/writing-rules.ts — Typed loader for the centralized writing-rules.json.
 *
 * Single source of truth for all writing rules used by:
 *   - lib/resume-validator.ts (suppressed skills, blocklist)
 *   - scripts/grade-content.ts (full rules payload for LLM grader)
 *   - lib/tailored.ts (writing rules injection into tailored prompts)
 *   - tests/data-consistency.test.ts (suppress list enforcement)
 *
 * Phase A1 of the SSOT refactor. See .claude/plans/remaining-phases-ssot.md.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WritingRule {
  id: string;
  name: string;
  rule: string;
  bad_example?: string;
  good_example?: string;
  violations_to_avoid?: string[];
  example?: string;
  note?: string;
}

export interface WritingRules {
  version: string;
  description: string;
  rules: {
    grounding: WritingRule[];
    ethics: WritingRule[];
    voice: WritingRule[];
    quality: WritingRule[];
    cover_letter: WritingRule[];
  };
  suppress_from_output: {
    description: string;
    skills: string[];
    note: string;
  };
  source_references: Record<string, string>;
}

export type RuleCategory = keyof WritingRules["rules"];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const RULES_PATH = path.join(
  process.cwd(),
  "data",
  "sources",
  "knowledge",
  "content",
  "writing-rules.json",
);

let cachedRules: WritingRules | null = null;

/**
 * Load and parse writing-rules.json. Caches the result for the process lifetime.
 * Returns null if the file is missing or malformed (logs a warning).
 */
export function loadWritingRules(): WritingRules | null {
  if (cachedRules) return cachedRules;

  try {
    if (!fs.existsSync(RULES_PATH)) {
      console.warn(`⚠ writing-rules.json not found at ${RULES_PATH}`);
      return null;
    }
    const raw = JSON.parse(fs.readFileSync(RULES_PATH, "utf-8")) as WritingRules;
    cachedRules = raw;
    return cachedRules;
  } catch (err) {
    console.warn(`⚠ Failed to parse writing-rules.json: ${err}`);
    return null;
  }
}

/** Reset the cache (useful in tests). */
export function resetWritingRulesCache(): void {
  cachedRules = null;
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Get all rules for a specific category (grounding, ethics, voice, quality, cover_letter).
 */
export function getRulesFor(category: RuleCategory): WritingRule[] {
  const rules = loadWritingRules();
  return rules?.rules[category] ?? [];
}

/**
 * Get all rules across all categories, optionally filtered by category list.
 */
export function getAllRules(categories?: RuleCategory[]): WritingRule[] {
  const rules = loadWritingRules();
  if (!rules) return [];

  const cats = categories ?? (Object.keys(rules.rules) as RuleCategory[]);
  return cats.flatMap((cat) => rules.rules[cat] ?? []);
}

/**
 * Get the list of skills that must never appear in generated output.
 */
export function getSuppressedSkills(): string[] {
  const rules = loadWritingRules();
  return rules?.suppress_from_output?.skills ?? [];
}

/**
 * Get the full rules object for injection into LLM prompts (grade-content, tailored).
 */
export function getRulesPayload(): WritingRules | null {
  return loadWritingRules();
}

/**
 * Look up a single rule by its ID (e.g., "G1", "E3", "V5").
 */
export function getRuleById(id: string): WritingRule | undefined {
  return getAllRules().find((r) => r.id === id);
}
