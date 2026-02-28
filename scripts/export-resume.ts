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
import { execSync } from "child_process";
import { PATHS } from "../lib/config.js";

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
  const cmd = process.platform === "win32" ? `where ${name}` : `which ${name}`;
  try {
    execSync(cmd, { stdio: "ignore" });
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
  const cleaned = raw.replace(/^<!--[\s\S]*?-->\n*/gm, "").trim();

  if (!cleaned) {
    console.error("❌ Resume file is empty after stripping comments.\n");
    process.exit(1);
  }

  return cleaned;
}

// ─── Export Functions ────────────────────────────────────────────────────────

function ensureOutputDir(): void {
  const outDir = path.dirname(PATHS.pdfOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

function exportDocx(markdown: string): void {
  console.log("   📄 Generating DOCX...");

  const tempMd = path.join(path.dirname(PATHS.docxOutput), "_resume_tmp.md");
  fs.writeFileSync(tempMd, markdown, "utf-8");

  try {
    execSync(
      `pandoc "${tempMd}" -o "${PATHS.docxOutput}" --from markdown --to docx`,
      { stdio: "pipe" }
    );

    const stats = fs.statSync(PATHS.docxOutput);
    console.log(
      `      ✅ DOCX: ${PATHS.docxOutput} (${(stats.size / 1024).toFixed(1)} KB)`
    );
  } finally {
    if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd);
  }
}

function exportPdf(markdown: string): void {
  console.log("   📕 Generating PDF...");

  const tempMd = path.join(path.dirname(PATHS.pdfOutput), "_resume_tmp.md");
  const tempTyp = path.join(path.dirname(PATHS.pdfOutput), "_resume_tmp.typ");
  const templateTyp = PATHS.pdfStylesheet;

  fs.writeFileSync(tempMd, markdown, "utf-8");

  try {
    // Step 1: Pandoc MD → Typst markup
    execSync(
      `pandoc "${tempMd}" -o "${tempTyp}" --from markdown --to typst`,
      { stdio: "pipe" }
    );

    // Step 2: Prepend our template to the Pandoc-generated Typst content
    const templateContent = fs.readFileSync(templateTyp, "utf-8");
    const pandocTypst = fs.readFileSync(tempTyp, "utf-8");
    fs.writeFileSync(tempTyp, templateContent + "\n" + pandocTypst, "utf-8");

    // Step 3: Typst compile → PDF
    execSync(`typst compile "${tempTyp}" "${PATHS.pdfOutput}"`, {
      stdio: "pipe",
    });

    const stats = fs.statSync(PATHS.pdfOutput);
    console.log(
      `      ✅ PDF:  ${PATHS.pdfOutput} (${(stats.size / 1024).toFixed(1)} KB)`
    );
  } finally {
    if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd);
    if (fs.existsSync(tempTyp)) fs.unlinkSync(tempTyp);
  }
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

  const durationMs = Date.now() - startTime;
  console.log(`\n   Done in ${(durationMs / 1000).toFixed(1)}s\n`);
}

main();
