/**
 * Convert text to a URL-safe slug for HTML id attributes and deep-linking.
 *
 * Used by the section nav, heading components, and resume parser.
 * Note: validate-docs.ts has its own `headingToSlug()` tuned for
 * GitHub-flavored markdown compatibility — leave that separate.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
