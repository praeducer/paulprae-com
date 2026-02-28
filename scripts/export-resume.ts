/**
 * export-resume.ts — Convert resume.md to PDF and DOCX formats
 *
 * Uses Pandoc (MD → DOCX) and Pandoc + Typst (MD → PDF) to produce
 * recruiter-friendly export formats from the AI-generated Markdown resume.
 *
 * Usage:
 *   npm run export          # Export both PDF and DOCX
 *   npm run export:pdf      # Export PDF only
 *   npm run export:docx     # Export DOCX only
 *
 * System dependencies:
 *   - pandoc (apt install pandoc OR https://pandoc.org/installing.html)
 *   - typst  (cargo install typst-cli OR https://github.com/typst/typst/releases)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { PATHS } from "../lib/config.js";
import { stripHtmlComments } from "../lib/markdown.js";

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

type ExportFormat = "pdf" | "docx" | "all";

function parseFormat(): ExportFormat {
  const formatArg = process.argv.find((arg) => arg.startsWith("--format"));
  if (!formatArg) return "all";

  // Support both --format pdf and --format=pdf
  let value: string | undefined;
  if (formatArg.includes("=")) {
    value = formatArg.split("=")[1];
  } else {
    const idx = process.argv.indexOf(formatArg);
    value = process.argv[idx + 1];
  }

  if (value === "pdf" || value === "docx" || value === "all") return value;

  console.error(`❌ Invalid format: "${value}". Use: pdf, docx, or all\n`);
  process.exit(1);
}

// ─── Dependency Checks ──────────────────────────────────────────────────────

function checkBinary(name: string, installHint: string): void {
  const which = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(which, [name], { stdio: "ignore" });
  } catch {
    console.error(`❌ "${name}" not found in PATH.\n`);
    console.error(`   Install it:\n   ${installHint}\n`);
    console.error(`   Or run: bash scripts/setup/install-pipeline-deps.sh\n`);
    process.exit(1);
  }
}

// ─── Markdown Preprocessing ─────────────────────────────────────────────────

function loadAndCleanMarkdown(): string {
  if (!fs.existsSync(PATHS.resumeOutput)) {
    console.error(`❌ Resume not found: ${PATHS.resumeOutput}\n`);
    console.error("   Run the generation step first: npm run generate\n");
    process.exit(1);
  }

  const raw = fs.readFileSync(PATHS.resumeOutput, "utf-8");

  // Strip HTML comment header (lines 1-4 are <!-- ... --> generation metadata)
  const cleaned = stripHtmlComments(raw);

  if (!cleaned) {
    console.error("❌ Resume file is empty after stripping comments.\n");
    process.exit(1);
  }

  return cleaned;
}

// ─── Export Functions ────────────────────────────────────────────────────────

/** Extract stderr message from an execFileSync error, if available. */
function extractStderr(err: unknown): string {
  if (err instanceof Error && "stderr" in err) {
    const stderr = (err as { stderr: Buffer }).stderr?.toString().trim();
    if (stderr) return stderr;
  }
  return err instanceof Error ? err.message : String(err);
}

