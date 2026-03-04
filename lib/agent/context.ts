/**
 * Career context builder for the AI chat agent.
 *
 * Loads career data + knowledge base files and assembles them into
 * system prompt context strings. Designed for prompt caching — the
 * career data block is stable between deploys and can be cached by
 * the Anthropic API.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { PATHS } from "../config";
import type { CareerData } from "../types";

// ─── Knowledge Base Paths ────────────────────────────────────────────────────

const KNOWLEDGE_DIR = PATHS.knowledgeDir;

const KNOWLEDGE_FILES = {
  platformConstraints: path.join(KNOWLEDGE_DIR, "content", "platform-constraints.json"),
  messageTemplates: path.join(KNOWLEDGE_DIR, "content", "message-templates.json"),
  writingFormulas: path.join(KNOWLEDGE_DIR, "content", "writing-formulas.json"),
  audienceFrameworks: path.join(KNOWLEDGE_DIR, "strategy", "audience-frameworks.json"),
  communicationStyles: path.join(KNOWLEDGE_DIR, "brand", "communication-styles.json"),
} as const;

// ─── Loaders ────────────────────────────────────────────────────────────────

function loadJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function loadCareerDataForAgent(): CareerData | null {
  try {
    const raw = fs.readFileSync(PATHS.careerDataOutput, "utf-8");
    return JSON.parse(raw) as CareerData;
  } catch {
    return null;
  }
}

/** Strips empty/null/undefined values from objects for cleaner prompt context. */
export function stripEmpty(obj: unknown): unknown {
  if (obj === null || obj === undefined || obj === "") return undefined;
  if (Array.isArray(obj)) {
    const filtered = obj.map(stripEmpty).filter((v) => v !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const v = stripEmpty(value);
      if (v !== undefined) cleaned[key] = v;
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
}

// ─── Context Building ───────────────────────────────────────────────────────

export interface CareerContext {
  careerData: CareerData;
  platformConstraints: unknown;
  messageTemplates: unknown;
  writingFormulas: unknown;
  audienceFrameworks: unknown;
  communicationStyles: unknown;
}

/**
 * Loads all data needed for the agent's system prompt context.
 * Returns null if career data is missing (pipeline hasn't run).
 */
export function loadCareerContext(): CareerContext | null {
  const careerData = loadCareerDataForAgent();
  if (!careerData) return null;

  return {
    careerData,
    platformConstraints: loadJsonFile(KNOWLEDGE_FILES.platformConstraints),
    messageTemplates: loadJsonFile(KNOWLEDGE_FILES.messageTemplates),
    writingFormulas: loadJsonFile(KNOWLEDGE_FILES.writingFormulas),
    audienceFrameworks: loadJsonFile(KNOWLEDGE_FILES.audienceFrameworks),
    communicationStyles: loadJsonFile(KNOWLEDGE_FILES.communicationStyles),
  };
}

// ─── System Prompt Assembly ─────────────────────────────────────────────────

type PromptMode = "chat" | "tools";

const PROMPT_FILES: Record<PromptMode, string> = {
  chat: path.join(process.cwd(), "lib", "prompts", "career-chat.system.md"),
  tools: path.join(process.cwd(), "lib", "prompts", "job-tools.system.md"),
};

/**
 * Builds the complete system prompt for a given mode by loading the
 * prompt template and injecting career data + knowledge base content.
 *
 * The assembled prompt is designed for Anthropic prompt caching:
 * the career data block is large and stable, making it ideal for caching.
 */
export function buildSystemPrompt(mode: PromptMode): string | null {
  const context = loadCareerContext();
  if (!context) return null;

  const promptPath = PROMPT_FILES[mode];
  let template: string;
  try {
    const raw = fs.readFileSync(promptPath, "utf-8");
    // Strip YAML frontmatter
    const { content } = matter(raw);
    template = content;
  } catch {
    return null;
  }

  // Inject context into template placeholders
  const careerDataJson = JSON.stringify(stripEmpty(context.careerData), null, 2);
  const audienceJson = JSON.stringify(context.audienceFrameworks, null, 2);

  let prompt = template
    .replace("{{CAREER_DATA}}", careerDataJson)
    .replace("{{AUDIENCE_FRAMEWORKS}}", audienceJson);

  // Tools mode has additional placeholders
  if (mode === "tools") {
    prompt = prompt
      .replace("{{PLATFORM_CONSTRAINTS}}", JSON.stringify(context.platformConstraints, null, 2))
      .replace("{{WRITING_FORMULAS}}", JSON.stringify(context.writingFormulas, null, 2))
      .replace("{{MESSAGE_TEMPLATES}}", JSON.stringify(context.messageTemplates, null, 2))
      .replace("{{COMMUNICATION_STYLES}}", JSON.stringify(context.communicationStyles, null, 2));
  }

  return prompt;
}
