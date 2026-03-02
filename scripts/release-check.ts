/**
 * Release checklist — pre-push verification script.
 *
 * Validates that the project is ready for a git push or PR merge:
 *   1. Committed resume + career-data files exist and are non-empty
 *   2. Public download copies (PDF, DOCX, MD) exist and match data/generated/
 *   3. ESLint passes
 *   4. Prettier formatting passes
 *   5. All tests pass
 *   6. Next.js static build succeeds
 *   7. Build output (out/index.html) exists and contains expected content
 *
 * Usage:
 *   npm run check            # Full checklist (lint → format → test → build → validate)
 *   npm run check:quick      # Data file validation only (no lint/test/build)
 *   npm run check:fix        # Quick check + auto-fix stale public/ copies
 *   npm run check -- --skip-build  # Skip the build step (useful during rapid iteration)
 *
 * Exit code:
 *   0  All checks passed
 *   1  One or more checks failed
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { PATHS, RESUME_FILE_BASE } from "../lib/config";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

// ─── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const quickMode = args.includes("--quick");
const skipBuild = args.includes("--skip-build");
const fixMode = args.includes("--fix");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = process.cwd();

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function humanSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  } catch {
    return "";
  }
}

function runCommand(cmd: string, cmdArgs: string[]): { ok: boolean; output: string } {
  try {
    const output = execFileSync(cmd, cmdArgs, {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
      encoding: "utf-8",
    });
    return { ok: true, output: output.trim() };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    return { ok: false, output: (error.stderr || error.stdout || error.message || "").trim() };
  }
}

// ─── Check Runners ───────────────────────────────────────────────────────────

function checkDataFiles(): CheckResult {
  const start = Date.now();
  const required: { label: string; path: string; minBytes: number }[] = [
    { label: "career-data.json", path: PATHS.careerDataOutput, minBytes: 100 },
    { label: `${RESUME_FILE_BASE}.md`, path: PATHS.resumeOutput, minBytes: 500 },
  ];

  const missing: string[] = [];
  const tooSmall: string[] = [];

  for (const file of required) {
    if (!fileExists(file.path)) {
      missing.push(file.label);
    } else if (fileSize(file.path) < file.minBytes) {
      tooSmall.push(
        `${file.label} (${humanSize(fileSize(file.path))} < ${humanSize(file.minBytes)})`,
      );
    }
  }

  const issues = [
    ...missing.map((f) => `missing: ${f}`),
    ...tooSmall.map((f) => `too small: ${f}`),
  ];
  return {
    name: "Data files",
    passed: issues.length === 0,
    detail:
      issues.length === 0 ? `career-data.json + ${RESUME_FILE_BASE}.md present` : issues.join("; "),
    durationMs: Date.now() - start,
  };
}

function checkPublicDownloads(): CheckResult {
  const start = Date.now();
  const downloads: { label: string; publicPath: string; sourcePath: string }[] = [
    { label: "PDF", publicPath: PATHS.publicPdf, sourcePath: PATHS.pdfOutput },
    { label: "DOCX", publicPath: PATHS.publicDocx, sourcePath: PATHS.docxOutput },
    { label: "MD", publicPath: PATHS.publicMd, sourcePath: PATHS.resumeOutput },
  ];

  const issues: string[] = [];

  for (const dl of downloads) {
    if (!fileExists(dl.publicPath)) {
      if (fixMode && fileExists(dl.sourcePath)) {
        fs.copyFileSync(dl.sourcePath, dl.publicPath);
        console.log(`  → Fixed: copied ${dl.label} to public/`);
      } else {
        issues.push(`missing: public/${RESUME_FILE_BASE}.${dl.label.toLowerCase()}`);
      }
    } else {
      const publicHash = fileHash(dl.publicPath);
      const sourceHash = fileHash(dl.sourcePath);
      if (sourceHash && publicHash !== sourceHash) {
        if (fixMode) {
          fs.copyFileSync(dl.sourcePath, dl.publicPath);
          console.log(`  → Fixed: synced ${dl.label} to public/`);
        } else {
          issues.push(`stale: public/ ${dl.label} differs from data/generated/ (hash mismatch)`);
        }
      }
    }
  }

  const sizes = downloads
    .filter((dl) => fileExists(dl.publicPath))
    .map((dl) => `${dl.label} ${humanSize(fileSize(dl.publicPath))}`)
    .join(", ");

  return {
    name: "Public downloads",
    passed: issues.length === 0,
    detail: issues.length === 0 ? sizes || "no files found" : issues.join("; "),
    durationMs: Date.now() - start,
  };
}

function checkLint(): CheckResult {
  const start = Date.now();
  const { ok, output } = runCommand("npx", [
    "eslint",
    "--cache",
    "--cache-location",
    ".next/cache/eslint/",
    ".",
  ]);
  return {
    name: "ESLint",
    passed: ok,
    detail: ok ? "clean" : output.split("\n").slice(0, 3).join(" | "),
    durationMs: Date.now() - start,
  };
}

function checkFormat(): CheckResult {
  const start = Date.now();
  const { ok, output } = runCommand("npx", [
    "prettier",
    "--check",
    "**/*.{ts,tsx,js,mjs,json,css,md}",
  ]);
  return {
    name: "Prettier",
    passed: ok,
    detail: ok ? "all files formatted" : output.split("\n").slice(0, 3).join(" | "),
    durationMs: Date.now() - start,
  };
}

