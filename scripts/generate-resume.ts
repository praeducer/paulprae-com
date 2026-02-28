/**
 * generate-resume.ts — CareerData → Claude Opus 4.6 → Markdown Resume
 *
 * Loads data/career-data.json, constructs a rich prompt with brand voice
 * guidelines and resume formatting rules, calls Claude Opus 4.6 with
 * adaptive thinking at max effort, and writes data/generated/resume.md.
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
import { config } from "dotenv";
import { PATHS, CLAUDE } from "../lib/config.js";
import type { CareerData, GenerationResult } from "../lib/types.js";

// Load environment variables from .env.local
config({ path: PATHS.envFile });

// ─── System Prompt ───────────────────────────────────────────────────────────
// Encodes brand voice, formatting rules, quality criteria, and target context.
// Kept separate from career data so it's stable across regenerations.

const SYSTEM_PROMPT = `You are an elite professional resume writer and career strategist specializing in senior technology leadership roles. You produce polished, ATS-optimized resumes that position candidates for maximum impact.

## Your Task

Generate a professional resume in Markdown format from the structured career data provided. The resume must be ready to render as a web page and print cleanly as a PDF.

## Target Candidate Profile

- **Name:** Paul Prae
- **Target roles:** Principal AI Engineer, Solutions Architect, Director of AI, Head of AI Engineering
- **Target compensation:** $225,000+ (salary + bonus)
- **Target companies:** NVIDIA, Microsoft, AWS, Google, Anthropic, Perplexity, Cursor, Mistral, and well-funded AI startups
- **Key differentiators:** AI engineering leadership, healthcare domain expertise (Arine, BCBS, Humana ecosystem), Fortune 500 enterprise delivery (AWS, Microsoft, Slalom), full-stack spanning data engineering, ML systems, and cloud infrastructure

## Brand Voice Guidelines

- **Tone:** Confident, technically precise, action-oriented
- **Perspective:** Third-person professional (no "I" statements)
- **DO:** Quantify impact wherever data supports it. Use strong action verbs (Led, Architected, Delivered, Scaled, Reduced, Automated). Be specific about technologies, scale, and outcomes.
- **DON'T:** Use buzzword stuffing, vague claims ("helped improve"), passive voice, or overly humble hedging ("assisted with")
- **Transform responsibilities into measurable impacts** using the STAR method (Situation-Task-Action-Result) where the data supports it

## Resume Format (Markdown)

Output the resume using this exact structure:

\`\`\`
# [Full Name]

**[Headline / Target Title]** | [Location] | [Email] | [LinkedIn URL] | [Website URL]

---

## Professional Summary

[3-4 sentence executive summary. Lead with years of experience + domain. Highlight AI/ML leadership + healthcare expertise + enterprise delivery. Close with what the candidate brings to the target role. Make it compelling — this is the first thing a hiring manager reads.]

---

## Professional Experience

### [Job Title]
**[Company Name]** | [Location] | [Start Date] – [End Date or "Present"]

- [Achievement bullet: Action verb → what you did → quantified impact]
- [Achievement bullet]
- [Achievement bullet]
- [Continue for each significant achievement]

[Repeat for each position, reverse chronological order]

---

## Education

### [Degree]
**[School Name]** | [Start Date] – [End Date]
[Notes or activities if relevant]

---

## Technical Skills

[Organize into categories: AI/ML, Cloud & Infrastructure, Programming Languages, Data Engineering, Leadership & Strategy, etc. Use comma-separated lists within each category.]

---

## Certifications

- **[Certification Name]** — [Issuing Authority] ([Date])

---

## Projects

### [Project Title]
[Description. Emphasize technical complexity, leadership, and outcomes.]

---

## Publications

- **[Publication Name]** — [Publisher] ([Date]): [Brief description]
\`\`\`

## Quality Criteria

1. **Length:** Approximately 2 pages when rendered in a standard browser. For a career spanning 10+ years with multiple roles, this means being selective — prioritize the most impactful and relevant items.
2. **ATS Optimization:** Include keywords that match Principal AI Engineer, Solutions Architect, and AI Engineering Manager job descriptions. Target 95%+ keyword coverage.
3. **Quantified Impact:** Every position should have at least 2-3 bullets with measurable outcomes (percentages, dollar amounts, team sizes, scale metrics).
4. **Recency Bias:** Give more detail and bullets to recent roles (last 5 years). Older roles can be condensed to 1-2 bullets.
5. **Skills Organization:** Group technical skills by category. Lead with the most relevant categories for AI leadership roles.
6. **Narrative Consistency:** The Professional Summary, Experience bullets, and Skills section should tell a cohesive story of progressive AI/ML leadership.
7. **No Fabrication:** Only use data provided in the career data. If data is sparse for a role, write fewer but stronger bullets rather than inventing content.

## Output Instructions

- Output ONLY the Markdown resume content
- Do NOT include any preamble, commentary, explanations, or markdown code fences
- Do NOT wrap the output in \`\`\`markdown blocks
- Start directly with the H1 heading (# Paul Prae)
- Use standard Markdown: # for H1, ## for H2, ### for H3, - for bullets, **bold** for emphasis
- Use --- for horizontal rules between major sections
- Dates should use "Mon YYYY" format (e.g., "Jan 2020")
- For current positions, use "Present" as the end date`;

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
    warnings.push(`Resume appears too short (${charCount.toLocaleString()} chars, expected 4000-10000 for ~2 pages)`);
  } else if (charCount > 12000) {
    warnings.push(`Resume appears too long (${charCount.toLocaleString()} chars, target is ~2 pages / 4000-10000 chars)`);
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

  return warnings;
}

// ─── Main Generation Pipeline ────────────────────────────────────────────────

async function generate(): Promise<GenerationResult> {
  console.log("\n🤖 Resume Generation Pipeline\n");
  console.log(`   Model: ${CLAUDE.model}`);
  console.log(`   Thinking: adaptive (effort: ${CLAUDE.effort} — Opus 4.6 exclusive, no constraints)`);
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

  console.log(`   Career data loaded: ${careerData.positions.length} positions, ${careerData.skills.length} skills\n`);
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
    console.warn("   The resume may be incomplete. Consider increasing CLAUDE.maxTokens in lib/config.ts.\n");
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

  // Prepend generation header
  const header = [
    "<!-- This file is GENERATED by the AI pipeline. Do not edit directly. -->",
    "<!-- To regenerate: npm run generate -->",
    "<!-- To modify output: edit scripts/generate-resume.ts -->",
    `<!-- Generated: ${new Date().toISOString()} | Model: ${CLAUDE.model} | Tokens: ${response.usage.output_tokens} -->`,
    "",
  ].join("\n");

  const finalContent = header + markdown;

  // Write output
  const outputDir = path.dirname(PATHS.resumeOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(PATHS.resumeOutput, finalContent, "utf-8");

  // Report cache performance if available
  const usage = response.usage as unknown as Record<string, unknown>;
  const cacheRead = (typeof usage.cache_read_input_tokens === "number" ? usage.cache_read_input_tokens : 0);
  const cacheCreation = (typeof usage.cache_creation_input_tokens === "number" ? usage.cache_creation_input_tokens : 0);

  const result: GenerationResult = {
    success: true,
    markdownLength: finalContent.length,
    model: CLAUDE.model,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs,
  };

  console.log("   ✅ Resume generated:\n");
  console.log(`      Model: ${result.model}`);
  console.log(`      Stop reason: ${result.stopReason}`);
  console.log(`      Input tokens: ${result.inputTokens.toLocaleString()}`);
  console.log(`      Output tokens: ${result.outputTokens.toLocaleString()}`);
  if (thinkingTokens > 0) {
    console.log(`      Thinking: ~${Math.round(thinkingTokens / 4).toLocaleString()} tokens (estimated)`);
  }
  if (cacheRead > 0 || cacheCreation > 0) {
    console.log(`      Cache: ${cacheRead.toLocaleString()} read, ${cacheCreation.toLocaleString()} created`);
  }
  console.log(`      Markdown length: ${result.markdownLength.toLocaleString()} chars`);
  console.log(`      Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  if (validationWarnings.length > 0) {
    console.log(`      Warnings: ${validationWarnings.length} quality check(s) flagged`);
  }
  console.log(`\n   📝 Written to: ${PATHS.resumeOutput}\n`);

  return result;
}

// ─── Execute ─────────────────────────────────────────────────────────────────

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
