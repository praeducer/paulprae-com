/**
 * Shared constants used by both client components and server API routes.
 * Keep this file free of server-only imports (fs, path, etc.) so
 * client components can import from it.
 */

// ─── Site Identity ──────────────────────────────────────────────────────────
// Single source of truth for branding strings used across layout, pages,
// components, and metadata. Update here to change everywhere.

export const SITE_NAME = "Paul Prae";
export const SITE_SUBTITLE = "Principal AI Engineer & Architect";
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
export const CONTACT_EMAIL = "hireme@paulprae.com";
export const LINKEDIN_URL = "https://www.linkedin.com/in/paulprae";

// ─── Resume Downloads ───────────────────────────────────────────────────────

/** Public-facing base filename (without extension) for resume downloads.
 *  Must match the pipeline output in lib/config.ts (derived from career-data.json profile.name).
 *  If the name changes there, update here too — `npm run check` will catch mismatches. */
export const RESUME_PUBLIC_FILE_BASE = "Paul-Prae-Resume";

export const RESUME_DOWNLOAD_PATHS = {
  pdf: `/${RESUME_PUBLIC_FILE_BASE}.pdf`,
  docx: `/${RESUME_PUBLIC_FILE_BASE}.docx`,
  md: `/${RESUME_PUBLIC_FILE_BASE}.md`,
  web: "/resume",
} as const;

// ─── Navigation Styles ──────────────────────────────────────────────────────

/** Standard nav link — used for Resume, PDF download, contextual button. */
export const NAV_LINK_CLASS =
  "inline-flex min-h-[44px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

/** Primary CTA button — solid blue, used for Book Interview. */
export const CTA_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500";

/** Contact/download link in secondary nav row — lighter weight.
 *  44px mobile tap target tightened to 36px on desktop for visual compactness. */
export const CONTACT_LINK_CLASS =
  "inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1 rounded-md px-2.5 text-xs text-slate-500 transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:text-slate-400 dark:hover:text-slate-100";

/** Inline footer link — inherits parent text color, adds underline + hover contrast. */
export const FOOTER_LINK_CLASS =
  "underline hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded focus-visible:outline-none dark:hover:text-slate-200";

// ─── Page-Level Button Styles ──────────────────────────────────────────────
// Used by error and not-found pages. Distinct from nav-level CTA_BUTTON_CLASS
// (smaller text, tighter padding, min-h tap target).

/** Primary action button — solid blue, used on error/not-found pages. */
export const BUTTON_PRIMARY_CLASS =
  "rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none";

/** Secondary action button — outlined, used on error/not-found pages. */
export const BUTTON_SECONDARY_CLASS =
  "rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";

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
