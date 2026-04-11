/**
 * grade-content.ts — LLM-as-judge quality grader for generated content.
 *
 * Reads a generated markdown file and scores it against writing-rules.json.
 * Uses callModel() (lightweight Claude call) to evaluate each rule category.
 *
 * Usage:
 *   npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Resume-NVIDIA.md
 *   npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md
 *
 * Output: Scorecard with per-category ratings and specific violations.
 *
 * Requires: ANTHROPIC_API_KEY in .env.local
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { PATHS } from "../lib/config.js";
import { isDirectRun } from "../lib/script-utils.js";
import { callModel, ApiKeyError } from "../lib/ai/client.js";
import { stripHtmlComments } from "../lib/markdown.js";

// Load environment variables
config({ path: PATHS.envFile, override: true });

// ─── Types ──────────────────────────────────────────────────────────────────

interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: "critical" | "warning" | "info";
  excerpt: string;
  explanation: string;
}

interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  violations: RuleViolation[];
}

interface GradeResult {
  file: string;
  overallScore: number;
  maxScore: number;
  categories: CategoryScore[];
}

// ─── Writing Rules Loader ───────────────────────────────────────────────────

function loadWritingRules(): Record<string, unknown> {
  const rulesPath = path.join(PATHS.knowledgeDir, "content", "writing-rules.json");
  if (!fs.existsSync(rulesPath)) {
    console.error("❌ writing-rules.json not found");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
}

// ─── Grading ────────────────────────────────────────────────────────────────

async function gradeContent(filePath: string): Promise<GradeResult> {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const content = stripHtmlComments(raw);
  const rules = loadWritingRules();
  const isCoverLetter = filePath.toLowerCase().includes("cover-letter");

  console.log("\n📊 Content Quality Grader\n");
  console.log(`   File: ${filePath}`);
  console.log(`   Type: ${isCoverLetter ? "Cover Letter" : "Resume"}`);
  console.log(`   Length: ${content.length} chars\n`);
  console.log("   ⏳ Calling Claude API for quality evaluation...\n");

  const systemPrompt = `You are a strict quality auditor for career documents. You evaluate resumes and cover letters against a set of mandatory writing rules. You are thorough, precise, and cite specific excerpts when flagging violations. Respond with valid JSON only.`;

  const userMessage = `Grade this ${isCoverLetter ? "cover letter" : "resume"} against the writing rules below. For each rule category, assign a score (0-10) and list any specific violations with the exact excerpt from the document that violates the rule.

<writing_rules>
${JSON.stringify(rules, null, 2)}
</writing_rules>

<content>
${content}
</content>

Respond with valid JSON matching this schema:
{
  "categories": [
    {
      "category": "grounding",
      "score": 8,
      "maxScore": 10,
      "violations": [
        {
          "ruleId": "G1",
          "ruleName": "Entity-scope binding",
          "severity": "critical|warning|info",
          "excerpt": "exact text from the document",
          "explanation": "why this violates the rule"
        }
      ]
    }
  ]
}

Score each category: grounding, ethics, voice, quality${isCoverLetter ? ", cover_letter" : ""}.
Be strict. A score of 10 means zero violations. Deduct 1-3 points per violation depending on severity.
Pay special attention to:
- The suppress_from_output.skills list — flag any suppressed skill that appears in the document
- Tense accuracy — flag any past role described in present tense
- Sycophancy or editorial commentary about the target company
- Technologies mentioned that are NOT in the career data`;

  const response = await callModel(systemPrompt, userMessage);

  // Parse JSON from response
  const jsonMatch = response.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("❌ Failed to parse grader response as JSON");
    console.error("   Raw response:", response.text.substring(0, 500));
    process.exit(1);
  }

  const parsed = JSON.parse(jsonMatch[0]) as { categories: CategoryScore[] };

  const overallScore = parsed.categories.reduce((sum, c) => sum + c.score, 0);
  const maxScore = parsed.categories.reduce((sum, c) => sum + c.maxScore, 0);

  return {
    file: filePath,
    overallScore,
    maxScore,
    categories: parsed.categories,
  };
}

// ─── Display ────────────────────────────────────────────────────────────────

function displayResult(result: GradeResult): void {
  const pct = ((result.overallScore / result.maxScore) * 100).toFixed(0);
  const bar = "█".repeat(Math.round((result.overallScore / result.maxScore) * 20));
  const empty = "░".repeat(20 - bar.length);

  console.log(`   Overall: ${result.overallScore}/${result.maxScore} (${pct}%) ${bar}${empty}\n`);

  for (const cat of result.categories) {
    const catPct = ((cat.score / cat.maxScore) * 100).toFixed(0);
    const icon = cat.score >= 9 ? "✅" : cat.score >= 7 ? "⚠️" : "❌";
    console.log(`   ${icon} ${cat.category}: ${cat.score}/${cat.maxScore} (${catPct}%)`);

    for (const v of cat.violations) {
      const sevIcon = v.severity === "critical" ? "🔴" : v.severity === "warning" ? "🟡" : "🔵";
      console.log(`      ${sevIcon} [${v.ruleId}] ${v.ruleName}`);
      console.log(
        `         "${v.excerpt.substring(0, 100)}${v.excerpt.length > 100 ? "..." : ""}"`,
      );
      console.log(`         → ${v.explanation}`);
    }

    if (cat.violations.length === 0) {
      console.log(`      No violations found.`);
    }
    console.log();
  }

  // Summary
  const criticals = result.categories
    .flatMap((c) => c.violations)
    .filter((v) => v.severity === "critical");
  const warnings = result.categories
    .flatMap((c) => c.violations)
    .filter((v) => v.severity === "warning");

  console.log(`   Summary: ${criticals.length} critical, ${warnings.length} warnings`);

  if (criticals.length > 0) {
    console.log("   ❌ CRITICAL violations must be fixed before submission.\n");
  } else if (warnings.length > 0) {
    console.log("   ⚠️  Warnings should be reviewed before submission.\n");
  } else {
    console.log("   ✅ Content passes quality checks.\n");
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (isDirectRun("grade-content")) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  if (args.length === 0) {
    console.log(`
Usage: npx tsx scripts/grade-content.ts <file.md>

  Grades a generated markdown file against writing-rules.json.

Examples:
  npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Resume-NVIDIA.md
  npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md
`);
    process.exit(1);
  }

  gradeContent(args[0])
    .then((result) => {
      displayResult(result);
      // Exit with non-zero if critical violations found
      const criticals = result.categories
        .flatMap((c) => c.violations)
        .filter((v) => v.severity === "critical");
      if (criticals.length > 0) process.exit(1);
    })
    .catch((err) => {
      if (err instanceof ApiKeyError) {
        console.error("\n❌ API key error:", err.message);
      } else {
        console.error("\n❌ Grading failed:", err instanceof Error ? err.message : err);
      }
      process.exit(1);
    });
}
