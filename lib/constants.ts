/**
 * Shared constants used by both client components and server API routes.
 * Keep this file free of server-only imports (fs, path, etc.) so
 * client components can import from it.
 */

/** Per-message character limit — enforced by both the UI and the API. */
export const MAX_MESSAGE_CHARS = 4_000;
