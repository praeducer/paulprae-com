/**
 * lib/tailored.ts — Shared logic for tailored content generation.
 *
 * Provides common infrastructure used by both generate-tailored-resume.ts
 * and generate-tailored-cover-letter.ts (and future generators).
 *
 * Extracts: prompt loading, career data loading, writing rules injection,
 * context assembly, output writing, skip logic, and formatting.
 */

import fs from "fs";
import path from "path";
import * as prettier from "prettier";
import { config } from "dotenv";
import { PATHS, CLAUDE, RESUME_FILE_BASE } from "./config.js";
import type { CareerData } from "./types.js";
import { hasForceFlag } from "./script-utils.js";
import { stripEmpty } from "./data-utils.js";
import { estimateCost, logGeneration, formatTelemetrySummary } from "./ai/index.js";
import type { GenerationTelemetry, FullGenerationResponse } from "./ai/index.js";

// Load environment variables from .env.local
config({ path: PATHS.envFile, override: true });

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TailoredPrompt {
  company: string;
  role: string;
  url?: string;
  jobDescription: string;
  emphasisAreas?: string[];
  targetAudience?: string;
  additionalContext?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const PROMPTS_DIR = path.join(process.cwd(), "data", "prompts", "tailored");
export const OUTPUT_DIR = path.join(process.cwd(), "data", "generated", "tailored");

/** Re-export for scripts that build output filenames */
export { RESUME_FILE_BASE };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a company name to a filename-safe slug. */
export function slugify(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

/** Resolve a prompt name or path to a full file path. */
export function resolvePromptPath(input: string): string {
  // If it's already a full path or has directory separators, use as-is
  if (path.isAbsolute(input) || input.includes("/") || input.includes("\\")) {
    return input.endsWith(".json") ? input : `${input}.json`;
  }
  // Otherwise, resolve from the prompts directory
  const name = input.endsWith(".json") ? input : `${input}.json`;
  return path.join(PROMPTS_DIR, name);
}

/** Load and validate a tailored prompt JSON file. */
export function loadPromptFile(filePath: string): TailoredPrompt {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!raw.company || typeof raw.company !== "string") {
    throw new Error('Prompt file must have a "company" string field');
  }
  if (!raw.jobDescription || typeof raw.jobDescription !== "string") {
    throw new Error('Prompt file must have a "jobDescription" string field');
  }
  return raw as TailoredPrompt;
}

/** Load career-data.json with error handling. */
export function loadCareerData(): CareerData {
  if (!fs.existsSync(PATHS.careerDataOutput)) {
    console.error(`\u274c Career data not found: ${PATHS.careerDataOutput}\n`);
    console.error("   Run the ingestion step first: npm run ingest\n");
    process.exit(1);
  }
  const raw = fs.readFileSync(PATHS.careerDataOutput, "utf-8");
  return JSON.parse(raw) as CareerData;
}

/** Load writing-rules.json from knowledge sources. */
export function loadWritingRules(): unknown {
  const rulesPath = path.join(PATHS.knowledgeDir, "content", "writing-rules.json");
  if (!fs.existsSync(rulesPath)) {
    console.warn("   \u26a0 writing-rules.json not found, skipping writing rules injection");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  } catch {
    console.warn("   \u26a0 Failed to parse writing-rules.json, skipping");
    return null;
  }
}

// ─── Company Data Loader ────────────────────────────────────────────────────

function loadCompanyData(): unknown[] {
  const companiesPath = path.join(PATHS.knowledgeDir, "career", "companies.json");
  if (!fs.existsSync(companiesPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(companiesPath, "utf-8"));
  } catch {
    return [];
  }
}

// ─── Context Builder ────────────────────────────────────────────────────────

const OMIT_FIELDS = new Set(["licenseNumber", "activities", "cause", "number"]);

/**
 * Build the full user message with career data, company data, knowledge base,
 * writing rules, and job context.
 *
 * @param careerData - Loaded career data
 * @param prompt - Tailored prompt with job description
 * @param contentTypeInstruction - Opening line that differs between resume/cover letter
 */
export function buildTailoredContext(
  careerData: CareerData,
  prompt: TailoredPrompt,
  contentTypeInstruction: string,
): string {
  const { knowledge, ...coreData } = careerData;
  const companyData = loadCompanyData();
  const writingRules = loadWritingRules();

  const compactCore = JSON.stringify(stripEmpty(coreData, OMIT_FIELDS));
  const compactCompanies = JSON.stringify(stripEmpty(companyData, OMIT_FIELDS));

  const sections: string[] = [
    contentTypeInstruction,
    "",
    "CRITICAL REMINDER: Before writing each position's bullet points, verify that every fact and metric belongs to THAT specific company and role. Never merge facts across companies.",
    "",
  ];

  // Job description and tailoring context
  sections.push(
    "<job_description>",
    `Company: ${prompt.company}`,
    `Role: ${prompt.role}`,
    prompt.url ? `URL: ${prompt.url}` : "",
    "",
    prompt.jobDescription,
    "</job_description>",
    "",
  );

  if (prompt.emphasisAreas?.length) {
    sections.push("<emphasis_areas>", prompt.emphasisAreas.join(", "), "</emphasis_areas>", "");
  }

  if (prompt.targetAudience) {
    sections.push("<target_audience>", prompt.targetAudience, "</target_audience>", "");
  }

  if (prompt.additionalContext) {
    sections.push("<additional_context>", prompt.additionalContext, "</additional_context>", "");
  }

  // Career data documents
  let docIndex = 1;

  sections.push(
    "<documents>",
    `<document index="${docIndex}">`,
    "<source>career-data.json \u2014 Core career history (positions, education, profile, certifications, projects, publications)</source>",
    "<document_content>",
    compactCore,
    "</document_content>",
    "</document>",
  );
  docIndex++;

  if (companyData.length > 0) {
    sections.push(
      `<document index="${docIndex}">`,
      "<source>companies.json \u2014 Verified company facts with timestamped metrics. When a company has a 'metrics' field, use THOSE numbers (not approximations from other sources).</source>",
      "<document_content>",
      compactCompanies,
      "</document_content>",
      "</document>",
    );
    docIndex++;
  }

  if (knowledge.length > 0) {
    const compactKnowledge = JSON.stringify(stripEmpty(knowledge, OMIT_FIELDS));
    sections.push(
      `<document index="${docIndex}">`,
      "<source>knowledge-base \u2014 Supplementary context: achievements with quantified metrics, domain expertise, STAR-method narratives. Entries with 'SCOPE BOUNDARY' markers contain mandatory constraints about what work was/was NOT done in specific roles. Entries with 'confidence: verified' are authoritative. Entries with 'relatedPositions' map to specific roles.</source>",
      "<document_content>",
      compactKnowledge,
      "</document_content>",
      "</document>",
    );
    docIndex++;
  }

  if (writingRules) {
    sections.push(
      `<document index="${docIndex}">`,
      "<source>writing-rules.json \u2014 Mandatory quality rules for all generated content. Follow every rule.</source>",
      "<document_content>",
      JSON.stringify(writingRules),
      "</document_content>",
      "</document>",
    );
    docIndex++;
  }

  sections.push("</documents>");

  return sections.filter((s) => s !== undefined).join("\n");
}

// ─── Prettier Formatting ────────────────────────────────────────────────────

/** Format markdown content with Prettier. */
export async function formatMarkdown(markdown: string): Promise<string> {
  const prettierConfig = await prettier.resolveConfig(process.cwd());
  return prettier.format(markdown, {
    ...prettierConfig,
    parser: "markdown",
  });
}

// ─── Output Writer ──────────────────────────────────────────────────────────

/**
 * Write generated content to file, log telemetry, and print summary.
 */
export function writeTailoredOutput(
  content: string,
  outputFile: string,
  prompt: TailoredPrompt,
  response: FullGenerationResponse,
  promptPath: string,
): void {
  // Prepend generation header
  const header = [
    "<!-- This file is GENERATED by the tailored content pipeline. Do not edit directly. -->",
    `<!-- Company: ${prompt.company} | Role: ${prompt.role} -->`,
    `<!-- Prompt: ${path.relative(process.cwd(), promptPath)} -->`,
    `<!-- Generated: ${new Date().toISOString()} | Model: ${response.model} | Prompt: ${response.promptVersion} | Tokens: ${response.usage.outputTokens} -->`,
    "",
  ].join("\n");

  const finalContent = header + content;

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(outputFile, finalContent, "utf-8");

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
    warnings: 0,
  };

  logGeneration(telemetry);

  console.log(`   \u2705 Content generated:\n`);
  console.log(formatTelemetrySummary(telemetry));
  console.log(`\n   \ud83d\udcdd Written to: ${outputFile}\n`);
}

// ─── Skip Logic ─────────────────────────────────────────────────────────────

/**
 * Check whether generation should be skipped (output newer than prompt).
 * Returns true if the output is up-to-date and --force was not passed.
 */
export function shouldSkip(promptPath: string, outputFile: string): boolean {
  if (hasForceFlag()) return false;
  if (!fs.existsSync(outputFile)) return false;

  const promptMtime = fs.statSync(promptPath).mtimeMs;
  const outputMtime = fs.statSync(outputFile).mtimeMs;
  return outputMtime > promptMtime;
}

// ─── Re-exports for convenience ─────────────────────────────────────────────

export { CLAUDE } from "./config.js";
export { generateWithPrompt, classifyError } from "./ai/index.js";
export type { FullGenerationResponse } from "./ai/index.js";
export { isDirectRun } from "./script-utils.js";
