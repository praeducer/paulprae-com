/**
 * Approve Resume — promotes the staging resume to the approved/live path.
 *
 * Usage:
 *   npm run approve         — interactive confirmation
 *   npm run approve:force   — skip confirmation
 *
 * Flow: Paul-Prae-Resume.staging.md → Paul-Prae-Resume.md
 * After approval, run `npm run export` to generate PDF/DOCX from the new version.
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { PATHS } from "../lib/config";
import { parseResume } from "../lib/resume-parser";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasForceFlag(): boolean {
  return process.argv.includes("--force");
}

function getStagingInfo(): { chars: number; sections: string[] } | null {
  if (!fs.existsSync(PATHS.resumeStaging)) return null;

  const content = fs.readFileSync(PATHS.resumeStaging, "utf-8");
  const parsed = parseResume(content);
  return {
    chars: content.length,
    sections: parsed.sections.map((s) => s.heading),
  };
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith("y"));
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function approve(): Promise<boolean> {
  console.log("\n📋 Resume Approval\n");

  // Check staging file exists
  if (!fs.existsSync(PATHS.resumeStaging)) {
    console.error("   ❌ No staging resume found.");
    console.error(`      Expected: ${PATHS.resumeStaging}`);
    console.error("      Run 'npm run generate' first to create a staging version.\n");
    return false;
  }

  const info = getStagingInfo();
  if (!info) {
    console.error("   ❌ Could not read staging resume.\n");
    return false;
  }

  // Show staging info
  console.log(`   Staging file: ${path.basename(PATHS.resumeStaging)}`);
  console.log(`   Characters: ${info.chars.toLocaleString()}`);
  console.log(`   Sections (${info.sections.length}): ${info.sections.join(", ")}`);

  // Show diff summary if approved version exists
  if (fs.existsSync(PATHS.resumeOutput)) {
    const approvedContent = fs.readFileSync(PATHS.resumeOutput, "utf-8");
    const charDiff = info.chars - approvedContent.length;
    const sign = charDiff >= 0 ? "+" : "";
    console.log(`   vs. approved: ${sign}${charDiff} chars`);
  } else {
    console.log("   No previous approved version (first approval).");
  }

  console.log();

  // Confirm unless --force
  if (!hasForceFlag()) {
    const confirmed = await askConfirmation("   Promote staging → approved? (y/N) ");
    if (!confirmed) {
      console.log("   Cancelled.\n");
      return false;
    }
  }

  // Copy staging → approved
  fs.copyFileSync(PATHS.resumeStaging, PATHS.resumeOutput);

  console.log(`\n   ✅ Approved: ${path.basename(PATHS.resumeOutput)}`);
  console.log("   Next steps:");
  console.log("     npm run export    → generate PDF/DOCX");
  console.log("     npm run build     → rebuild site with new resume\n");

  return true;
}

// ─── Exports for Testing ─────────────────────────────────────────────────────

export const _testExports = {
  approve,
  getStagingInfo,
  hasForceFlag,
};

// ─── Execute ─────────────────────────────────────────────────────────────────

const isDirectRun = ["approve-resume.ts", "approve-resume.js"].includes(
  path.basename(process.argv[1] ?? ""),
);

if (isDirectRun) {
  approve()
    .then((success) => {
      if (!success) process.exit(1);
    })
    .catch((err) => {
      console.error("   ❌ Approval failed:", err);
      process.exit(1);
    });
}
