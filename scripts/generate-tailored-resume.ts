/**
 * generate-tailored-resume.ts — Generate tailored resumes from prompt files.
 *
 * Thin wrapper around lib/tailored.ts for resume-specific generation.
 *
 * Usage:
 *   npm run generate:tailored -- phoenix-technologies
 *   npm run generate:tailored -- data/prompts/tailored/phoenix-technologies.json
 *   npx tsx scripts/generate-tailored-resume.ts phoenix-technologies
 *
 * Prompt files live in data/prompts/tailored/ and follow TailoredPrompt schema.
 * Output: data/generated/tailored/Paul-Prae-Resume-<Company-Slug>.md
 *
 * Requires: ANTHROPIC_API_KEY in .env.local
 */

import fs from "fs";
import path from "path";
import {
  PROMPTS_DIR,
  OUTPUT_DIR,
  RESUME_FILE_BASE,
  CLAUDE,
  slugify,
  resolvePromptPath,
  loadPromptFile,
  loadCareerData,
  buildTailoredContext,
  formatMarkdown,
  writeTailoredOutput,
  shouldSkip,
  generateWithPrompt,
  classifyError,
  isDirectRun,
} from "../lib/tailored.js";
import { validateResume } from "../lib/resume-validator.js";

// ─── Resume-Specific Configuration ─────────────────────────────────────────

const RESUME_INSTRUCTION =
  "Generate a tailored resume for the following job description. Apply all formatting, grounding, and quality rules from your instructions.";

// ─── Main Generation ────────────────────────────────────────────────────────

async function generate(promptInput: string): Promise<void> {
  const promptPath = resolvePromptPath(promptInput);
  const prompt = loadPromptFile(promptPath);
  const companySlug = slugify(prompt.company);
  const outputFile = path.join(OUTPUT_DIR, `${RESUME_FILE_BASE}-${companySlug}.md`);

  console.log("\n\ud83c\udfaf Tailored Resume Generation\n");
  console.log(`   Company: ${prompt.company}`);
  console.log(`   Role: ${prompt.role}`);
  if (prompt.url) console.log(`   URL: ${prompt.url}`);
  if (prompt.emphasisAreas?.length) {
    console.log(`   Emphasis: ${prompt.emphasisAreas.join(", ")}`);
  }
  console.log(`   Output: ${outputFile}`);

  // Skip if output is newer than prompt file (unless --force)
  if (shouldSkip(promptPath, outputFile)) {
    console.log(
      "\n   \u2705 Tailored resume is up to date (prompt unchanged). Skipping generation.",
    );
    console.log("   Use --force to override.\n");
    return;
  }

  console.log(`\n   Model: ${CLAUDE.model}`);
  console.log(
    `   Thinking: adaptive (effort: ${CLAUDE.effort} \u2014 Opus 4.6 exclusive, no constraints)`,
  );
  console.log(`   Max tokens: ${CLAUDE.maxTokens}\n`);

  // Load career data
  const careerData = loadCareerData();
  console.log(
    `   Career data loaded: ${careerData.positions.length} positions, ${careerData.skills.length} skills\n`,
  );
  console.log("   \u23f3 Calling Claude API (this may take 30-90 seconds with max effort)...\n");

  // Build user message with tailoring context
  const userMessage = buildTailoredContext(careerData, prompt, RESUME_INSTRUCTION);

  // Call Claude via the AI service layer
  const response = await generateWithPrompt("resume-writer", userMessage);

  // Warn if output was truncated
  if (response.stopReason === "max_tokens") {
    console.warn("   \u26a0 WARNING: Output was truncated (hit max_tokens limit).\n");
  }

  if (!response.text.trim()) {
    console.error("\u274c Claude returned empty text content.\n");
    console.error("   Response stop reason:", response.stopReason);
    process.exit(1);
  }

  // Post-generation validation (warn-only — tailored pipeline)
  // Shares lib/resume-validator.ts with the main generator so both paths
  // enforce the same deterministic quality checks.
  const validationWarnings = validateResume(response.text, careerData);
  if (validationWarnings.length > 0) {
    console.log(`\n   \u26a0 Validator warnings (${validationWarnings.length}):`);
    for (const warning of validationWarnings) {
      console.log(`      - ${warning}`);
    }
    console.log();
  } else {
    console.log("\n   \u2705 Validator: no warnings\n");
  }

  // Format with Prettier
  let formatted: string;
  try {
    formatted = await formatMarkdown(response.text);
    console.log("   \u2728 Formatted with Prettier");
  } catch {
    console.warn("   \u26a0 Prettier formatting failed \u2014 using raw output");
    formatted = response.text;
  }

  // Write output and log telemetry
  writeTailoredOutput(formatted, outputFile, prompt, response, promptPath);
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
          console.log(`  ${p.replace(".json", "")}  \u2192  ${data.company} \u2014 ${data.role}`);
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
    console.error("\n\u274c Tailored resume generation failed:\n");
    const classified = classifyError(err);
    console.error(`   ${classified.message}`);
    process.exit(1);
  });
}
