/**
 * generate-tailored-resume.ts — Generate tailored resumes from prompt files.
 *
 * Reads a JSON prompt file containing job description, emphasis areas, and
 * audience context, then uses the resume-writer system prompt + career data
 * to generate a tailored resume via Claude Opus 4.6 with adaptive thinking.
 *
 * Usage:
 *   npm run generate:tailored -- phoenix-technologies
 *   npm run generate:tailored -- data/prompts/tailored/phoenix-technologies.json
 *   npx tsx scripts/generate-tailored-resume.ts phoenix-technologies
 *
 * Prompt files live in data/prompts/tailored/ and follow this schema:
 *   {
 *     "company": "Phoenix Technologies",
 *     "role": "Principal AI Engineer",
 *     "url": "https://example.com",
 *     "jobDescription": "...",
 *     "emphasisAreas": ["TypeScript", "eCommerce", ...],
 *     "targetAudience": "CTO context...",
 *     "additionalContext": "Company context..."
 *   }
 *
 * Output: data/generated/tailored/Paul-Prae-Resume-<Company-Slug>.md
 *
 * Requires: ANTHROPIC_API_KEY in .env.local
 */

import fs from "fs";
import path from "path";
import * as prettier from "prettier";
import { config } from "dotenv";
import { PATHS, CLAUDE, RESUME_FILE_BASE } from "../lib/config.js";
import type { CareerData } from "../lib/types.js";
import { isDirectRun, hasForceFlag } from "../lib/script-utils.js";
import { stripEmpty } from "../lib/data-utils.js";
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface TailoredPrompt {
  company: string;
  role: string;
  url?: string;
  jobDescription: string;
  emphasisAreas?: string[];
  targetAudience?: string;
  additionalContext?: string;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROMPTS_DIR = path.join(process.cwd(), "data", "prompts", "tailored");
const OUTPUT_DIR = path.join(process.cwd(), "data", "generated", "tailored");

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

function resolvePromptPath(input: string): string {
  // If it's already a full path or has .json extension, use as-is
  if (path.isAbsolute(input) || input.includes("/") || input.includes("\\")) {
    return input.endsWith(".json") ? input : `${input}.json`;
  }
  // Otherwise, resolve from the prompts directory
  const name = input.endsWith(".json") ? input : `${input}.json`;
  return path.join(PROMPTS_DIR, name);
}

function loadPromptFile(filePath: string): TailoredPrompt {
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

// ─── Build User Message ─────────────────────────────────────────────────────

const OMIT_FIELDS = new Set(["licenseNumber", "activities", "cause", "number"]);

function buildUserMessage(careerData: CareerData, prompt: TailoredPrompt): string {
  const { knowledge, ...coreData } = careerData;
  const companyData = loadCompanyData();

  const compactCore = JSON.stringify(stripEmpty(coreData, OMIT_FIELDS));
  const compactCompanies = JSON.stringify(stripEmpty(companyData, OMIT_FIELDS));

  const sections: string[] = [
    "Generate a tailored resume for the following job description. Apply all formatting, grounding, and quality rules from your instructions.",
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

  // Career data documents (same structure as standard generation)
  sections.push(
    "<documents>",
    '<document index="1">',
    "<source>career-data.json — Core career history (positions, education, profile, certifications, projects, publications)</source>",
    "<document_content>",
    compactCore,
    "</document_content>",
    "</document>",
  );

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

  return sections.filter((s) => s !== undefined).join("\n");
}

// ─── Prettier Formatting ────────────────────────────────────────────────────

async function formatMarkdown(markdown: string): Promise<string> {
  const config = await prettier.resolveConfig(process.cwd());
  return prettier.format(markdown, {
    ...config,
    parser: "markdown",
  });
}

// ─── Main Generation ────────────────────────────────────────────────────────

async function generate(promptInput: string): Promise<void> {
  const promptPath = resolvePromptPath(promptInput);
  const prompt = loadPromptFile(promptPath);
  const companySlug = slugify(prompt.company);
  const outputFile = path.join(OUTPUT_DIR, `${RESUME_FILE_BASE}-${companySlug}.md`);

  console.log("\n🎯 Tailored Resume Generation\n");
  console.log(`   Company: ${prompt.company}`);
  console.log(`   Role: ${prompt.role}`);
  if (prompt.url) console.log(`   URL: ${prompt.url}`);
  if (prompt.emphasisAreas?.length) {
    console.log(`   Emphasis: ${prompt.emphasisAreas.join(", ")}`);
  }
  console.log(`   Output: ${outputFile}`);

  // Skip if output is newer than prompt file (unless --force)
  if (!hasForceFlag() && fs.existsSync(outputFile)) {
    const promptMtime = fs.statSync(promptPath).mtimeMs;
    const outputMtime = fs.statSync(outputFile).mtimeMs;
    if (outputMtime > promptMtime) {
      console.log("\n   ✅ Tailored resume is up to date (prompt unchanged). Skipping generation.");
      console.log("   Use --force to override.\n");
      return;
    }
  }

  console.log(`\n   Model: ${CLAUDE.model}`);
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

  // Build user message with tailoring context
  const userMessage = buildUserMessage(careerData, prompt);

  // Call Claude via the AI service layer
  const response = await generateWithPrompt("resume-writer", userMessage);

  // Warn if output was truncated
  if (response.stopReason === "max_tokens") {
    console.warn("   ⚠ WARNING: Output was truncated (hit max_tokens limit).\n");
  }

  if (!response.text.trim()) {
    console.error("❌ Claude returned empty text content.\n");
    console.error("   Response stop reason:", response.stopReason);
    process.exit(1);
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
    "<!-- This file is GENERATED by the tailored resume pipeline. Do not edit directly. -->",
    `<!-- Company: ${prompt.company} | Role: ${prompt.role} -->`,
    `<!-- Prompt: ${path.relative(process.cwd(), promptPath)} -->`,
    `<!-- Generated: ${new Date().toISOString()} | Model: ${response.model} | Prompt: ${response.promptVersion} | Tokens: ${response.usage.outputTokens} -->`,
    "",
  ].join("\n");

  const finalContent = header + formatted;

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

  console.log("   ✅ Tailored resume generated:\n");
  console.log(formatTelemetrySummary(telemetry));
  console.log(`\n   📝 Written to: ${outputFile}\n`);
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

function printUsage(): void {
  console.log(`
Usage: npm run generate:tailored -- <prompt-name>

  <prompt-name>  Name of prompt file in data/prompts/tailored/ (without .json)
                 or full path to a prompt JSON file.

Examples:
  npm run generate:tailored -- phoenix-technologies
  npm run generate:tailored -- phoenix-technologies --force
  npx tsx scripts/generate-tailored-resume.ts phoenix-technologies

Prompt files: data/prompts/tailored/*.json
Output:       data/generated/tailored/<Resume-Base>-<Company-Slug>.md
`);

  // List available prompts
  if (fs.existsSync(PROMPTS_DIR)) {
    const prompts = fs.readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".json"));
    if (prompts.length > 0) {
      console.log("Available prompts:");
      for (const p of prompts) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, p), "utf-8"));
          console.log(`  ${p.replace(".json", "")}  →  ${data.company} — ${data.role}`);
        } catch {
          console.log(`  ${p.replace(".json", "")}`);
        }
      }
      console.log();
    }
  }
}

if (isDirectRun("generate-tailored-resume")) {
  // Find the prompt argument (skip --force and other flags)
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  generate(args[0]).catch((err) => {
    console.error("\n❌ Tailored resume generation failed:\n");
    const classified = classifyError(err);
    console.error(`   ${classified.message}`);
    process.exit(1);
  });
}
