/**
 * generate-resume.ts — CareerData → Claude Opus 4.6 → Markdown Resume
 *
 * Loads data/career-data.json, constructs a rich prompt with brand voice
 * guidelines and resume formatting rules, calls Claude Opus 4.6 with
 * adaptive thinking at max effort, and writes the resume markdown output.
 *
 * Usage: npm run generate
 *        npx tsx scripts/generate-resume.ts
 *
 * Requires: ANTHROPIC_API_KEY in .env.local
 *
 * References:
 * - Anthropic Adaptive Thinking: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking
 * - Anthropic Effort Parameter: https://platform.claude.com/docs/en/build-with-claude/effort
 * - Brand voice guidelines: CLAUDE.md
 * - Resume format: TDD §5.2
 * - Job Finding Assistant Stage 4B: STAR method, ATS optimization
 */

import fs from "fs";
import path from "path";
import * as prettier from "prettier";
import { config } from "dotenv";
import { PATHS, CLAUDE } from "../lib/config.js";
import type { CareerData, GenerationResult } from "../lib/types.js";
import { isDirectRun, hasForceFlag } from "../lib/script-utils.js";
import { loadPrompt } from "../lib/prompts/loader.js";
import {
  generateWithPrompt,
  classifyError,
  estimateCost,
  logGeneration,
  formatTelemetrySummary,
} from "../lib/ai/index.js";
import type { GenerationTelemetry } from "../lib/ai/index.js";

// Load environment variables from .env.local
config({ path: PATHS.envFile });

// ─── Skip Logic ──────────────────────────────────────────────────────────────

