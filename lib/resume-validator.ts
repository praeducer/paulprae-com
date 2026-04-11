/**
 * lib/resume-validator.ts — Deterministic regex/string-based validation
 * for generated resume markdown.
 *
 * Fast, no API calls, runs on every generation. Catches structural bugs
 * (missing sections, passive voice, cliches, first-person leakage,
 * numeric dates, broken links, cross-entity conflation, action-verb
 * coverage, recency-tier bullet minimums).
 *
 * Distinct from scripts/grade-content.ts, which is the LLM-as-judge
 * semantic grader. Both read from the same rules eventually (Phase A2
 * wires them to lib/writing-rules.ts); today the validator has
 * inlined constants that will migrate in a follow-up.
 *
 * Used by:
 *   - scripts/generate-resume.ts (main resume generation)
 *   - scripts/generate-tailored-resume.ts (tailored resume generation)
 *
 * Extraction history: previously lived in scripts/generate-resume.ts
 * lines 151-385. Extracted 2026-04-10 to close the gap where the
 * tailored pipeline had no post-generation validation at all.
 */

import type { CareerData } from "./types.js";
import { getSuppressedSkills } from "./writing-rules.js";

/**
 * Validate a generated resume markdown against deterministic quality rules.
 * Returns an array of warning strings (empty if no issues).
 */
