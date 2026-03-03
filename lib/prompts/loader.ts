/**
 * Prompt loader — loads versioned prompt files from lib/prompts/.
 *
 * Prompt files are markdown with YAML frontmatter (parsed via gray-matter).
 * Each prompt can have an optional .config.json for prompt-specific overrides
 * and an optional .few-shot.md for examples that can be toggled on/off.
 *
 * Config inheritance: prompt config merges with global CLAUDE config from
 * lib/config.ts. Prompt-specific values override globals only when set.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { z } from "zod";
import type { PromptMetadata, PromptConfig, LoadedPrompt } from "../types.js";

const PROMPTS_DIR = path.join(import.meta.dirname, ".");

// ─── Schemas ─────────────────────────────────────────────────────────────────

const PromptMetadataSchema = z.object({
  id: z.string().min(1, "Prompt id is required"),
  version: z.string().min(1, "Prompt version is required"),
  description: z.string().min(1, "Prompt description is required"),
  tags: z.array(z.string()).default([]),
});

const PromptConfigSchema = z.object({
  cacheSystemPrompt: z.boolean().optional(),
  includeFewShot: z.boolean().optional(),
  model: z.string().optional(),
  maxTokens: z.number().positive().optional(),
});

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Load a prompt by ID from lib/prompts/.
 *
 * Reads `{id}.system.md` (required), `{id}.config.json` (optional),
 * and `{id}.few-shot.md` (optional, appended when config.includeFewShot is true).
 *
 * @throws Error if the system prompt file is missing, has invalid frontmatter,
 *         or has an empty body.
 */
export function loadPrompt(id: string): LoadedPrompt {
  const systemPath = path.join(PROMPTS_DIR, `${id}.system.md`);
  const configPath = path.join(PROMPTS_DIR, `${id}.config.json`);
  const fewShotPath = path.join(PROMPTS_DIR, `${id}.few-shot.md`);

  // --- System prompt (required) ---
  if (!fs.existsSync(systemPath)) {
    throw new Error(`Prompt file not found: ${systemPath}`);
  }

  const raw = fs.readFileSync(systemPath, "utf-8");
  const { data: frontmatter, content } = matter(raw);

  // Validate frontmatter
  const metaResult = PromptMetadataSchema.safeParse(frontmatter);
  if (!metaResult.success) {
    const issues = metaResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid prompt frontmatter in ${systemPath}:\n  ${issues.join("\n  ")}`);
  }
  const metadata: PromptMetadata = metaResult.data;

  // Validate body
  const body = content.trim();
  if (!body) {
    throw new Error(`Prompt body is empty in ${systemPath}`);
  }

  // --- Config (optional — falls back to defaults) ---
  let config: PromptConfig = {};
  if (fs.existsSync(configPath)) {
    const configRaw = fs.readFileSync(configPath, "utf-8");
    const configResult = PromptConfigSchema.safeParse(JSON.parse(configRaw));
    if (!configResult.success) {
      const issues = configResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid prompt config in ${configPath}:\n  ${issues.join("\n  ")}`);
    }
    config = configResult.data;
  }

  // --- Few-shot examples (optional, appended when enabled) ---
  let systemPrompt = body;
  if (config.includeFewShot !== false && fs.existsSync(fewShotPath)) {
    const fewShot = fs.readFileSync(fewShotPath, "utf-8").trim();
    if (fewShot) {
      systemPrompt = body + "\n\n" + fewShot;
    }
  }

  return { systemPrompt, config, metadata };
}
