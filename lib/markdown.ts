/**
 * Shared markdown utilities — single source of truth for operations
 * used across the pipeline (export), web rendering (page.tsx), and tests.
 */

/**
 * Strip HTML comments from markdown content.
 * Used to remove generation metadata headers (<!-- Generated: ... -->)
 * before rendering or exporting the resume.
 */
export function stripHtmlComments(raw: string): string {
  return raw.replace(/^<!--[\s\S]*?-->\n*/gm, "").trim();
}
