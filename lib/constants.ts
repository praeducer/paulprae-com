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

/** Years of professional enterprise experience. Career start: Microsoft, July 2012. */
export const YEARS_EXPERIENCE = "13+";

/** Default meta description for the homepage / layout. */
export const SITE_DESCRIPTION = `Chat with an AI assistant about ${SITE_NAME}'s career. ${YEARS_EXPERIENCE} years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.`;

/** OG / Twitter meta description — punchier, lead with tagline. */
export const SITE_OG_DESCRIPTION = `${SITE_TAGLINE}. ${YEARS_EXPERIENCE} years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.`;

/** Hero description shown on the chat homepage. */
export const HERO_DESCRIPTION = `${YEARS_EXPERIENCE} years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance. Currently building AI agents and data platforms at Arine.`;

// ─── Input Limits ───────────────────────────────────────────────────────────

/** Per-message character limit — enforced by both the UI and the API. */
export const MAX_MESSAGE_CHARS = 4_000;
