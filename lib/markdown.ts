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

/**
 * Strip the resume header block (H1 + contact line + first separator).
 * The resume markdown always starts with:
 *   # Name
 *   **Title** | Location | email | links
 *   ---
 *   ## First Section ...
 *
 * The web page renders name/contact in a sticky header, so this
 * avoids duplicating that content in the body.
 */
export function stripHeaderBlock(markdown: string): string {
  const separator = markdown.indexOf("\n---\n");
  if (separator < 0) return markdown;
  return markdown.slice(separator + 5).trimStart();
}
