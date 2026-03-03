/**
 * lib/ai/telemetry.ts — Structured generation telemetry logging.
 *
 * Appends generation metrics to a JSONL file for tracking cost, latency,
 * token usage, and cache performance across pipeline runs.
 *
 * Rotation: when the file exceeds MAX_ENTRIES, truncates to KEEP_ENTRIES.
 */

import fs from "fs";
import path from "path";

// ─── Configuration ───────────────────────────────────────────────────────────

const TELEMETRY_PATH = path.join(process.cwd(), "data", "generated", ".telemetry.jsonl");
const MAX_ENTRIES = 100;
const KEEP_ENTRIES = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerationTelemetry {
  timestamp: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheRead: number;
  cacheCreated: number;
  durationMs: number;
  stopReason: string | null;
  costEstimate: number;
  markdownLength: number;
  warnings: number;
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
// Anthropic pricing as of 2025. Cached input is 90% cheaper.

const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-4-6": { input: 15 / 1_000_000, output: 75 / 1_000_000, cacheRead: 1.5 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000, cacheRead: 0.3 / 1_000_000 },
  "claude-haiku-4-5-20251001": {
    input: 0.8 / 1_000_000,
    output: 4 / 1_000_000,
    cacheRead: 0.08 / 1_000_000,
  },
};

/** Estimate cost in USD from token counts and model. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheRead: number = 0,
): number {
  const rates = PRICING[model] ?? PRICING["claude-opus-4-6"];
  const uncachedInput = Math.max(0, inputTokens - cacheRead);
  return uncachedInput * rates.input + cacheRead * rates.cacheRead + outputTokens * rates.output;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/** Append a telemetry entry to the JSONL file. Rotates if over MAX_ENTRIES. */
export function logGeneration(entry: GenerationTelemetry): void {
  const dir = path.dirname(TELEMETRY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(TELEMETRY_PATH, JSON.stringify(entry) + "\n", "utf-8");
  rotateIfNeeded();
}

/** Read all telemetry entries. Returns empty array if file doesn't exist. */
export function readTelemetry(): GenerationTelemetry[] {
  if (!fs.existsSync(TELEMETRY_PATH)) return [];
  const content = fs.readFileSync(TELEMETRY_PATH, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line) as GenerationTelemetry);
}

/** If the file exceeds MAX_ENTRIES, truncate to the most recent KEEP_ENTRIES. */
function rotateIfNeeded(): void {
  if (!fs.existsSync(TELEMETRY_PATH)) return;

  const content = fs.readFileSync(TELEMETRY_PATH, "utf-8").trim();
  if (!content) return;

  const lines = content.split("\n");
  if (lines.length > MAX_ENTRIES) {
    const kept = lines.slice(-KEEP_ENTRIES);
    fs.writeFileSync(TELEMETRY_PATH, kept.join("\n") + "\n", "utf-8");
  }
}

// ─── Console Formatting ──────────────────────────────────────────────────────

/** Format telemetry as a human-readable console summary. */
export function formatTelemetrySummary(entry: GenerationTelemetry): string {
  const lines: string[] = [];
  lines.push(`      Model: ${entry.model}`);
  lines.push(`      Stop reason: ${entry.stopReason}`);
  lines.push(`      Input tokens: ${entry.inputTokens.toLocaleString()}`);
  lines.push(`      Output tokens: ${entry.outputTokens.toLocaleString()}`);
  if (entry.thinkingTokens > 0) {
    lines.push(
      `      Thinking: ~${Math.round(entry.thinkingTokens / 4).toLocaleString()} tokens (estimated)`,
    );
  }
  if (entry.cacheRead > 0 || entry.cacheCreated > 0) {
    lines.push(
      `      Cache: ${entry.cacheRead.toLocaleString()} read, ${entry.cacheCreated.toLocaleString()} created`,
    );
  }
  lines.push(`      Markdown length: ${entry.markdownLength.toLocaleString()} chars`);
  lines.push(`      Duration: ${(entry.durationMs / 1000).toFixed(1)}s`);
  lines.push(`      Cost: ~$${entry.costEstimate.toFixed(4)}`);
  if (entry.warnings > 0) {
    lines.push(`      Warnings: ${entry.warnings} quality check(s) flagged`);
  }
  return lines.join("\n");
}

/** Exported for testing — overrides are not needed since tests use temp files. */
export const _testExports = {
  TELEMETRY_PATH,
  MAX_ENTRIES,
  KEEP_ENTRIES,
};