function ensureOutputDir(): void {
  const outDir = path.dirname(PATHS.pdfOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

function exportDocx(markdown: string): void {
  console.log("   📄 Generating DOCX...");

  const suffix = crypto.randomUUID().slice(0, 8);
  const tempMd = path.join(path.dirname(PATHS.docxOutput), `_resume_tmp_${suffix}.md`);
  fs.writeFileSync(tempMd, markdown, "utf-8");

  try {
    try {
      execFileSync("pandoc", [tempMd, "-o", PATHS.docxOutput, "--from", "markdown", "--to", "docx"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      console.error(`      ❌ Pandoc DOCX conversion failed:\n      ${extractStderr(err)}`);
      process.exit(1);
    }

    const stats = fs.statSync(PATHS.docxOutput);
    if (stats.size === 0) {
      console.error("      ❌ DOCX output is empty (0 bytes)");
      process.exit(1);
    }
    console.log(
      `      ✅ DOCX: ${PATHS.docxOutput} (${(stats.size / 1024).toFixed(1)} KB)`
    );
  } finally {
    if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd);
  }
}

function exportPdf(markdown: string): void {
  console.log("   📕 Generating PDF...");

  const suffix = crypto.randomUUID().slice(0, 8);
  const tempMd = path.join(path.dirname(PATHS.pdfOutput), `_resume_tmp_${suffix}.md`);
  const tempTyp = path.join(path.dirname(PATHS.pdfOutput), `_resume_tmp_${suffix}.typ`);
  const templateTyp = PATHS.pdfStylesheet;

  // Validate stylesheet exists before starting conversion
  if (!fs.existsSync(templateTyp)) {
    console.error(`      ❌ Typst stylesheet not found: ${templateTyp}`);
    console.error("         Expected at: scripts/resume-pdf.typ");
    console.error("         Ensure the file exists and has not been moved or deleted.");
    process.exit(1);
  }

  fs.writeFileSync(tempMd, markdown, "utf-8");

  try {
    // Step 1: Pandoc MD → Typst markup
    try {
      execFileSync("pandoc", [tempMd, "-o", tempTyp, "--from", "markdown", "--to", "typst"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      console.error(`      ❌ Pandoc MD→Typst conversion failed:\n      ${extractStderr(err)}`);
      process.exit(1);
    }

    // Step 2: Prepend our template to the Pandoc-generated Typst content
    const templateContent = fs.readFileSync(templateTyp, "utf-8");
    const pandocTypst = fs.readFileSync(tempTyp, "utf-8");
    fs.writeFileSync(tempTyp, templateContent + "\n" + pandocTypst, "utf-8");

    // Step 3: Typst compile → PDF
    try {
      execFileSync("typst", ["compile", tempTyp, PATHS.pdfOutput], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      console.error(`      ❌ Typst PDF compilation failed:\n      ${extractStderr(err)}`);
      process.exit(1);
    }

    const stats = fs.statSync(PATHS.pdfOutput);
    if (stats.size === 0) {
      console.error("      ❌ PDF output is empty (0 bytes)");
      process.exit(1);
    }
    console.log(
      `      ✅ PDF:  ${PATHS.pdfOutput} (${(stats.size / 1024).toFixed(1)} KB)`
    );
  } finally {
    if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd);
    if (fs.existsSync(tempTyp)) fs.unlinkSync(tempTyp);
  }
}

// ─── Version Archival ──────────────────────────────────────────────────────
// After exporting, archive timestamped copies to data/generated/versions/.
// Filename format: resume-YYYY-MM-DD-<git-sha>.{ext}
// This provides: chronological sorting, git traceability, and easy retrieval.

function getGitSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function archiveVersions(format: ExportFormat): void {
  if (!fs.existsSync(PATHS.versionsDir)) {
    fs.mkdirSync(PATHS.versionsDir, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const sha = getGitSha();
  const prefix = `resume-${date}-${sha}`;

  const filesToArchive: Array<{ src: string; ext: string }> = [];

  // Always archive the markdown source
  if (fs.existsSync(PATHS.resumeOutput)) {
    filesToArchive.push({ src: PATHS.resumeOutput, ext: ".md" });
  }

  if ((format === "all" || format === "pdf") && fs.existsSync(PATHS.pdfOutput)) {
    filesToArchive.push({ src: PATHS.pdfOutput, ext: ".pdf" });
  }
  if ((format === "all" || format === "docx") && fs.existsSync(PATHS.docxOutput)) {
    filesToArchive.push({ src: PATHS.docxOutput, ext: ".docx" });
  }

  if (filesToArchive.length === 0) return;

  console.log(`\n   📁 Archiving to versions/${prefix}.*`);
  for (const { src, ext } of filesToArchive) {
    const dest = path.join(PATHS.versionsDir, `${prefix}${ext}`);
    fs.copyFileSync(src, dest);
    const kb = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(`      ${path.basename(dest)} (${kb} KB)`);
  }
}

function updateManifest(format: ExportFormat): void {
  const date = new Date().toISOString().slice(0, 10);
  const sha = getGitSha();
  const timestamp = new Date().toISOString();
  const prefix = `resume-${date}-${sha}`;

  // Collect file sizes
  const sizes: string[] = [];
  if (fs.existsSync(PATHS.resumeOutput)) {
    const chars = fs.readFileSync(PATHS.resumeOutput, "utf-8").length;
    sizes.push(`MD ${chars.toLocaleString()} chars`);
  }
  if ((format === "all" || format === "pdf") && fs.existsSync(PATHS.pdfOutput)) {
    sizes.push(`PDF ${(fs.statSync(PATHS.pdfOutput).size / 1024).toFixed(0)} KB`);
  }
  if ((format === "all" || format === "docx") && fs.existsSync(PATHS.docxOutput)) {
    sizes.push(`DOCX ${(fs.statSync(PATHS.docxOutput).size / 1024).toFixed(0)} KB`);
  }

  const entry = [
    `### ${date}`,
    `- **Commit:** \`${sha}\``,
    `- **Generated:** ${timestamp}`,
    `- **Model:** claude-opus-4-6`,
    `- **Files:** ${prefix}.{md,pdf,docx}`,
    `- **Sizes:** ${sizes.join(", ")}`,
    "",
  ].join("\n");

  if (!fs.existsSync(PATHS.versionsManifest)) {
    // Create manifest with template
    const template = [
      "# Resume Version History",
      "",
      "## How to use",
      "",
      "- **Latest resume:** `data/generated/resume.{md,pdf,docx}`",
      "- **Archive:** `data/generated/versions/` (timestamped copies)",
      "- **Tag a release:** `git tag -a resume/YYYY-MM-DD -m \"description\"`",
      "- **List releases:** `git tag -l \"resume/*\"`",
      "",
      "## Sent To",
      "",
      "<!-- Track which version you sent to each company -->",
      "| Date | Company | Role | Version | Notes |",
      "|------|---------|------|---------|-------|",
      "",
      "## Version Log",
      "",
      entry,
    ].join("\n");
    fs.writeFileSync(PATHS.versionsManifest, template, "utf-8");
  } else {
    // Insert or replace entry after "## Version Log" header (dedup by date+sha)
    const existing = fs.readFileSync(PATHS.versionsManifest, "utf-8");
    const marker = "## Version Log";
    const idx = existing.indexOf(marker);
    if (idx !== -1) {
      const insertAt = idx + marker.length;
      const afterMarker = existing.slice(insertAt);

      // Remove any existing entry with the same date+sha to prevent duplicates
      const escapedDate = date.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedSha = sha.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const entryPattern = new RegExp(
        `\\n*### ${escapedDate}\\n- \\*\\*Commit:\\*\\* \`${escapedSha}\`[\\s\\S]*?(?=\\n### |$)`,
      );
      const cleanedAfter = afterMarker.replace(entryPattern, "");

      const updated = existing.slice(0, insertAt) + "\n\n" + entry + cleanedAfter;
      fs.writeFileSync(PATHS.versionsManifest, updated, "utf-8");
    } else {
      // Fallback: append to end
      fs.writeFileSync(PATHS.versionsManifest, existing + "\n" + entry, "utf-8");
    }
  }

  console.log(`   📋 Updated ${path.basename(PATHS.versionsManifest)}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const format = parseFormat();

  console.log("\n📦 Resume Export Pipeline\n");

  // Check required binaries
  const needsPandoc = format === "all" || format === "pdf" || format === "docx";
  const needsTypst = format === "all" || format === "pdf";

  if (needsPandoc) {
    checkBinary(
      "pandoc",
      "sudo apt-get install -y pandoc\n   Or: https://pandoc.org/installing.html"
    );
  }
  if (needsTypst) {
    checkBinary(
      "typst",
      "cargo install typst-cli\n   Or: https://github.com/typst/typst/releases"
    );
  }

  const markdown = loadAndCleanMarkdown();
  ensureOutputDir();

  const startTime = Date.now();

  if (format === "all" || format === "docx") {
    exportDocx(markdown);
  }
  if (format === "all" || format === "pdf") {
    exportPdf(markdown);
  }

  // Archive timestamped copies and update manifest
  archiveVersions(format);
  updateManifest(format);

  const durationMs = Date.now() - startTime;
  console.log(`\n   Done in ${(durationMs / 1000).toFixed(1)}s\n`);
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export const _testExports = {
  parseFormat,
  loadAndCleanMarkdown,
  exportDocx,
  exportPdf,
  ensureOutputDir,
  archiveVersions,
  updateManifest,
  getGitSha,
  checkBinary,
  main,
};

// ─── Execute ─────────────────────────────────────────────────────────────────
// Only run when executed directly (not when imported for testing).

const isDirectRun = ["export-resume.ts", "export-resume.js"]
  .includes(path.basename(process.argv[1] ?? ""));

if (isDirectRun) {
  main();
}
