/**
 * scripts/validate-docs.ts — Documentation quality check.
 *
 * Validates:
 *   1. Required documentation files exist
 *   2. Internal markdown links resolve to existing files
 *   3. Fragment links (#heading) match actual headings in target files
 *
 * Usage:
 *   npm run validate:docs
 *
 * Exit code:
 *   0  All checks passed
 *   1  One or more checks failed
 */

import fs from "fs";
import path from "path";
import { isDirectRun } from "../lib/script-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinkResult {
  source: string;
  link: string;
  target: string;
  valid: boolean;
  reason?: string;
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const ROOT = process.cwd();

/** Required docs that must always exist in the repository. */
const REQUIRED_DOCS = [
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "docs/README.md",
  "docs/technical-design-document.md",
  "docs/mcp-setup.md",
];

/** Directories to skip when scanning for markdown files. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  ".git",
  ".vercel",
  "data/generated/versions",
  "lib/prompts", // AI prompt files contain template syntax that looks like markdown links
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively find all .md files, excluding SKIP_DIRS. */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(ROOT, fullPath);

      if (entry.isDirectory()) {
        // Normalize path separators so SKIP_DIRS entries using forward slashes
        // match on Windows (where relPath uses backslashes).
        const normalizedRel = relPath.split(path.sep).join("/");
        const shouldSkip = [...SKIP_DIRS].some(
          (skip) => normalizedRel === skip || normalizedRel.startsWith(skip + "/"),
        );
        if (!shouldSkip) walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/** Extract internal links from markdown content. Returns [{text, target}]. */
function extractLinks(content: string): { text: string; target: string }[] {
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  const links: { text: string; target: string }[] = [];

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[2].trim();

    // Skip external URLs and mailto links
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    links.push({ text: match[1], target });
  }

  return links;
}

/** Convert heading text to a GitHub-compatible slug. */
function headingToSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Extract heading slugs from markdown content. */
function extractHeadings(content: string): string[] {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const slugs: string[] = [];

  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    slugs.push(headingToSlug(match[1].trim()));
  }

  return slugs;
}

/** Validate a single link from a source file. */
function validateLink(sourceFile: string, link: { text: string; target: string }): LinkResult {
  const sourceDir = path.dirname(sourceFile);
  const [filePart, fragment] = link.target.split("#");

  // Fragment-only link (e.g. #getting-started) — check in same file
  if (!filePart) {
    const content = fs.readFileSync(sourceFile, "utf-8");
    const headings = extractHeadings(content);
    const valid = headings.includes(fragment);
    return {
      source: path.relative(ROOT, sourceFile),
      link: link.target,
      target: path.relative(ROOT, sourceFile) + "#" + fragment,
      valid,
      reason: valid ? undefined : `fragment #${fragment} not found in headings`,
    };
  }

  // File link — resolve relative to source file
  const targetPath = path.resolve(sourceDir, filePart);

  if (!fs.existsSync(targetPath)) {
    return {
      source: path.relative(ROOT, sourceFile),
      link: link.target,
      target: path.relative(ROOT, targetPath),
      valid: false,
      reason: "file not found",
    };
  }

  // If target is a directory, it's valid (GitHub renders directory listings)
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    return {
      source: path.relative(ROOT, sourceFile),
      link: link.target,
      target: path.relative(ROOT, targetPath),
      valid: true,
    };
  }

  // If fragment, validate it exists in the target file
  if (fragment && targetPath.endsWith(".md")) {
    const content = fs.readFileSync(targetPath, "utf-8");
    const headings = extractHeadings(content);
    const valid = headings.includes(fragment);
    return {
      source: path.relative(ROOT, sourceFile),
      link: link.target,
      target: path.relative(ROOT, targetPath) + "#" + fragment,
      valid,
      reason: valid ? undefined : `fragment #${fragment} not found in headings`,
    };
  }

  return {
    source: path.relative(ROOT, sourceFile),
    link: link.target,
    target: path.relative(ROOT, targetPath),
    valid: true,
  };
}

// ─── Check Runners ───────────────────────────────────────────────────────────

function checkRequiredDocs(): CheckResult {
  const start = Date.now();
  const missing: string[] = [];

  for (const doc of REQUIRED_DOCS) {
    const fullPath = path.join(ROOT, doc);
    if (!fs.existsSync(fullPath)) {
      missing.push(doc);
    }
  }

  return {
    name: "Required docs",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `${REQUIRED_DOCS.length} required docs present`
        : `missing: ${missing.join(", ")}`,
    durationMs: Date.now() - start,
  };
}

function checkLinks(): CheckResult {
  const start = Date.now();
  const mdFiles = findMarkdownFiles(ROOT);
  const broken: LinkResult[] = [];
  let totalLinks = 0;

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const links = extractLinks(content);
    totalLinks += links.length;

    for (const link of links) {
      const result = validateLink(file, link);
      if (!result.valid) {
        broken.push(result);
      }
    }
  }

  return {
    name: "Internal links",
    passed: broken.length === 0,
    detail:
      broken.length === 0
        ? `${totalLinks} links in ${mdFiles.length} files — all valid`
        : broken.map((b) => `${b.source}: [${b.link}] — ${b.reason}`).join("; "),
    durationMs: Date.now() - start,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log();
  console.log("  Validating documentation...");
  console.log();

  const results: CheckResult[] = [checkRequiredDocs(), checkLinks()];

  const maxName = Math.max(...results.map((r) => r.name.length));

  for (const r of results) {
    const icon = r.passed ? "\u2713" : "\u2717";
    const color = r.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const name = r.name.padEnd(maxName);
    const time = r.durationMs > 999 ? `${(r.durationMs / 1000).toFixed(1)}s` : `${r.durationMs}ms`;
    console.log(`  ${color}${icon}${reset}  ${name}  ${r.detail}  ${color}(${time})${reset}`);
  }

  const failed = results.filter((r) => !r.passed).length;

  console.log();
  if (failed === 0) {
    console.log(`  \x1b[32m\u2713 All documentation checks passed\x1b[0m`);
  } else {
    console.log(`  \x1b[31m\u2717 ${failed} documentation check(s) failed\x1b[0m`);
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (isDirectRun("validate-docs")) {
  main();
}

export const _testExports = {
  findMarkdownFiles,
  extractLinks,
  extractHeadings,
  headingToSlug,
  validateLink,
  checkRequiredDocs,
  checkLinks,
  REQUIRED_DOCS,
};
