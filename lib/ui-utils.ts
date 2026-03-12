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

/**
 * Returns `target="_blank"` and `rel="noopener noreferrer"` for external URLs.
 * Returns an empty object for internal URLs so the attributes are omitted.
 *
 * Usage: `<a href={href} {...externalLinkProps(href)}>` in markdown renderers,
 * footer links, and anywhere external links need safe defaults.
 */
export function externalLinkProps(href?: string): {
  target?: "_blank";
  rel?: "noopener noreferrer";
} {
  if (!href?.startsWith("http")) return {};
  return { target: "_blank", rel: "noopener noreferrer" };
}
