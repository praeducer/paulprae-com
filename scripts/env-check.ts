#!/usr/bin/env tsx
// env-check.ts - Environment validation script for paulprae-com development
// Validates tool versions, WSL status, paths, and required files

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

function checkCommand(command: string, expectedOutput?: RegExp): boolean {
  try {
    const output = execSync(command, { encoding: "utf8" }).trim();
    if (expectedOutput && !expectedOutput.test(output)) {
      console.error(`❌ ${command}: ${output} (does not match ${expectedOutput})`);
      return false;
    }
    console.log(`✅ ${command}: ${output}`);
    return true;
  } catch (error) {
    console.error(`❌ ${command}: not found or failed`);
    return false;
  }
}

function checkFile(filePath: string): boolean {
  if (existsSync(filePath)) {
    console.log(`✅ ${filePath}: exists`);
    return true;
  } else {
    console.error(`❌ ${filePath}: missing`);
    return false;
  }
}

console.log("🔍 Environment Check for paulprae-com\n");

// Tool versions
const tools = [
  { cmd: "node --version", regex: /^v\d+/ },
  { cmd: "npm --version", regex: /^\d+/ },
  { cmd: "git --version", regex: /^git version/ },
  { cmd: "gh --version", regex: /^gh version/ },
  { cmd: "pandoc --version", regex: /^pandoc/ },
  { cmd: "typst --version", regex: /^typst/ },
  { cmd: "shellcheck --version", regex: /^ShellCheck/ },
  { cmd: "python3 --version", regex: /^Python/ },
  { cmd: "pip --version", regex: /^pip/ },
];

let allGood = true;
for (const tool of tools) {
  if (!checkCommand(tool.cmd, tool.regex)) {
    allGood = false;
  }
}

// WSL status (if on WSL)
try {
  const wslStatus = execSync("wsl --status", { encoding: "utf8" });
  console.log("✅ WSL status: OK");
} catch {
  console.log("⚠️  Not running on WSL or wsl command unavailable");
}

// Repository path check
const cwd = process.cwd();
if (cwd.includes("/mnt/c/")) {
  console.error("❌ Repository in /mnt/c - move to WSL filesystem for better performance");
  allGood = false;
} else {
  console.log("✅ Repository path: OK (not in /mnt/c)");
}

// Required files
const requiredFiles = [".env.local", "package.json", "tsconfig.json", "vitest.config.ts"];

for (const file of requiredFiles) {
  if (!checkFile(join(cwd, file))) {
    allGood = false;
  }
}

console.log(`\n${allGood ? "🎉 All checks passed!" : "❌ Some checks failed. Fix issues above."}`);
process.exit(allGood ? 0 : 1);
