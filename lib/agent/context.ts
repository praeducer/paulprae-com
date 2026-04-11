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
import { PATHS } from "../config";
import {
  loadCareerData,
  formatCurrentRoleSentence,
  formatCurrentRoleHero,
  getCurrentEmployer,
} from "../career-data";
import { stripEmpty } from "../data-utils";
import type { CareerData } from "../types";
import { loadPrompt } from "../prompts/loader";
import { YEARS_EXPERIENCE, BOOK_INTERVIEW_URL, RESUME_DOWNLOAD_PATHS } from "../constants";

// ─── Knowledge Base Paths ────────────────────────────────────────────────────

const KNOWLEDGE_DIR = PATHS.knowledgeDir;

const KNOWLEDGE_FILES = {
  platformConstraints: path.join(KNOWLEDGE_DIR, "content", "platform-constraints.json"),
  messageTemplates: path.join(KNOWLEDGE_DIR, "content", "message-templates.json"),
  writingFormulas: path.join(KNOWLEDGE_DIR, "content", "writing-formulas.json"),
  audienceFrameworks: path.join(KNOWLEDGE_DIR, "strategy", "audience-frameworks.json"),
  communicationStyles: path.join(KNOWLEDGE_DIR, "brand", "communication-styles.json"),
  companies: path.join(KNOWLEDGE_DIR, "career", "companies.json"),
} as const;

// ─── Context Building ───────────────────────────────────────────────────────

export interface CareerContext {
  careerData: CareerData;
  platformConstraints: unknown;
  messageTemplates: unknown;
  writingFormulas: unknown;
  audienceFrameworks: unknown;
  communicationStyles: unknown;
  companies: unknown;
}

function loadJsonSafe(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Loads all data needed for the agent's system prompt context.
 * Returns null if career data is missing (pipeline hasn't run).
 */
export function loadCareerContext(): CareerContext | null {
  const careerData = loadCareerData();
  if (!careerData) return null;

  return {
    careerData,
    platformConstraints: loadJsonSafe(KNOWLEDGE_FILES.platformConstraints),
    messageTemplates: loadJsonSafe(KNOWLEDGE_FILES.messageTemplates),
    writingFormulas: loadJsonSafe(KNOWLEDGE_FILES.writingFormulas),
    audienceFrameworks: loadJsonSafe(KNOWLEDGE_FILES.audienceFrameworks),
    communicationStyles: loadJsonSafe(KNOWLEDGE_FILES.communicationStyles),
    companies: loadJsonSafe(KNOWLEDGE_FILES.companies),
  };
}

// ─── System Prompt Assembly ─────────────────────────────────────────────────

type PromptMode = "chat" | "tools" | "resume-generator";

const PROMPT_IDS: Record<PromptMode, string> = {
  chat: "career-chat",
  tools: "job-tools",
  "resume-generator": "resume-writer",
};

/**
 * Builds the complete system prompt for a given mode by loading the
 * prompt template (via the shared prompt loader) and injecting career
 * data + knowledge base content.
 *
 * The assembled prompt is designed for Anthropic prompt caching:
 * the career data block is large and stable, making it ideal for caching.
 */
export function buildSystemPrompt(mode: PromptMode): string | null {
  const context = loadCareerContext();
  if (!context) return null;

  const promptId = PROMPT_IDS[mode];
  let template: string;
  try {
    const loaded = loadPrompt(promptId);
    template = loaded.systemPrompt;
  } catch {
    return null;
  }

  // Inject context into template placeholders.
  // Sanitize career data: replace outdated "15 years" claims from LinkedIn
  // with the canonical years-of-experience figure. The LinkedIn summary
  // contains "15 years" which the model reads as ground truth, overriding
  // the grounding rule G2. Fixing at the data layer is more reliable than
  // instruction-level overrides.
  const careerDataJson = JSON.stringify(stripEmpty(context.careerData)).replace(
    /\b15\s+years?\b/gi,
    `${YEARS_EXPERIENCE} years`,
  );
  const audienceJson = JSON.stringify(context.audienceFrameworks);
  const companyJson = JSON.stringify(context.companies);

  // Derive current-role strings at prompt-bake time so that changes to
  // career-data.json propagate to every prompt automatically, without any
  // hardcoded employer names in the .md templates.
  const currentRoleSentence = formatCurrentRoleSentence(context.careerData);
  const currentRoleHero = formatCurrentRoleHero(context.careerData);
  const currentEmployer = getCurrentEmployer(context.careerData);

  let prompt = template
    .replace("{{CAREER_DATA}}", careerDataJson)
    .replace("{{AUDIENCE_FRAMEWORKS}}", audienceJson)
    .replace("{{COMPANY_DATA}}", companyJson)
    .replace("{{BOOK_INTERVIEW_URL}}", BOOK_INTERVIEW_URL)
    .replace(/\{\{CURRENT_ROLE_SENTENCE\}\}/g, currentRoleSentence)
    .replace(/\{\{CURRENT_ROLE_HERO\}\}/g, currentRoleHero)
    .replace(/\{\{CURRENT_EMPLOYER\}\}/g, currentEmployer)
    .replace(/\{\{RESUME_PDF_PATH\}\}/g, RESUME_DOWNLOAD_PATHS.pdf)
    .replace(/\{\{RESUME_DOCX_PATH\}\}/g, RESUME_DOWNLOAD_PATHS.docx)
    .replace(/\{\{RESUME_MD_PATH\}\}/g, RESUME_DOWNLOAD_PATHS.md)
    .replace(/\{\{RESUME_WEB_PATH\}\}/g, RESUME_DOWNLOAD_PATHS.web);

  // Tools mode has additional placeholders
  if (mode === "tools") {
    prompt = prompt
      .replace("{{PLATFORM_CONSTRAINTS}}", JSON.stringify(context.platformConstraints))
      .replace("{{WRITING_FORMULAS}}", JSON.stringify(context.writingFormulas))
      .replace("{{MESSAGE_TEMPLATES}}", JSON.stringify(context.messageTemplates))
      .replace("{{COMMUNICATION_STYLES}}", JSON.stringify(context.communicationStyles));
  }

  return prompt;
}
