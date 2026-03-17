/**
 * export-docs.ts — Convert all docs/*.md files to Word (.docx) format
 *
 * Outputs timestamped, versioned DOCX files to docs/exports/.
 * Naming convention: <doc-name>-<YYYY-MM-DD>-<git-sha>.docx
 *
 * Usage:
 *   npm run export:docs          # Export all docs to DOCX
 *   npm run export:docs -- --force  # Force re-export even if up to date
 *
 * System dependencies:
 *   - pandoc (apt install pandoc OR https://pandoc.org/installing.html)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { isDirectRun, hasForceFlag } from "../lib/script-utils.js";

// ─── Paths ──────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const EXPORTS_DIR = path.join(DOCS_DIR, "exports");

// ─── Dependency Checks ──────────────────────────────────────────────────────

function checkPandoc(): void {
  const which = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(which, ["pandoc"], { stdio: "ignore" });
  } catch {
    console.error('❌ "pandoc" not found in PATH.\n');
    console.error("   Install it:");
    console.error("   sudo apt-get install -y pandoc");
    console.error("   Or: https://pandoc.org/installing.html\n");
    process.exit(1);
  }
}

// ─── Git SHA ────────────────────────────────────────────────────────────────

function getGitSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}

// ─── DOCX Compatibility Fix ────────────────────────────────────────────────
// Sets Word 2013+ compatibility mode so Word doesn't show "Compatibility Mode" banner.

function fixDocxCompatibility(docxPath: string): void {
  const suffix = crypto.randomUUID().slice(0, 8);
  const extractDir = path.join(path.dirname(docxPath), `_docx_fix_${suffix}`);

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync("unzip", ["-o", docxPath, "-d", extractDir], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const settingsPath = path.join(extractDir, "word", "settings.xml");
    if (!fs.existsSync(settingsPath)) {
      return;
    }

    let settings = fs.readFileSync(settingsPath, "utf-8");

    // Remove legacy compatibility flags
    settings = settings.replace(/<w:doNotTrackMoves\s*\/>/g, "");

    // Add Word 2013+ compatibility mode (val=15)
    if (!settings.includes("<w:compat")) {
      const compatBlock =
        [
          "<w:compat>",
          '  <w:compatSetting w:name="compatibilityMode"',
          '    w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>',
          "</w:compat>",
        ].join("\n") + "\n";
      settings = settings.replace("</w:settings>", compatBlock + "</w:settings>");
    }

    fs.writeFileSync(settingsPath, settings, "utf-8");

    const tmpDocx = docxPath + `.tmp_${suffix}`;
    execFileSync("zip", ["-r", tmpDocx, "."], {
      cwd: extractDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
    fs.renameSync(tmpDocx, docxPath);
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

// ─── Export Logic ───────────────────────────────────────────────────────────

interface ExportResult {
  source: string;
  output: string;
  sizeKb: number;
  skipped: boolean;
}

function shouldSkip(sourcePath: string, outputPath: string): boolean {
  if (!fs.existsSync(outputPath)) return false;
  return fs.statSync(outputPath).mtimeMs > fs.statSync(sourcePath).mtimeMs;
}

function exportDocToDocx(mdPath: string, date: string, sha: string, force: boolean): ExportResult {
  const baseName = path.basename(mdPath, ".md");
  const outputName = `${baseName}-${date}-${sha}.docx`;
  const outputPath = path.join(EXPORTS_DIR, outputName);

  // Skip if output is newer than input
  if (!force && shouldSkip(mdPath, outputPath)) {
    const sizeKb = fs.statSync(outputPath).size / 1024;
    return { source: mdPath, output: outputPath, sizeKb, skipped: true };
  }

  // Write temp file for pandoc input
  const suffix = crypto.randomUUID().slice(0, 8);
  const tempMd = path.join(EXPORTS_DIR, `_tmp_${suffix}.md`);
  const markdown = fs.readFileSync(mdPath, "utf-8");
  fs.writeFileSync(tempMd, markdown, "utf-8");

  try {
    execFileSync("pandoc", [tempMd, "-o", outputPath, "--from", "markdown", "--to", "docx"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Apply Word 2013+ compatibility fix
    try {
      fixDocxCompatibility(outputPath);
    } catch {
      // Non-fatal: file still usable
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      console.error(`   ❌ Output is empty: ${outputName}`);
      process.exit(1);
    }

    return {
      source: mdPath,
      output: outputPath,
      sizeKb: stats.size / 1024,
      skipped: false,
    };
  } finally {
    if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd);
  }
}

// ─── Manifest ───────────────────────────────────────────────────────────────

function writeManifest(results: ExportResult[], date: string, sha: string): void {
  const manifestPath = path.join(EXPORTS_DIR, "MANIFEST.md");

  const entries = results
    .filter((r) => !r.skipped)
    .map(
      (r) =>
        `| ${path.basename(r.source)} | ${path.basename(r.output)} | ${r.sizeKb.toFixed(1)} KB |`,
    );

  const manifest = [
    "# Documentation Exports",
    "",
    `Last exported: ${new Date().toISOString()}`,
    `Git commit: \`${sha}\``,
    "",
    "| Source | Export | Size |",
    "|--------|--------|------|",
    ...results.map(
      (r) =>
        `| ${path.basename(r.source)} | ${path.basename(r.output)} | ${r.sizeKb.toFixed(1)} KB |`,
    ),
    "",
  ].join("\n");

  fs.writeFileSync(manifestPath, manifest, "utf-8");
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  console.log("\n📄 Documentation Export Pipeline\n");

  checkPandoc();

  // Discover all markdown files in docs/
  const mdFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(DOCS_DIR, f))
    .sort();

  if (mdFiles.length === 0) {
    console.log("   No markdown files found in docs/. Nothing to export.\n");
    return;
  }

  console.log(`   Found ${mdFiles.length} markdown files in docs/\n`);

  // Ensure exports directory exists
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const sha = getGitSha();
  const force = hasForceFlag();

  const startTime = Date.now();
  const results: ExportResult[] = [];

  for (const mdPath of mdFiles) {
    const baseName = path.basename(mdPath);
    try {
      const result = exportDocToDocx(mdPath, date, sha, force);
      if (result.skipped) {
        console.log(`   ⏭️  ${baseName} (up to date)`);
      } else {
        console.log(
          `   ✅ ${baseName} → ${path.basename(result.output)} (${result.sizeKb.toFixed(1)} KB)`,
        );
      }
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ ${baseName}: ${msg}`);
      process.exit(1);
    }
  }

  // Write manifest
  writeManifest(results, date, sha);
  console.log(`\n   📋 Updated MANIFEST.md`);

  const exported = results.filter((r) => !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const durationMs = Date.now() - startTime;

  console.log(
    `\n   Done: ${exported} exported, ${skipped} skipped (${(durationMs / 1000).toFixed(1)}s)\n`,
  );
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export const _testExports = {
  checkPandoc,
  getGitSha,
  fixDocxCompatibility,
  exportDocToDocx,
  writeManifest,
  shouldSkip,
  main,
  DOCS_DIR,
  EXPORTS_DIR,
};

// ─── Execute ─────────────────────────────────────────────────────────────────

if (isDirectRun("export-docs")) {
  main();
}
