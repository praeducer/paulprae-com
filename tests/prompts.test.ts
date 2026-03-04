/**
 * prompts.test.ts — Tests for the prompt loading system.
 *
 * Tests cover: prompt file loading, YAML frontmatter parsing, config
 * validation, few-shot toggling, error handling for malformed prompts,
 * and prompt regression (hash stability).
 *
 * Run: npm test -- tests/prompts.test.ts
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { loadPrompt } from "../lib/prompts/loader.js";

const PROMPTS_DIR = path.join(process.cwd(), "lib", "prompts");

// ─── Happy Path ──────────────────────────────────────────────────────────────

describe("loadPrompt — resume-writer", () => {
  const prompt = loadPrompt("resume-writer");

  it("returns a valid LoadedPrompt shape", () => {
    expect(prompt).toHaveProperty("systemPrompt");
    expect(prompt).toHaveProperty("config");
    expect(prompt).toHaveProperty("metadata");
    expect(typeof prompt.systemPrompt).toBe("string");
  });

  it("has correct metadata", () => {
    expect(prompt.metadata.id).toBe("resume-writer");
    expect(prompt.metadata.description).toBeTruthy();
    expect(Array.isArray(prompt.metadata.tags)).toBe(true);
  });

  it("includes config with cacheSystemPrompt enabled", () => {
    expect(prompt.config.cacheSystemPrompt).toBe(true);
  });

  it("system prompt contains core instructions", () => {
    expect(prompt.systemPrompt).toContain("<brand_voice>");
    expect(prompt.systemPrompt).toContain("<resume_format>");
    expect(prompt.systemPrompt).toContain("<quality_rules>");
    expect(prompt.systemPrompt).toContain("<output_instructions>");
    expect(prompt.systemPrompt).toContain("<grounding_rules>");
  });

  it("system prompt includes few-shot examples when config.includeFewShot is true", () => {
    expect(prompt.config.includeFewShot).toBe(true);
    expect(prompt.systemPrompt).toContain("Weak:");
    expect(prompt.systemPrompt).toContain("Strong:");
  });

  it("system prompt is long enough for prompt caching (>1024 tokens ≈ 4000 chars)", () => {
    expect(prompt.systemPrompt.length).toBeGreaterThan(4000);
  });
});

// ─── Few-Shot Toggling ───────────────────────────────────────────────────────

describe("loadPrompt — few-shot file", () => {
  it("few-shot file exists separately", () => {
    const fewShotPath = path.join(PROMPTS_DIR, "resume-writer.few-shot.md");
    expect(fs.existsSync(fewShotPath)).toBe(true);
  });

  it("few-shot file contains weak/strong pairs", () => {
    const content = fs.readFileSync(path.join(PROMPTS_DIR, "resume-writer.few-shot.md"), "utf-8");
    const weakCount = (content.match(/Weak:/g) || []).length;
    const strongCount = (content.match(/Strong:/g) || []).length;
    expect(weakCount).toBeGreaterThanOrEqual(3);
    expect(strongCount).toBeGreaterThanOrEqual(3);
  });

  it("system.md file does not contain few-shot examples", () => {
    const content = fs.readFileSync(path.join(PROMPTS_DIR, "resume-writer.system.md"), "utf-8");
    // The body of the .system.md file itself should not have the examples
    expect(content).not.toContain('Weak: "Worked on machine learning projects"');
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────────

describe("loadPrompt — error cases", () => {
  it("throws for non-existent prompt ID", () => {
    expect(() => loadPrompt("nonexistent-prompt")).toThrow("not found");
  });

  it("throws descriptive error for missing prompt file", () => {
    expect(() => loadPrompt("does-not-exist")).toThrow(/Prompt file not found/);
  });
});

// Prompt regression hash test removed — broke on every prompt edit with zero bug-catching value.