function shouldSkipGenerate(): boolean {
  if (!fs.existsSync(PATHS.careerDataOutput)) return false;
  if (!fs.existsSync(PATHS.resumeStaging)) return false;

  const inputMtime = fs.statSync(PATHS.careerDataOutput).mtimeMs;
  const outputMtime = fs.statSync(PATHS.resumeStaging).mtimeMs;
  return outputMtime > inputMtime;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const {
  systemPrompt: SYSTEM_PROMPT,
  config: promptConfig,
  metadata: promptMetadata,
} = loadPrompt("resume-writer");

const INCLUDE_FEW_SHOT = promptConfig.includeFewShot !== false;
const PROMPT_VERSION = `${promptMetadata.id}@${promptMetadata.version}`;

// ─── Context Optimization ────────────────────────────────────────────────────
// Strip empty/null/empty-array fields and rarely-useful fields before
// serialization to reduce token count by ~20-30%.

/** Fields to omit from career data — rarely useful for resume generation. */
const OMIT_FIELDS = new Set(["licenseNumber", "activities", "cause", "number"]);

/**
 * Recursively strip empty strings, null values, empty arrays, and
 * fields in the OMIT_FIELDS set from an object tree.
 */
function stripEmpty(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    const filtered = obj.map(stripEmpty).filter((item) => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (OMIT_FIELDS.has(key)) continue;
      const cleaned = stripEmpty(value);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  // Scalar values: strip empty strings and nulls
  if (obj === null || obj === "") return undefined;
  return obj;
}

// ─── Build User Message ──────────────────────────────────────────────────────
// Structures career data into labeled sections with compact JSON to minimize
// token usage while preserving all data needed for resume generation.

function buildUserMessage(careerData: CareerData): string {
  const { knowledge, ...coreData } = careerData;

  // Strip empty fields and use compact JSON (no indentation) to save ~20% tokens
  const compactCore = JSON.stringify(stripEmpty(coreData));

  const sections: string[] = [
    "Generate a professional resume from this career data. Apply all formatting rules and quality criteria from your instructions.",
    "",
    "## Core Career Data",
    "",
    "This is the structured career history — positions, education, profile, certifications, projects, and publications. Use this as the primary factual source.",
    "",
    compactCore,
  ];

  if (knowledge.length > 0) {
    const compactKnowledge = JSON.stringify(stripEmpty(knowledge));
    sections.push(
      "",
      "## Supplementary Knowledge Base",
      "",
      "These are curated context entries providing additional detail — achievements with quantified metrics, domain expertise narratives, brand voice guidelines, and strategic positioning context. Use these to enrich position bullet points with specific impacts, metrics, and STAR-method narratives. When knowledge entries reference specific positions (via relatedPositions), integrate that context into those roles' bullets. Do not fabricate — only use data provided here.",
      "",
      compactKnowledge,
    );
  }

  return sections.join("\n");
}

// ─── Prettier Formatting ────────────────────────────────────────────────────

async function formatMarkdown(markdown: string): Promise<string> {
  const config = await prettier.resolveConfig(process.cwd());
  return prettier.format(markdown, {
    ...config,
    parser: "markdown",
  });
}

// ─── Post-Generation Validation ─────────────────────────────────────────────

function validateResumeOutput(markdown: string, careerData: CareerData): string[] {
  const warnings: string[] = [];

  const expectedSections = [
    "Professional Summary",
    "Professional Experience",
    "Education",
    "Technical Skills",
  ];
  for (const section of expectedSections) {
    if (!markdown.includes(`## ${section}`)) {
      warnings.push(`Missing expected section: "## ${section}"`);
    }
  }

  const charCount = markdown.length;
  if (charCount < 3000) {
    warnings.push(
      `Resume appears too short (${charCount.toLocaleString()} chars, expected 4000-10000 for ~2 pages)`,
    );
  } else if (charCount > 12000) {
    warnings.push(
      `Resume appears too long (${charCount.toLocaleString()} chars, target is ~2 pages / 4000-10000 chars)`,
    );
  }

  const recentPositions = careerData.positions
    .filter((p) => !p.endDate || p.endDate >= "2020")
    .slice(0, 5);
  for (const pos of recentPositions) {
    if (pos.company && !markdown.includes(pos.company)) {
      warnings.push(`Recent employer "${pos.company}" not found in generated resume`);
    }
  }

  if (!markdown.startsWith("# ")) {
    warnings.push("Resume does not start with H1 heading (# Name)");
  }

  const firstPersonPattern =
    /(?<![A-Za-z])I(?:\s+(?:led|built|managed|created|developed|designed|worked|helped|assisted|was|am|have|had))\b/;
  if (firstPersonPattern.test(markdown)) {
    warnings.push(
      'Resume contains first-person "I" statements (brand voice requires third-person)',
    );
  }

  const passiveMarkers = [
    "was responsible for",
    "was involved in",
    "was tasked with",
    "assisted with",
    "helped with",
    "participated in",
  ];
  for (const marker of passiveMarkers) {
    if (markdown.toLowerCase().includes(marker)) {
      warnings.push(`Resume contains passive/weak phrasing: "${marker}"`);
    }
  }

  const brokenLinks = /\[[^\]]*\]\([^)]*$|\[[^\]]*$\(/gm;
  if (brokenLinks.test(markdown)) {
    warnings.push("Resume contains malformed markdown link syntax");
  }

  const experienceSection =
    markdown.split("## Professional Experience")[1]?.split(/^## /m)[0] || "";
  if (experienceSection) {
    const numericDates = /\b(?:0?[1-9]|1[0-2])\/\d{4}\b/.test(experienceSection);
    if (numericDates) {
      warnings.push('Experience dates use numeric format (expected "Mon YYYY")');
    }
  }

  const positionBlocks = experienceSection.split(/^### /m).filter((b) => b.trim());
  for (const block of positionBlocks) {
    const bullets = block.match(/^- .+/gm) || [];
    const posTitle = block.split("\n")[0].trim();
    const actionVerbPattern =
      /^- (?:Led|Architected|Built|Designed|Delivered|Developed|Established|Scaled|Reduced|Automated|Deployed|Implemented|Launched|Managed|Mentored|Optimized|Spearheaded|Transformed|Created|Drove|Engineered|Executed|Integrated|Migrated|Orchestrated|Pioneered|Streamlined)/;
    const actionBullets = bullets.filter((b) => actionVerbPattern.test(b));
    if (bullets.length >= 2 && actionBullets.length < 2) {
      warnings.push(
        `Position "${posTitle}" has ${actionBullets.length}/${bullets.length} bullets starting with action verbs (recommend ≥2)`,
      );
    }

    // Quantification density: warn if a position has 2+ bullets but zero quantified metrics
    const quantPattern = /\d+[%+]|\$[\d,.]+|\d+M\+|\d+K\+|\d+,\d{3}|\d+\+\s|team of \d/;
    const quantBullets = bullets.filter((b) => quantPattern.test(b));
    if (bullets.length >= 2 && quantBullets.length === 0) {
      warnings.push(
        `Position "${posTitle}" has ${bullets.length} bullets but zero quantified metrics (numbers, percentages, dollar amounts)`,
      );
    }
  }

  // Minimum bullet count by recency tier
  const currentYear = new Date().getFullYear();
  for (const block of positionBlocks) {
    const posTitle = block.split("\n")[0].trim();
    const bullets = block.match(/^- .+/gm) || [];

    // Extract end date from the position block (format: "Mon YYYY – Mon YYYY" or "– Present")
    const dateMatch = block.match(
      /\|\s*(?:[A-Z][a-z]{2}\s+)?(\d{4})\s*[–-]\s*(?:Present|(?:[A-Z][a-z]{2}\s+)?(\d{4}))/,
    );
    let endYear = currentYear;
    if (dateMatch) {
      endYear = dateMatch[2] ? parseInt(dateMatch[2]) : currentYear;
    }

    const yearsAgo = currentYear - endYear;
    let minBullets: number;
    let tier: string;

    if (yearsAgo <= 2) {
      minBullets = 3;
      tier = "Tier 1 (last 2 years)";
    } else if (yearsAgo <= 5) {
      minBullets = 2;
      tier = "Tier 2 (2-5 years)";
    } else if (yearsAgo <= 10) {
      minBullets = 2;
      tier = "Tier 3 (5-10 years)";
    } else {
      minBullets = 1;
      tier = "Tier 4 (10+ years)";
    }

    if (bullets.length < minBullets) {
      warnings.push(
        `Position "${posTitle}" has ${bullets.length} bullet(s) — ${tier} minimum is ${minBullets}`,
      );
    }
  }

  return warnings;
}

// ─── Quality Scoring ─────────────────────────────────────────────────────────
// Numeric quality score for regression detection. Higher is better.

interface ResumeQualityScore {
  /** Total score (sum of all components) */
  total: number;
  /** Number of ## sections found */
  sectionCount: number;
  /** Number of positions in Experience section */
  positionCount: number;
  /** Total bullet count across all positions */
  totalBullets: number;
  /** Number of bullets containing quantified metrics */
  quantifiedBullets: number;
  /** Resume character count */
  charCount: number;
  /** Number of major companies (Fortune 500 / recognized brands) found */
  majorCompanyCoverage: number;
}

const MAJOR_COMPANIES = [
  "Arine",
  "Booz Allen Hamilton",
  "Amazon Web Services",
  "Slalom",
  "Red Ventures",
  "Microsoft",
  "Hyperbloom",
  "Modular Earth",
  "Mento",
  "TReNDS",
  "NeuroLex",
  "Decooda",
];

function scoreResume(markdown: string): ResumeQualityScore {
  const sectionCount = (markdown.match(/^## /gm) || []).length;

  const experienceSection =
    markdown.split("## Professional Experience")[1]?.split(/^## /m)[0] || "";
  const positionBlocks = experienceSection.split(/^### /m).filter((b) => b.trim());
  const positionCount = positionBlocks.length;

  let totalBullets = 0;
  let quantifiedBullets = 0;
  const quantPattern = /\d+[%+]|\$[\d,.]+|\d+M\+|\d+K\+|\d+,\d{3}|\d+\+\s|team of \d/;

  for (const block of positionBlocks) {
    const bullets = block.match(/^- .+/gm) || [];
    totalBullets += bullets.length;
    quantifiedBullets += bullets.filter((b) => quantPattern.test(b)).length;
  }

  const charCount = markdown.length;

  let majorCompanyCoverage = 0;
  for (const company of MAJOR_COMPANIES) {
    if (markdown.includes(company)) majorCompanyCoverage++;
  }

  // Scoring weights — each component contributes to the total
  const total =
    sectionCount * 5 + // ~6 sections × 5 = 30 points
    positionCount * 8 + // ~10 positions × 8 = 80 points
    totalBullets * 3 + // ~30 bullets × 3 = 90 points
    quantifiedBullets * 5 + // ~15 quant bullets × 5 = 75 points
    majorCompanyCoverage * 10 + // ~10 companies × 10 = 100 points
    Math.min(charCount / 100, 80); // max 80 points for length

  return {
    total: Math.round(total),
    sectionCount,
    positionCount,
    totalBullets,
    quantifiedBullets,
    charCount,
    majorCompanyCoverage,
  };
}

function formatScoreReport(label: string, score: ResumeQualityScore): string {
  return [
    `   ${label} Quality Score: ${score.total}`,
    `     Sections: ${score.sectionCount} | Positions: ${score.positionCount} | Bullets: ${score.totalBullets}`,
    `     Quantified bullets: ${score.quantifiedBullets}/${score.totalBullets} (${score.totalBullets > 0 ? Math.round((score.quantifiedBullets / score.totalBullets) * 100) : 0}%)`,
    `     Major companies: ${score.majorCompanyCoverage}/${MAJOR_COMPANIES.length} | Length: ${score.charCount.toLocaleString()} chars`,
  ].join("\n");
}

// ─── Main Generation Pipeline ────────────────────────────────────────────────

async function generate(): Promise<GenerationResult> {
  console.log("\n🤖 Resume Generation Pipeline\n");

  // Skip if resume is already newer than career data
  if (!hasForceFlag() && shouldSkipGenerate()) {
    console.log("   ✅ Staging resume is up to date (career data unchanged). Skipping generation.");
    console.log("   Use --force to override. Run 'npm run approve' to promote staging to live.\n");
    const existingMarkdown = fs.readFileSync(PATHS.resumeStaging, "utf-8");
    return {
      success: true,
      markdownLength: existingMarkdown.length,
      model: CLAUDE.model,
      stopReason: "skip",
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    };
  }

  console.log(`   Model: ${CLAUDE.model}`);
  console.log(
    `   Thinking: adaptive (effort: ${CLAUDE.effort} — Opus 4.6 exclusive, no constraints)`,
  );
  console.log(`   Max tokens: ${CLAUDE.maxTokens}\n`);

  // Load career data
  if (!fs.existsSync(PATHS.careerDataOutput)) {
    console.error(`❌ Career data not found: ${PATHS.careerDataOutput}\n`);
    console.error("   Run the ingestion step first: npm run ingest\n");
    process.exit(1);
  }

  const raw = fs.readFileSync(PATHS.careerDataOutput, "utf-8");
  const careerData: CareerData = JSON.parse(raw);

  console.log(
    `   Career data loaded: ${careerData.positions.length} positions, ${careerData.skills.length} skills\n`,
  );
  console.log("   ⏳ Calling Claude API (this may take 30-90 seconds with max effort)...\n");

  // Call Claude via the AI service layer
  const response = await generateWithPrompt("resume-writer", buildUserMessage(careerData));

  // Warn if output was truncated
  if (response.stopReason === "max_tokens") {
    console.warn("   ⚠ WARNING: Output was truncated (hit max_tokens limit).");
    console.warn(
      "   The resume may be incomplete. Consider increasing CLAUDE.maxTokens in lib/config.ts.\n",
    );
  }

  if (!response.text.trim()) {
    console.error("❌ Claude returned empty text content.\n");
    console.error("   Response stop reason:", response.stopReason);
    process.exit(1);
  }

  // Post-generation quality validation
  const validationWarnings = validateResumeOutput(response.text, careerData);
  for (const warning of validationWarnings) {
    console.warn(`   ⚠ ${warning}`);
  }

  // Quality regression detection — compare staging vs approved
  const stagingScore = scoreResume(response.text);
  console.log("\n" + formatScoreReport("📊 New (staging)", stagingScore));

  if (fs.existsSync(PATHS.resumeOutput)) {
    const approvedMarkdown = fs.readFileSync(PATHS.resumeOutput, "utf-8");
    const approvedScore = scoreResume(approvedMarkdown);
    console.log(formatScoreReport("📊 Current (approved)", approvedScore));

    const delta = stagingScore.total - approvedScore.total;
    const deltaPercent =
      approvedScore.total > 0 ? Math.round((delta / approvedScore.total) * 100) : 0;

    if (delta < 0) {
      console.warn(
        `\n   ⚠ QUALITY REGRESSION DETECTED: score dropped by ${Math.abs(delta)} points (${deltaPercent}%)`,
      );
      console.warn("   ⚠ The new resume scored LOWER than the current approved version.");
      console.warn(
        "   ⚠ Review carefully before approving. Run 'npm run compare' to see differences.\n",
      );
      validationWarnings.push(
        `Quality regression: staging score ${stagingScore.total} < approved score ${approvedScore.total} (${deltaPercent}% drop)`,
      );
    } else {
      console.log(`\n   ✅ Quality check: score improved by ${delta} points (+${deltaPercent}%)\n`);
    }
  }

  // Format with Prettier
  let formatted: string;
  try {
    formatted = await formatMarkdown(response.text);
    console.log("   ✨ Formatted with Prettier");
  } catch {
    console.warn("   ⚠ Prettier formatting failed — using raw output");
    formatted = response.text;
  }

  // Prepend generation header
  const header = [
    "<!-- This file is GENERATED by the AI pipeline. Do not edit directly. -->",
    "<!-- To regenerate: npm run generate -->",
    "<!-- To modify output: edit scripts/generate-resume.ts -->",
    `<!-- Generated: ${new Date().toISOString()} | Model: ${response.model} | Prompt: ${response.promptVersion} | Tokens: ${response.usage.outputTokens} -->`,
    "",
  ].join("\n");

  const finalContent = header + formatted;

  // Write to staging
  const outputDir = path.dirname(PATHS.resumeStaging);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(PATHS.resumeStaging, finalContent, "utf-8");

  // Auto-approve on first run
  const isFirstGeneration = !fs.existsSync(PATHS.resumeOutput);
  if (isFirstGeneration) {
    fs.copyFileSync(PATHS.resumeStaging, PATHS.resumeOutput);
    console.log("   📋 First generation — auto-approved (no previous version existed).");
  }

  // Log telemetry
  const cost = estimateCost(
    response.model,
    response.usage.inputTokens,
    response.usage.outputTokens,
    response.cacheStats.read,
  );

  const telemetry: GenerationTelemetry = {
    timestamp: new Date().toISOString(),
    model: response.model,
    promptVersion: response.promptVersion,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    thinkingTokens: response.thinkingTokens,
    cacheRead: response.cacheStats.read,
    cacheCreated: response.cacheStats.created,
    durationMs: response.durationMs,
    stopReason: response.stopReason,
    costEstimate: cost,
    markdownLength: finalContent.length,
    warnings: validationWarnings.length,
  };

  logGeneration(telemetry);

  console.log("   ✅ Resume generated:\n");
  console.log(formatTelemetrySummary(telemetry));
  console.log(`\n   📝 Written to staging: ${PATHS.resumeStaging}`);
  if (isFirstGeneration) {
    console.log("   📋 Auto-approved as first generation.\n");
  } else {
    console.log(
      "   💡 Run 'npm run compare' to review changes, then 'npm run approve' to go live.\n",
    );
  }

  const result: GenerationResult = {
    success: true,
    markdownLength: finalContent.length,
    model: response.model,
    stopReason: response.stopReason,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    durationMs: response.durationMs,
    promptVersion: response.promptVersion,
  };

  return result;
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export const _testExports = {
  SYSTEM_PROMPT,
  INCLUDE_FEW_SHOT,
  PROMPT_VERSION,
  promptMetadata,
  promptConfig,
  loadPrompt,
  buildUserMessage,
  validateResumeOutput,
  scoreResume,
  formatScoreReport,
  MAJOR_COMPANIES,
  formatMarkdown,
  shouldSkipGenerate,
  stripEmpty,
  generate,
};

// ─── Execute ─────────────────────────────────────────────────────────────────

if (isDirectRun("generate-resume")) {
  generate().catch((err) => {
    console.error("\n❌ Generation failed:\n");
    const classified = classifyError(err);
    console.error(`   ${classified.message}`);
    process.exit(1);
  });
} // end if (isDirectRun)
