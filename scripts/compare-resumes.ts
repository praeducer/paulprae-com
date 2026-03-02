/**
 * Compare Resumes — interactive CLI for section-by-section resume comparison.
 *
 * Usage:
 *   npm run compare                           — compare staging vs approved
 *   npm run compare -- fileA.md fileB.md      — compare specific files
 *   npm run compare -- --judge                — include LLM scoring
 *   npm run compare -- --all-versions         — compare all archived versions
 *
 * Flow:
 *   1. Parse input resumes into sections
 *   2. For each section, show versions side-by-side
 *   3. Optionally score with Claude API (--judge flag)
 *   4. User picks best version per section
 *   5. Assemble composite resume → write to staging
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import Anthropic from "@anthropic-ai/sdk";
import { PATHS, CLAUDE } from "../lib/config";
import { parseResume, assembleResume } from "../lib/resume-parser";
import { isDirectRun } from "../lib/script-utils";
import type { ParsedResume, ResumeSection } from "../lib/resume-parser";
import type { SectionScore } from "../lib/types";

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

interface CliArgs {
  files: string[];
  judge: boolean;
  allVersions: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const judge = args.includes("--judge");
  const allVersions = args.includes("--all-versions");
  const files = args.filter((a) => !a.startsWith("--"));
  return { files, judge, allVersions };
}

// ─── Resume Loading ──────────────────────────────────────────────────────────

interface LabeledResume {
  label: string;
  parsed: ParsedResume;
  filePath: string;
}

function loadResume(filePath: string, label: string): LabeledResume | null {
  if (!fs.existsSync(filePath)) {
    console.error(`   ⚠️  File not found: ${filePath}`);
    return null;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return { label, parsed: parseResume(content), filePath };
}

function loadDefaultResumes(): LabeledResume[] {
  const resumes: LabeledResume[] = [];

  const staging = loadResume(PATHS.resumeStaging, "Staging");
  if (staging) resumes.push(staging);

  const approved = loadResume(PATHS.resumeOutput, "Approved");
  if (approved) resumes.push(approved);

  return resumes;
}

function loadVersionedResumes(): LabeledResume[] {
  const resumes: LabeledResume[] = [];

  if (!fs.existsSync(PATHS.versionsDir)) return resumes;

  const mdFiles = fs
    .readdirSync(PATHS.versionsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (const file of mdFiles) {
    const filePath = path.join(PATHS.versionsDir, file);
    // Label: extract date + sha from filename pattern like "Paul-Prae-Resume-2026-02-28-93ddc38.md"
    const match = file.match(/(\d{4}-\d{2}-\d{2})-([a-f0-9]+)\.md$/);
    const label = match ? `${match[1]} (${match[2]})` : file;
    const resume = loadResume(filePath, label);
    if (resume) resumes.push(resume);
  }

  return resumes;
}

// ─── Display Helpers ─────────────────────────────────────────────────────────

const DIVIDER = "─".repeat(72);
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function showSection(label: string, content: string, scores?: SectionScore[]): void {
  console.log(`\n${CYAN}${BOLD}── ${label} ──${RESET}`);
  console.log(content.trim());

  if (scores && scores.length > 0) {
    console.log(`\n${YELLOW}   LLM Scores:${RESET}`);
    for (const s of scores) {
      console.log(`   ${s.criterion}: ${s.score}/10 — ${s.rationale}`);
    }
  }
}

// ─── LLM Judge ───────────────────────────────────────────────────────────────

async function judgeSection(
  heading: string,
  versions: { label: string; content: string }[],
): Promise<Map<string, SectionScore[]>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(`   ${DIM}(Skipping LLM judge — ANTHROPIC_API_KEY not set)${RESET}`);
    return new Map();
  }

  const client = new Anthropic();

  const versionTexts = versions
    .map((v, i) => `### Version ${String.fromCharCode(65 + i)} (${v.label})\n${v.content}`)
    .join("\n\n");

  const prompt = `You are an expert resume evaluator. Score each version of the "${heading}" section on these 6 criteria (1-10 scale):

1. Impact Clarity — quantified outcomes, measurable results
2. Action Verb Strength — strong, specific verbs vs passive/weak ones
3. ATS Optimization — keywords relevant to AI/ML engineering leadership
4. Conciseness — information density, no filler
5. Brand Voice — third-person, confident, technically precise
6. Recruiter Appeal — would a hiring manager want to interview this person?

${versionTexts}

Respond with valid JSON only — an object where keys are version labels and values are arrays of score objects:
{
  "Version A (label)": [
    {"criterion": "Impact Clarity", "score": 8, "rationale": "one sentence"}
  ]
}`;

  try {
    const response = await client.messages.create({
      model: CLAUDE.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return new Map();

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, SectionScore[]>;
    const result = new Map<string, SectionScore[]>();

    for (const [key, scores] of Object.entries(parsed)) {
      // Match key back to version label
      const version = versions.find((v) => key.includes(v.label));
      if (version) {
        result.set(version.label, scores);
      }
    }

    return result;
  } catch (err) {
    console.error(
      `   ${DIM}(LLM judge error: ${err instanceof Error ? err.message : err})${RESET}`,
    );
    return new Map();
  }
}

// ─── Interactive Selection ───────────────────────────────────────────────────

function createReadline(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function askChoice(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim().toUpperCase()));
  });
}

// ─── Section Matching ────────────────────────────────────────────────────────

interface MatchedSection {
  heading: string;
  slug: string;
  versions: { label: string; section: ResumeSection }[];
}

function matchSections(resumes: LabeledResume[]): MatchedSection[] {
  // Collect all unique section slugs preserving first-seen order
  const slugOrder: string[] = [];
  const slugToHeading = new Map<string, string>();

  for (const resume of resumes) {
    for (const section of resume.parsed.sections) {
      if (!slugToHeading.has(section.slug)) {
        slugOrder.push(section.slug);
        slugToHeading.set(section.slug, section.heading);
      }
    }
  }

  // Build matched sections
  const matched: MatchedSection[] = [];
  for (const slug of slugOrder) {
    const heading = slugToHeading.get(slug)!;
    const versions: { label: string; section: ResumeSection }[] = [];

    for (const resume of resumes) {
      const section = resume.parsed.sections.find((s) => s.slug === slug);
      if (section) {
        versions.push({ label: resume.label, section });
      }
    }

    matched.push({ heading, slug, versions });
  }

  return matched;
}

// ─── Main Compare Flow ──────────────────────────────────────────────────────

async function compare(): Promise<void> {
  console.log(`\n${BOLD}📊 Resume Comparison${RESET}\n`);

  const cliArgs = parseArgs();

  // Load resumes
  let resumes: LabeledResume[];

  if (cliArgs.files.length >= 2) {
    resumes = cliArgs.files
      .map((f, i) => loadResume(f, `File ${String.fromCharCode(65 + i)}`))
      .filter((r): r is LabeledResume => r !== null);
  } else if (cliArgs.allVersions) {
    resumes = [...loadDefaultResumes(), ...loadVersionedResumes()];
  } else {
    resumes = loadDefaultResumes();
  }

  if (resumes.length < 2) {
    console.error("   ❌ Need at least 2 resume versions to compare.");
    console.error("      Run 'npm run generate' to create a staging version,");
    console.error("      or provide file paths: npm run compare -- fileA.md fileB.md\n");
    process.exit(1);
  }

  console.log(`   Comparing ${resumes.length} versions:`);
  for (const r of resumes) {
    const sectionCount = r.parsed.sections.length;
    console.log(
      `   • ${r.label}: ${r.parsed.raw.length.toLocaleString()} chars, ${sectionCount} sections`,
    );
  }
  console.log();

  // Match sections across versions
  const matched = matchSections(resumes);
  const rl = createReadline();
  const choices: { heading: string; chosen: string; section: ResumeSection }[] = [];

  // 1. Front matter comparison
  console.log(`${DIVIDER}`);
  console.log(`${BOLD}Front Matter (Header + Summary)${RESET}`);
  console.log(`${DIVIDER}`);

  const frontMatters = resumes.map((r) => ({
    label: r.label,
    content: r.parsed.frontMatter,
  }));

  // Check if all identical
  const allFmSame = frontMatters.every(
    (fm) => fm.content.trim() === frontMatters[0].content.trim(),
  );
  let chosenFrontMatter: string;

  if (allFmSame) {
    console.log(`${DIM}   (Identical across all versions — auto-selected)${RESET}`);
    chosenFrontMatter = frontMatters[0].content;
  } else {
    for (const fm of frontMatters) {
      showSection(fm.label, fm.content);
    }

    const letters = frontMatters.map((_, i) => String.fromCharCode(65 + i));
    const choicePrompt = `\n   Choose: ${letters.map((l, i) => `[${l}] ${frontMatters[i].label}`).join("  ")}  [S] Skip  [Q] Quit\n   > `;
    const answer = await askChoice(rl, choicePrompt);

    if (answer === "Q") {
      console.log("\n   Quitting without saving.\n");
      rl.close();
      return;
    }

    const idx = answer.charCodeAt(0) - 65;
    if (idx >= 0 && idx < frontMatters.length) {
      chosenFrontMatter = frontMatters[idx].content;
      console.log(`   ${GREEN}→ Selected: ${frontMatters[idx].label}${RESET}`);
    } else {
      chosenFrontMatter = resumes[0].parsed.frontMatter;
      console.log(`   ${DIM}→ Kept first version${RESET}`);
    }
  }

  // 2. Section-by-section comparison
  for (const match of matched) {
    console.log(`\n${DIVIDER}`);
    console.log(`${BOLD}## ${match.heading}${RESET}`);
    console.log(`${DIVIDER}`);

    if (match.versions.length === 1) {
      console.log(`${DIM}   (Only in ${match.versions[0].label} — auto-included)${RESET}`);
      choices.push({
        heading: match.heading,
        chosen: match.versions[0].label,
        section: match.versions[0].section,
      });
      continue;
    }

    // Check if all identical
    const allSame = match.versions.every(
      (v) => v.section.content.trim() === match.versions[0].section.content.trim(),
    );

    if (allSame) {
      console.log(`${DIM}   (Identical across all versions — auto-selected)${RESET}`);
      choices.push({
        heading: match.heading,
        chosen: match.versions[0].label,
        section: match.versions[0].section,
      });
      continue;
    }

    // LLM Judge if requested
    let scoreMap = new Map<string, SectionScore[]>();
    if (cliArgs.judge) {
      console.log(`   ${DIM}Evaluating with LLM judge...${RESET}`);
      scoreMap = await judgeSection(
        match.heading,
        match.versions.map((v) => ({ label: v.label, content: v.section.content })),
      );
    }

    // Show each version
    for (const v of match.versions) {
      showSection(v.label, v.section.content, scoreMap.get(v.label));
    }

    // Prompt for choice
    const letters = match.versions.map((_, i) => String.fromCharCode(65 + i));
    const choicePrompt = `\n   Choose: ${letters.map((l, i) => `[${l}] ${match.versions[i].label}`).join("  ")}  [S] Skip  [Q] Quit\n   > `;

    const answer = await askChoice(rl, choicePrompt);

    if (answer === "Q") {
      console.log("\n   Quitting without saving.\n");
      rl.close();
      return;
    }

    const idx = answer.charCodeAt(0) - 65;
    if (idx >= 0 && idx < match.versions.length) {
      choices.push({
        heading: match.heading,
        chosen: match.versions[idx].label,
        section: match.versions[idx].section,
      });
      console.log(`   ${GREEN}→ Selected: ${match.versions[idx].label}${RESET}`);
    } else {
      // Skip: keep first version (or approved if available)
      const approvedVersion =
        match.versions.find((v) => v.label === "Approved") ?? match.versions[0];
      choices.push({
        heading: match.heading,
        chosen: approvedVersion.label,
        section: approvedVersion.section,
      });
      console.log(`   ${DIM}→ Kept: ${approvedVersion.label}${RESET}`);
    }
  }

  rl.close();

  // 3. Assemble composite resume
  const composite = assembleResume(
    chosenFrontMatter,
    choices.map((c) => c.section),
  );

  // 4. Write to staging
  fs.writeFileSync(PATHS.resumeStaging, composite, "utf-8");

  // 5. Summary
  console.log(`\n${DIVIDER}`);
  console.log(`${BOLD}📋 Comparison Summary${RESET}`);
  console.log(`${DIVIDER}\n`);

  for (const choice of choices) {
    console.log(`   ${choice.heading}: ${GREEN}${choice.chosen}${RESET}`);
  }

  console.log(
    `\n   Composite: ${composite.length.toLocaleString()} chars, ${choices.length} sections`,
  );
  console.log(`   Written to: ${path.basename(PATHS.resumeStaging)}`);
  console.log(`\n   Next: run 'npm run approve' to promote to live.\n`);

  return;
}

// ─── Exports for Testing ─────────────────────────────────────────────────────

export const _testExports = {
  parseArgs,
  loadResume,
  matchSections,
  compare,
};

// ─── Execute ─────────────────────────────────────────────────────────────────

if (isDirectRun("compare-resumes")) {
  compare().catch((err) => {
    console.error("   ❌ Comparison failed:", err);
    process.exit(1);
  });
}
