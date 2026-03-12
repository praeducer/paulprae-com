/**
 * Shared constants used by both client components and server API routes.
 * Keep this file free of server-only imports (fs, path, etc.) so
 * client components can import from it.
 */

// ─── Site Identity ──────────────────────────────────────────────────────────
// Single source of truth for branding strings used across layout, pages,
// components, and metadata. Update here to change everywhere.

export const SITE_NAME = "Paul Prae";
export const SITE_SUBTITLE = "Principal AI Engineer & Solutions Architect";
export const SITE_TAGLINE = "Building AI Agents That Ship AI Products";
export const SITE_URL = "https://paulprae.com";
export const BOOK_INTERVIEW_URL =
  "https://outlook.office.com/bookwithme/user/a0fca4b720774cf286bc50ab99727c5a@Paulprae.com?anonymous&ismsaljsauthenabled&ep=plink";

/** Years of professional enterprise experience. Career start: Microsoft, July 2012. */
export const YEARS_EXPERIENCE = "13+";

/** Default meta description for the homepage / layout. */
export const SITE_DESCRIPTION = `Chat with an AI assistant about ${SITE_NAME}'s career. ${YEARS_EXPERIENCE} years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.`;

/** OG / Twitter meta description — punchier, lead with tagline. */
export const SITE_OG_DESCRIPTION = `${SITE_TAGLINE}. ${YEARS_EXPERIENCE} years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.`;

/** Hero description shown on the chat homepage. */
export const HERO_DESCRIPTION = `${YEARS_EXPERIENCE} years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance. Currently building AI agents and data platforms at Arine.`;

// ─── External Links ─────────────────────────────────────────────────────────

export const SITE_DOMAIN = "paulprae.com";
export const GITHUB_URL = "https://github.com/praeducer/paulprae-com";
export const GITHUB_PROFILE_URL = "https://github.com/praeducer";

// ─── Resume Downloads ───────────────────────────────────────────────────────

export const RESUME_DOWNLOAD_PATHS = {
  pdf: "/Paul-Prae-Resume.pdf",
  docx: "/Paul-Prae-Resume.docx",
  md: "/Paul-Prae-Resume.md",
  web: "/resume",
} as const;

// ─── Navigation Styles ──────────────────────────────────────────────────────

/** Standard nav link — used for Resume, PDF download, contextual button. */
export const NAV_LINK_CLASS =
  "inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

/** Primary CTA button — solid blue, used for Book Interview. */
export const CTA_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500";

/** Contact/download link in secondary nav row — lighter weight. */
export const CONTACT_LINK_CLASS =
  "inline-flex min-h-[44px] items-center gap-1 rounded-md px-2.5 text-xs text-slate-500 transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:text-slate-400 dark:hover:text-slate-100";

// ─── Chat AI Configuration ──────────────────────────────────────────────────

export const CHAT_MODEL_ID = "claude-sonnet-4-6";

export const CHAT_CONFIG = {
  maxOutputTokens: 2048,
  chatTemperature: 0.7,
  toolsTemperature: 0.5,
} as const;

export const RESUME_GENERATION_CONFIG = {
  maxOutputTokens: 8192,
  temperature: 0.3,
} as const;

// ─── Input Limits ───────────────────────────────────────────────────────────

/** Per-message character limit — enforced by both the UI and the API. */
export const MAX_MESSAGE_CHARS = 4_000;

export const CHAT_REQUEST_LIMITS = {
  maxMessages: 50,
  maxBodyBytes: 256_000,
  maxJobDescriptionChars: 10_000,
  maxEmphasisItems: 10,
  maxEmphasisChars: 200,
} as const;

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export const RATE_LIMIT_CONFIG = {
  windowMs: 60_000,
  maxRequests: 20,
  prefix: "paulprae:chat",
} as const;
