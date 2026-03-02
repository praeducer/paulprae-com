/**
 * Resume Section Parser — splits a resume markdown file into named sections
 * for granular comparison and reassembly.
 *
 * Used by:
 * - scripts/compare-resumes.ts (section-by-section comparison)
 * - scripts/approve-resume.ts (section count reporting)
 *
 * Parsing strategy: Split on `## ` (H2 headings). Everything before the first
 * H2 is "front matter" (typically the H1 name + professional summary).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResumeSection {
  /** Original heading text, e.g. "Professional Experience" */
  heading: string;
  /** URL-safe slug, e.g. "professional-experience" */
  slug: string;
  /** Full markdown content under this heading (includes the ## line itself) */
  content: string;
  /** Number of non-empty lines in content */
  lineCount: number;
}

export interface ParsedResume {
  /** Everything before the first ## (H1, contact info, professional summary) */
  frontMatter: string;
  /** Ordered list of ## sections */
  sections: ResumeSection[];
  /** Original full markdown (for reference) */
  raw: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert heading text to a URL-safe slug. Matches app/page.tsx extractSections(). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Count non-empty lines in a string. */
function countLines(text: string): number {
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Parse a resume markdown string into front matter + named sections.
 *
 * Sections are split on lines starting with `## ` (H2 headings).
 * The front matter is everything before the first H2.
 */
export function parseResume(markdown: string): ParsedResume {
  const lines = markdown.split("\n");

  let frontMatterLines: string[] = [];
  const sections: ResumeSection[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);

    if (h2Match) {
      // Flush previous section or front matter
      if (currentHeading !== null) {
        const content = currentLines.join("\n");
        sections.push({
          heading: currentHeading,
          slug: slugify(currentHeading),
          content,
          lineCount: countLines(content),
        });
      } else {
        frontMatterLines = currentLines;
      }

      // Start new section
      currentHeading = h2Match[1].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Flush last section or front matter
  if (currentHeading !== null) {
    const content = currentLines.join("\n");
    sections.push({
      heading: currentHeading,
      slug: slugify(currentHeading),
      content,
      lineCount: countLines(content),
    });
  } else {
    frontMatterLines = currentLines;
  }

  return {
    frontMatter: frontMatterLines.join("\n"),
    sections,
    raw: markdown,
  };
}

/**
 * Reassemble a resume from front matter + ordered sections.
 *
 * Produces valid markdown by joining front matter and section content
 * with appropriate spacing.
 */
export function assembleResume(frontMatter: string, sections: ResumeSection[]): string {
  const parts: string[] = [frontMatter];

  for (const section of sections) {
    parts.push(section.content);
  }

  // Join with double newline to ensure blank line between sections
  let result = parts.join("\n\n");

  // Normalize: collapse 3+ consecutive newlines to 2 (single blank line)
  result = result.replace(/\n{3,}/g, "\n\n");

  // Ensure trailing newline
  if (!result.endsWith("\n")) {
    result += "\n";
  }

  return result;
}