export function validateResume(markdown: string, careerData: CareerData): string[] {
  const warnings: string[] = [];
  const currentYear = new Date().getFullYear();

  const expectedSections = [
    "Professional Summary",
    "Professional Experience",
    "Education",
    "Technical Skills",
  ];
  for (const section of expectedSections) {
    if (!markdown.includes(`## ${section}`)) {
      warnings.push(`Missing expected section: "## ${section}"`);
    }
  }

  const charCount = markdown.length;
  if (charCount < 3000) {
    warnings.push(
      `Resume appears too short (${charCount.toLocaleString()} chars, expected 4000-10000 for ~2 pages)`,
    );
  } else if (charCount > 12000) {
    warnings.push(
      `Resume appears too long (${charCount.toLocaleString()} chars, target is ~2 pages / 4000-10000 chars)`,
    );
  }

  const recentPositions = careerData.positions
    .filter((p) => !p.endDate || p.endDate >= "2020")
    .slice(0, 5);
  for (const pos of recentPositions) {
    if (pos.company && !markdown.includes(pos.company)) {
      warnings.push(`Recent employer "${pos.company}" not found in generated resume`);
    }
  }

  // Strip HTML comment header (generator prepends provenance comments) before
  // checking for H1. The first non-comment, non-blank line should be `# Name`.
  const firstContentLine = markdown
    .split("\n")
    .find((l) => l.trim() && !l.trim().startsWith("<!--"));
  if (!firstContentLine || !firstContentLine.startsWith("# ")) {
    warnings.push("Resume does not start with H1 heading (# Name)");
  }

  const firstPersonPattern =
    /(?<![A-Za-z])I(?:\s+(?:led|built|managed|created|developed|designed|worked|helped|assisted|was|am|have|had))\b/;
  if (firstPersonPattern.test(markdown)) {
    warnings.push(
      'Resume contains first-person "I" statements (brand voice requires third-person)',
    );
  }

  const passiveMarkers = [
    "was responsible for",
    "was involved in",
    "was tasked with",
    "assisted with",
    "helped with",
    "participated in",
  ];
  for (const marker of passiveMarkers) {
    if (markdown.toLowerCase().includes(marker)) {
      warnings.push(`Resume contains passive/weak phrasing: "${marker}"`);
    }
  }

  const brokenLinks = /\[[^\]]*\]\([^)]*$|\[[^\]]*$\(/gm;
  if (brokenLinks.test(markdown)) {
    warnings.push("Resume contains malformed markdown link syntax");
  }

  // HTTP URL check in Projects section
  const projectsSection = markdown.split("## Projects")[1]?.split(/^## /m)[0] || "";
  if (projectsSection) {
    const httpLinks = projectsSection.match(/\]\(http:\/\/[^)]+\)/g) || [];
    for (const link of httpLinks) {
      warnings.push(`Projects section contains non-HTTPS link (likely stale): ${link}`);
    }
  }

  // Invented-phrase detection in Professional Summary
  const summarySection = markdown.split("## Professional Summary")[1]?.split(/^---$/m)[0] || "";
  if (summarySection) {
    const suspiciousPatterns = [
      /progressive\s+\w+\s+leadership/i,
      /holistic\s+\w+\s+\w+/i,
      /synergistic\s+\w+/i,
      /transformational\s+\w+\s+architecture/i,
      /full-spectrum\s+\w+/i,
    ];
    for (const pattern of suspiciousPatterns) {
      const match = summarySection.match(pattern);
      if (match) {
        warnings.push(
          `Professional Summary may contain invented phrasing: "${match[0]}" — verify this is standard industry terminology`,
        );
      }
    }
  }

  const experienceSection =
    markdown.split("## Professional Experience")[1]?.split(/^## /m)[0] || "";
  if (experienceSection) {
    const numericDates = /\b(?:0?[1-9]|1[0-2])\/\d{4}\b/.test(experienceSection);
    if (numericDates) {
      warnings.push('Experience dates use numeric format (expected "Mon YYYY")');
    }
  }

  const positionBlocks = experienceSection.split(/^### /m).filter((b) => b.trim());
  for (const block of positionBlocks) {
    const bullets = block.match(/^- .+/gm) || [];
    const posTitle = block.split("\n")[0].trim();
    const actionVerbPattern =
      /^- (?:Led|Architected|Built|Designed|Delivered|Developed|Established|Scaled|Reduced|Automated|Deployed|Implemented|Launched|Managed|Mentored|Optimized|Spearheaded|Transformed|Created|Drove|Engineered|Executed|Integrated|Migrated|Orchestrated|Pioneered|Streamlined|Grew|Contributed|Authored|Collaborated)/;
    const actionBullets = bullets.filter((b) => actionVerbPattern.test(b));
    const actionVerbPct = bullets.length > 0 ? actionBullets.length / bullets.length : 1;
    if (bullets.length >= 2 && actionVerbPct < 0.75) {
      warnings.push(
        `Position "${posTitle}" has ${actionBullets.length}/${bullets.length} bullets starting with action verbs (${Math.round(actionVerbPct * 100)}%, target ≥75%)`,
      );
    }

    // Quantification density: warn if a position has 2+ bullets but zero quantified metrics
    const quantPattern = /\d+[%+]|\$[\d,.]+|\d+M\+|\d+K\+|\d+,\d{3}|\d+\+\s|team of \d/;
    const quantBullets = bullets.filter((b) => quantPattern.test(b));
    if (bullets.length >= 2 && quantBullets.length === 0) {
      warnings.push(
        `Position "${posTitle}" has ${bullets.length} bullets but zero quantified metrics (numbers, percentages, dollar amounts)`,
      );
    }
  }

  // Location validation: check header uses profile.location, not a position location
  if (careerData.profile?.location) {
    const profileCity = careerData.profile.location.split(",")[0].trim();
    const headerLine = markdown.split("\n").find((l) => l.startsWith("**"));
    if (headerLine && !headerLine.includes(profileCity)) {
      // Check if it uses a different city (likely from a position)
      const positionCities = careerData.positions
        .filter((p) => p.location)
        .map((p) => p.location.split(",")[0].trim())
        .filter((c) => c && c !== profileCity);
      for (const city of positionCities) {
        if (headerLine.includes(city)) {
          warnings.push(
            `Header location uses "${city}" (from a position) instead of "${profileCity}" (from profile.location)`,
          );
          break;
        }
      }
    }
  }

  // Cross-entity conflation detection: check if company-specific metrics
  // appear in bullets for a different company's position
  const companyMetricPatterns: { company: string; pattern: RegExp; metric: string }[] = [
    {
      company: "Arine",
      pattern: /50M\+\s*(?:health plan\s*)?members/i,
      metric: "50M+ members (Arine has >30M)",
    },
    {
      company: "Arine",
      pattern: /ML\s+pipelines?.*(?:clinical|health\s*plan|member)/i,
      metric: "ML pipelines at Arine (Paul does data ops, not ML)",
    },
    {
      company: "Arine",
      pattern: /30\+\s*health\s*plans/i,
      metric: "30+ health plans (verified: 45+)",
    },
  ];

  for (const { company, pattern, metric } of companyMetricPatterns) {
    if (pattern.test(markdown)) {
      warnings.push(
        `Potential conflation/stale data: "${metric}" — verify against ${company} company data`,
      );
    }
  }

  // Resume cliche detection
  const cliches = [
    "track record",
    "proven ability",
    "results-driven",
    "passionate about",
    "seasoned professional",
    "go-to person",
    "thought leader",
  ];
  for (const cliche of cliches) {
    if (markdown.toLowerCase().includes(cliche)) {
      warnings.push(`Resume contains cliche phrasing: "${cliche}"`);
    }
  }

  // Suppressed-skill leakage detection
  // (Reads from writing-rules.json to stay in sync with the single source of truth.)
  const suppressedSkills = loadSuppressedSkills();
  for (const skill of suppressedSkills) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(markdown)) {
      warnings.push(
        `Resume contains suppressed skill "${skill}" — verify it has been removed per writing-rules.json suppress_from_output.skills`,
      );
    }
  }

  // Minimum bullet count by recency tier
  for (const block of positionBlocks) {
    const posTitle = block.split("\n")[0].trim();
    const bullets = block.match(/^- .+/gm) || [];

    // Extract end date from the position block (format: "Mon YYYY – Mon YYYY" or "– Present")
    const dateMatch = block.match(
      /\|\s*(?:[A-Z][a-z]{2}\s+)?(\d{4})\s*[–-]\s*(?:Present|(?:[A-Z][a-z]{2}\s+)?(\d{4}))/,
    );
    let endYear = currentYear;
    if (dateMatch) {
      endYear = dateMatch[2] ? parseInt(dateMatch[2]) : currentYear;
    }

    const yearsAgo = currentYear - endYear;
    let minBullets: number;
    let tier: string;

    if (yearsAgo <= 2) {
      minBullets = 3;
      tier = "Tier 1 (last 2 years)";
    } else if (yearsAgo <= 5) {
      minBullets = 2;
      tier = "Tier 2 (2-5 years)";
    } else if (yearsAgo <= 10) {
      minBullets = 2;
      tier = "Tier 3 (5-10 years)";
    } else {
      minBullets = 1;
      tier = "Tier 4 (10+ years)";
    }

    if (bullets.length < minBullets) {
      warnings.push(
        `Position "${posTitle}" has ${bullets.length} bullet(s) — ${tier} minimum is ${minBullets}`,
      );
    }
  }

  return warnings;
}

/**
 * Load the suppressed-skills list from writing-rules.json via the typed loader.
 * Falls back to an empty array if the file is missing or malformed.
 */
function loadSuppressedSkills(): string[] {
  return getSuppressedSkills();
}

/** Back-compat alias for legacy callers importing the old name. */
export const validateResumeOutput = validateResume;
