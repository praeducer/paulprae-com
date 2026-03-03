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
import Anthropic from "@anthropic-ai/sdk";
import * as prettier from "prettier";
import { config } from "dotenv";
import { PATHS, CLAUDE } from "../lib/config.js";
import type { CareerData, GenerationResult } from "../lib/types.js";
import { isDirectRun, hasForceFlag } from "../lib/script-utils.js";
import { loadPrompt } from "../lib/prompts/loader.js";

// Load environment variables from .env.local
config({ path: PATHS.envFile });

// ─── Skip Logic ──────────────────────────────────────────────────────────────
// Skip generation if the resume markdown is newer than career-data.json.

function shouldSkipGenerate(): boolean {
  if (!fs.existsSync(PATHS.careerDataOutput)) return false;
  if (!fs.existsSync(PATHS.resumeStaging)) return false;

  const inputMtime = fs.statSync(PATHS.careerDataOutput).mtimeMs;
  const outputMtime = fs.statSync(PATHS.resumeStaging).mtimeMs;
  return outputMtime > inputMtime;
}

// ─── System Prompt ───────────────────────────────────────────────────────────
// Loaded from lib/prompts/resume-writer.system.md (with YAML frontmatter)
// + lib/prompts/resume-writer.few-shot.md (appended when config.includeFewShot is true)
// + lib/prompts/resume-writer.config.json (prompt-specific overrides)
//
// The prompt is a first-class versioned asset. To edit the system prompt,
// modify the .system.md file — not this script.

const {
  systemPrompt: SYSTEM_PROMPT,
  config: promptConfig,
  metadata: promptMetadata,
} = loadPrompt("resume-writer");

// Re-derive legacy constants for backward compat with tests
const INCLUDE_FEW_SHOT = promptConfig.includeFewShot !== false;

// Prompt version for tracking in generated file headers
const PROMPT_VERSION = `${promptMetadata.id}@${promptMetadata.version}`;

// ─── Build User Message ──────────────────────────────────────────────────────
// Structures career data into labeled sections so Claude can reason about
// each dimension (career history, supplementary context, skills) separately.

function buildUserMessage(careerData: CareerData): string {
  // Separate knowledge entries from core career data for clearer context
  const { knowledge, ...coreData } = careerData;

  const sections: string[] = [
    "Generate a professional resume from this career data. Apply all formatting rules and quality criteria from your instructions.",
    "",
    "## Core Career Data",
    "",
    "This is the structured career history — positions, education, profile, certifications, projects, and publications. Use this as the primary factual source.",
    "",
    JSON.stringify(coreData, null, 2),
  ];

  if (knowledge.length > 0) {
    sections.push(
      "",
      "## Supplementary Knowledge Base",
      "",
      "These are curated context entries providing additional detail — achievements with quantified metrics, domain expertise narratives, brand voice guidelines, and strategic positioning context. Use these to enrich position bullet points with specific impacts, metrics, and STAR-method narratives. When knowledge entries reference specific positions (via relatedPositions), integrate that context into those roles' bullets. Do not fabricate — only use data provided here.",
      "",
      JSON.stringify(knowledge, null, 2),
    );
  }

  return sections.join("\n");
}

// ─── Prettier Formatting ────────────────────────────────────────────────────
// Format generated markdown with Prettier to ensure consistency. This prevents
// mismatches when `npm run format:check` runs and when files are copied to public/.

async function formatMarkdown(markdown: string): Promise<string> {
  const config = await prettier.resolveConfig(process.cwd());
  return prettier.format(markdown, {
    ...config,
    parser: "markdown",
  });
}

// ─── Post-Generation Validation ─────────────────────────────────────────────
// Checks that the generated resume meets basic structural requirements.
// Returns warnings (non-fatal) — the resume is still written to disk.

