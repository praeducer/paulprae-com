/**
 * lib/prompts/hydrate-rules.ts — Render writing rules as prose for prompt injection.
 *
 * Phase A3 of the SSOT refactor. These helpers convert the structured
 * writing-rules.json into prompt-ready text blocks. Used by lib/agent/context.ts
 * to substitute {{WRITING_RULES}}, {{SUPPRESSED_SKILLS}}, etc.
 *
 * The actual prompt cutovers (replacing inline rules with these placeholders)
 * happen in Phase A4 — deferred to post-merge to avoid quality regressions.
 */

import {
  getRulesFor,
  getAllRules,
  getSuppressedSkills,
  type RuleCategory,
  type WritingRule,
} from "../writing-rules";

/**
 * Render rules as a numbered prose list for prompt injection.
 * Format: "G1 (Entity-scope binding): Every metric, number..."
 */
export function renderRulesAsProse(categories?: RuleCategory[]): string {
  const rules = categories ? categories.flatMap((cat) => getRulesFor(cat)) : getAllRules();

  if (rules.length === 0) return "";

  return rules.map((r) => `${r.id} (${r.name}): ${r.rule}`).join("\n");
}

/**
 * Render rules for a specific category as a prose block with a header.
 */
export function renderCategoryBlock(category: RuleCategory, header?: string): string {
  const rules = getRulesFor(category);
  if (rules.length === 0) return "";

  const title = header ?? categoryDisplayName(category);
  const body = rules.map((r) => `- **${r.id}:** ${r.rule}`).join("\n");
  return `### ${title}\n\n${body}`;
}

/**
 * Render the suppressed skills list as a prompt-ready string.
 */
export function renderSuppressedSkills(): string {
  const skills = getSuppressedSkills();
  if (skills.length === 0) return "None";
  return skills.join(", ");
}

/**
 * Render a compact rule summary (ID + name only) for reference sections.
 */
export function renderRuleSummary(categories?: RuleCategory[]): string {
  const rules = categories ? categories.flatMap((cat) => getRulesFor(cat)) : getAllRules();

  return rules.map((r) => `${r.id}: ${r.name}`).join(", ");
}

/**
 * Render a single rule with examples for detailed prompt injection.
 */
export function renderRuleDetailed(rule: WritingRule): string {
  const parts = [`**${rule.id} — ${rule.name}:** ${rule.rule}`];
  if (rule.bad_example) parts.push(`  Bad: ${rule.bad_example}`);
  if (rule.good_example) parts.push(`  Good: ${rule.good_example}`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryDisplayName(category: RuleCategory): string {
  const names: Record<RuleCategory, string> = {
    grounding: "Grounding Rules",
    ethics: "Ethics Rules",
    voice: "Voice Rules",
    quality: "Quality Rules",
    cover_letter: "Cover Letter Rules",
  };
  return names[category];
}