function checkTests(): CheckResult {
  const start = Date.now();
  const { ok, output } = runCommand("npx", ["vitest", "run"]);

  // Extract test count from Vitest output
  const match = output.match(/(\d+) passed/);
  const count = match ? match[1] : "?";

  return {
    name: "Tests",
    passed: ok,
    detail: ok ? `${count} tests passed` : output.split("\n").slice(-5).join(" | "),
    durationMs: Date.now() - start,
  };
}

function checkBuild(): CheckResult {
  const start = Date.now();
  const { ok, output } = runCommand("npx", ["next", "build"]);
  return {
    name: "Build",
    passed: ok,
    detail: ok ? "static export succeeded" : output.split("\n").slice(-3).join(" | "),
    durationMs: Date.now() - start,
  };
}

function checkBuildOutput(): CheckResult {
  const start = Date.now();
  const indexPath = path.join(ROOT, "out", "index.html");
  const issues: string[] = [];

  if (!fileExists(indexPath)) {
    issues.push("out/index.html not found (run build first)");
  } else {
    const html = fs.readFileSync(indexPath, "utf-8");
    const size = fileSize(indexPath);

    if (size < 10_000) {
      issues.push(`index.html suspiciously small (${humanSize(size)})`);
    }

    // Check for expected content markers
    const markers: { label: string; pattern: RegExp }[] = [
      { label: "page title", pattern: /Paul Prae/i },
      { label: "Professional Summary", pattern: /Professional Summary/i },
      { label: "download link", pattern: /\.pdf/i },
      { label: "meta description", pattern: /<meta[^>]*description/i },
    ];

    for (const marker of markers) {
      if (!marker.pattern.test(html)) {
        issues.push(`missing: ${marker.label}`);
      }
    }
  }

  return {
    name: "Build output",
    passed: issues.length === 0,
    detail:
      issues.length === 0
        ? `out/index.html valid (${humanSize(fileSize(indexPath))})`
        : issues.join("; "),
    durationMs: Date.now() - start,
  };
}

function checkDocs(): CheckResult {
  const start = Date.now();
  const { ok, output } = runCommand("npx", ["tsx", "scripts/validate-docs.ts"]);
  return {
    name: "Docs",
    passed: ok,
    detail: ok
      ? "all links valid, required docs present"
      : output.split("\n").slice(0, 3).join(" | "),
    durationMs: Date.now() - start,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log();
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│           Release Checklist                   │");
  console.log("│  Verifying project readiness for push/merge   │");
  console.log("└──────────────────────────────────────────────┘");
  console.log();

  const results: CheckResult[] = [];

  // Phase 1: Data file validation (always runs)
  results.push(checkDataFiles());
  results.push(checkPublicDownloads());

  if (!quickMode) {
    // Phase 2: Code quality (skip in quick mode)
    results.push(checkDocs());
    results.push(checkLint());
    results.push(checkFormat());
    results.push(checkTests());

    // Phase 3: Build (skip in quick mode or with --skip-build)
    if (!skipBuild) {
      results.push(checkBuild());
      results.push(checkBuildOutput());
    }
  }

  // ─── Report ────────────────────────────────────────────────────────────────

  console.log();
  const maxName = Math.max(...results.map((r) => r.name.length));

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const color = r.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const name = r.name.padEnd(maxName);
    const time = r.durationMs > 999 ? `${(r.durationMs / 1000).toFixed(1)}s` : `${r.durationMs}ms`;
    console.log(`  ${color}${icon}${reset}  ${name}  ${r.detail}  ${color}(${time})${reset}`);
  }

  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log();
  if (failed === 0) {
    console.log(`  \x1b[32m✓ All ${passed} checks passed\x1b[0m (${(totalMs / 1000).toFixed(1)}s)`);
    console.log("  Ready to push!\n");
  } else {
    console.log(
      `  \x1b[31m✗ ${failed} of ${passed + failed} checks failed\x1b[0m (${(totalMs / 1000).toFixed(1)}s)`,
    );
    console.log("  Fix issues above before pushing.\n");
  }

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

const isDirectRun =
  process.argv[1] && path.basename(process.argv[1]).replace(/\.[^.]+$/, "") === "release-check";

if (isDirectRun) {
  main();
}

export const _testExports = {
  checkDataFiles,
  checkPublicDownloads,
  checkBuildOutput,
  fileExists,
  fileSize,
  fileHash,
  humanSize,
};