function validateResumeOutput(markdown: string, careerData: CareerData): string[] {
  const warnings: string[] = [];

  // Check expected H2 sections exist
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

  // Check reasonable length (~2 pages ≈ 4000-10000 chars of markdown)
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

  // Check that recent positions appear in the resume
  const recentPositions = careerData.positions
    .filter((p) => !p.endDate || p.endDate >= "2020")
    .slice(0, 5);
  for (const pos of recentPositions) {
    if (pos.company && !markdown.includes(pos.company)) {
      warnings.push(`Recent employer "${pos.company}" not found in generated resume`);
    }
  }

  // Check H1 heading exists (candidate name)
  if (!markdown.startsWith("# ")) {
    warnings.push("Resume does not start with H1 heading (# Name)");
  }

  // Check for first-person "I" statements (brand voice requires third-person)
  // Match standalone "I" as a word (not inside other words like "AI" or "LinkedIn")
  const firstPersonPattern =
    /(?<![A-Za-z])I(?:\s+(?:led|built|managed|created|developed|designed|worked|helped|assisted|was|am|have|had))\b/;
  if (firstPersonPattern.test(markdown)) {
    warnings.push(
      'Resume contains first-person "I" statements (brand voice requires third-person)',
    );
  }

  // Check for passive voice markers
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

  // Check for invalid markdown link syntax (unmatched brackets/parens)
  const brokenLinks = /\[[^\]]*\]\([^)]*$|\[[^\]]*$\(/gm;
  if (brokenLinks.test(markdown)) {
    warnings.push("Resume contains malformed markdown link syntax");
  }

  // Check date format consistency (should be "Mon YYYY" in experience sections)
  const experienceSection =
    markdown.split("## Professional Experience")[1]?.split(/^## /m)[0] || "";
  if (experienceSection) {
    // Dates in experience should follow "Mon YYYY" or "Present" — flag numeric-only dates
    const numericDates = /\b(?:0?[1-9]|1[0-2])\/\d{4}\b/.test(experienceSection);
    if (numericDates) {
      warnings.push('Experience dates use numeric format (expected "Mon YYYY")');
    }
  }

  // Check that experience bullets use action verbs (at least 2 per position)
  const positionBlocks = experienceSection.split(/^### /m).filter((b) => b.trim());
  for (const block of positionBlocks) {
    const bullets = block.match(/^- .+/gm) || [];
    const actionVerbPattern =
      /^- (?:Led|Architected|Built|Designed|Delivered|Developed|Established|Scaled|Reduced|Automated|Deployed|Implemented|Launched|Managed|Mentored|Optimized|Spearheaded|Transformed|Created|Drove|Engineered|Executed|Integrated|Migrated|Orchestrated|Pioneered|Streamlined)/;
    const actionBullets = bullets.filter((b) => actionVerbPattern.test(b));
    if (bullets.length >= 2 && actionBullets.length < 2) {
      const posTitle = block.split("\n")[0].trim();
      warnings.push(
        `Position "${posTitle}" has ${actionBullets.length}/${bullets.length} bullets starting with action verbs (recommend ≥2)`,
      );
    }
  }

  return warnings;
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

  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ ANTHROPIC_API_KEY not found.\n");
    console.error("   Create a .env.local file in the project root:");
    console.error("   ANTHROPIC_API_KEY=sk-ant-...\n");
    console.error("   Get your API key at: https://console.anthropic.com/settings/keys\n");
    process.exit(1);
  }

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

  // Call Claude Opus 4.6 with adaptive thinking at max effort.
  // Adaptive thinking (type: "adaptive") lets Opus 4.6 dynamically determine
  // how much to reason based on task complexity. Effort "max" is exclusive to
  // Opus 4.6 and provides "absolute maximum capability with no constraints on
  // token spending" — the highest quality setting available.
  //
  // Prompt caching: The system prompt (~2000 tokens) is marked with
  // cache_control so repeated generations reuse the cached prompt,
  // reducing latency and cost on iterative runs.
  //
  // Ref: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking
  // Ref: https://platform.claude.com/docs/en/build-with-claude/effort
  // Ref: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  const client = new Anthropic();
  const startTime = Date.now();

  // Use streaming to avoid HTTP timeout on long-running Opus 4.6 requests.
  // The SDK requires streaming for operations that may take >10 minutes.
  // Ref: https://github.com/anthropics/anthropic-sdk-typescript#long-requests
  const stream = client.messages.stream({
    model: CLAUDE.model,
    max_tokens: CLAUDE.maxTokens,
    thinking: CLAUDE.thinking,
    output_config: { effort: CLAUDE.effort },
    system: [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildUserMessage(careerData),
      },
    ],
  });

  // Collect the final message (same shape as client.messages.create() response)
  const response = await stream.finalMessage();

  const durationMs = Date.now() - startTime;

  // Warn if output was truncated (thinking can consume the token budget)
  if (response.stop_reason === "max_tokens") {
    console.warn("   ⚠ WARNING: Output was truncated (hit max_tokens limit).");
    console.warn(
      "   The resume may be incomplete. Consider increasing CLAUDE.maxTokens in lib/config.ts.\n",
    );
  }

  // Extract text content and count thinking tokens
  let markdown = "";
  let thinkingTokens = 0;
  for (const block of response.content) {
    if (block.type === "text") {
      markdown += block.text;
    } else if (block.type === "thinking") {
      thinkingTokens += block.thinking.length; // Approximate via char length
    }
  }

  if (!markdown.trim()) {
    console.error("❌ Claude returned empty text content.\n");
    console.error("   Response stop reason:", response.stop_reason);
    console.error("   Content blocks:", response.content.map((b) => b.type).join(", "));
    process.exit(1);
  }

  // Post-generation quality validation
  const validationWarnings = validateResumeOutput(markdown, careerData);
  for (const warning of validationWarnings) {
    console.warn(`   ⚠ ${warning}`);
  }

  // Format with Prettier for consistency (prevents format:check mismatches)
  let formatted: string;
  try {
    formatted = await formatMarkdown(markdown);
    console.log("   ✨ Formatted with Prettier");
  } catch {
    console.warn("   ⚠ Prettier formatting failed — using raw output");
    formatted = markdown;
  }

  // Prepend generation header
  const header = [
    "<!-- This file is GENERATED by the AI pipeline. Do not edit directly. -->",
    "<!-- To regenerate: npm run generate -->",
    "<!-- To modify output: edit scripts/generate-resume.ts -->",
    `<!-- Generated: ${new Date().toISOString()} | Model: ${CLAUDE.model} | Prompt: ${PROMPT_VERSION} | Tokens: ${response.usage.output_tokens} -->`,
    "",
  ].join("\n");

  const finalContent = header + formatted;

  // Write to staging (not directly to approved/live path)
  const outputDir = path.dirname(PATHS.resumeStaging);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(PATHS.resumeStaging, finalContent, "utf-8");

  // Auto-approve on first run: if no approved version exists yet, copy staging → approved
  // so the pipeline works out-of-the-box for new setups without requiring manual approval.
  const isFirstGeneration = !fs.existsSync(PATHS.resumeOutput);
  if (isFirstGeneration) {
    fs.copyFileSync(PATHS.resumeStaging, PATHS.resumeOutput);
    console.log("   📋 First generation — auto-approved (no previous version existed).");
  }

  // Report cache performance if available
  const usage = response.usage as unknown as Record<string, unknown>;
  const cacheRead =
    typeof usage.cache_read_input_tokens === "number" ? usage.cache_read_input_tokens : 0;
  const cacheCreation =
    typeof usage.cache_creation_input_tokens === "number" ? usage.cache_creation_input_tokens : 0;

  const result: GenerationResult = {
    success: true,
    markdownLength: finalContent.length,
    model: CLAUDE.model,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs,
    promptVersion: PROMPT_VERSION,
  };

  console.log("   ✅ Resume generated:\n");
  console.log(`      Model: ${result.model}`);
  console.log(`      Stop reason: ${result.stopReason}`);
  console.log(`      Input tokens: ${result.inputTokens.toLocaleString()}`);
  console.log(`      Output tokens: ${result.outputTokens.toLocaleString()}`);
  if (thinkingTokens > 0) {
    console.log(
      `      Thinking: ~${Math.round(thinkingTokens / 4).toLocaleString()} tokens (estimated)`,
    );
  }
  if (cacheRead > 0 || cacheCreation > 0) {
    console.log(
      `      Cache: ${cacheRead.toLocaleString()} read, ${cacheCreation.toLocaleString()} created`,
    );
  }
  console.log(`      Markdown length: ${result.markdownLength.toLocaleString()} chars`);
  console.log(`      Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  if (validationWarnings.length > 0) {
    console.log(`      Warnings: ${validationWarnings.length} quality check(s) flagged`);
  }
  console.log(`\n   📝 Written to staging: ${PATHS.resumeStaging}`);
  if (isFirstGeneration) {
    console.log("   📋 Auto-approved as first generation.\n");
  } else {
    console.log(
      "   💡 Run 'npm run compare' to review changes, then 'npm run approve' to go live.\n",
    );
  }

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
  formatMarkdown,
  shouldSkipGenerate,
  generate,
};

// ─── Execute ─────────────────────────────────────────────────────────────────
// Only run when executed directly (not when imported for testing).

if (isDirectRun("generate-resume")) {
  generate().catch((err) => {
    console.error("\n❌ Generation failed:\n");
    if (err instanceof Anthropic.APIError) {
      console.error(`   API Error: ${err.status} ${err.message}`);
      if (err.status === 401) {
        console.error("   Check your ANTHROPIC_API_KEY in .env.local");
      } else if (err.status === 429) {
        console.error("   Rate limited. Wait a moment and try again.");
      } else if (err.status === 529) {
        console.error("   API overloaded. Wait a moment and try again.");
      }
    } else {
      console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  });
} // end if (isDirectRun)
