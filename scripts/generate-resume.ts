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
import { stripEmpty } from "../lib/data-utils.js";
import {
  generateWithPrompt,
  classifyError,
  estimateCost,
  logGeneration,
  formatTelemetrySummary,
} from "../lib/ai/index.js";
import type { GenerationTelemetry } from "../lib/ai/index.js";
import { scoreResume, formatScoreReport, MAJOR_COMPANIES } from "../lib/resume-quality.js";
import { validateResume } from "../lib/resume-validator.js";

// Load environment variables from .env.local
config({ path: PATHS.envFile, override: true });

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

// ─── Company Data Loader ────────────────────────────────────────────────────
// Loads verified company metrics from data/sources/knowledge/career/companies.json

function loadCompanyData(): unknown[] {
  const companiesPath = path.join(PATHS.knowledgeDir, "career", "companies.json");
  if (!fs.existsSync(companiesPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(companiesPath, "utf-8"));
  } catch {
    return [];
  }
}

// ─── Build User Message ──────────────────────────────────────────────────────
// Structures career data into XML-tagged documents for clear source separation.
// This prevents the AI from accidentally conflating facts across data sources.

function buildUserMessage(careerData: CareerData): string {
  const { knowledge, ...coreData } = careerData;
  const companyData = loadCompanyData();

  // Strip empty fields and use compact JSON to save tokens
  const compactCore = JSON.stringify(stripEmpty(coreData, OMIT_FIELDS));
  const compactCompanies = JSON.stringify(stripEmpty(companyData, OMIT_FIELDS));

  const sections: string[] = [
    "Generate a professional resume from the career data below. Apply all formatting, grounding, and quality rules from your instructions.",
    "",
    "CRITICAL REMINDER: Before writing each position's bullet points, verify that every fact and metric belongs to THAT specific company and role. Never merge facts across companies.",
    "",
    "<documents>",
    '<document index="1">',
    "<source>career-data.json — Core career history (positions, education, profile, certifications, projects, publications)</source>",
    "<document_content>",
    compactCore,
    "</document_content>",
    "</document>",
  ];

  if (companyData.length > 0) {
    sections.push(
      '<document index="2">',
      "<source>companies.json — Verified company facts with timestamped metrics. When a company has a 'metrics' field, use THOSE numbers (not approximations from other sources).</source>",
      "<document_content>",
      compactCompanies,
      "</document_content>",
      "</document>",
    );
  }

  if (knowledge.length > 0) {
    const compactKnowledge = JSON.stringify(stripEmpty(knowledge, OMIT_FIELDS));
    sections.push(
      `<document index="${companyData.length > 0 ? "3" : "2"}">`,
      "<source>knowledge-base — Supplementary context: achievements with quantified metrics, domain expertise, STAR-method narratives. Entries with 'SCOPE BOUNDARY' markers contain mandatory constraints about what work was/was NOT done in specific roles. Entries with 'confidence: verified' are authoritative. Entries with 'relatedPositions' map to specific roles.</source>",
      "<document_content>",
      compactKnowledge,
      "</document_content>",
      "</document>",
    );
  }

  sections.push("</documents>");

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
// Extracted to lib/resume-validator.ts so the tailored pipeline
// (generate-tailored-resume.ts) can share the same rules.
// The local wrapper preserves the original name for tests/generate.test.ts.

function validateResumeOutput(markdown: string, careerData: CareerData): string[] {
  return validateResume(markdown, careerData);
}

// ─── Quality Scoring ─────────────────────────────────────────────────────────
// Imported from lib/resume-quality.ts (shared with approve-resume.ts)

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
  OMIT_FIELDS,
  loadCompanyData,
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
