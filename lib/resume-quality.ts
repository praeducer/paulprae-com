/**
 * Resume quality scoring — shared between generation and approval pipelines.
 *
 * Provides a numeric quality score for regression detection. The approve
 * script uses this to block promotion of lower-quality resumes.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResumeQualityScore {
  /** Total score (sum of all components) */
  total: number;
  /** Number of ## sections found */
  sectionCount: number;
  /** Number of positions in Experience section */
  positionCount: number;
  /** Total bullet count across all positions */
  totalBullets: number;
  /** Number of bullets containing quantified metrics */
  quantifiedBullets: number;
  /** Resume character count */
  charCount: number;
  /** Number of major companies (Fortune 500 / recognized brands) found */
  majorCompanyCoverage: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const MAJOR_COMPANIES = [
  "Arine",
  "Booz Allen Hamilton",
  "Amazon Web Services",
  "Slalom",
  "Red Ventures",
  "Microsoft",
  "Hyperbloom",
  "Modular Earth",
  "Mento",
  "TReNDS",
  "NeuroLex",
  "Decooda",
];

// ─── Scoring ────────────────────────────────────────────────────────────────

export function scoreResume(markdown: string): ResumeQualityScore {
  const sectionCount = (markdown.match(/^## /gm) || []).length;

  const experienceSection =
    markdown.split("## Professional Experience")[1]?.split(/^## /m)[0] || "";
  const positionBlocks = experienceSection.split(/^### /m).filter((b) => b.trim());
  const positionCount = positionBlocks.length;

  let totalBullets = 0;
  let quantifiedBullets = 0;
  const quantPattern = /\d+[%+]|\$[\d,.]+|\d+M\+|\d+K\+|\d+,\d{3}|\d+\+\s|team of \d/;

  for (const block of positionBlocks) {
    const bullets = block.match(/^- .+/gm) || [];
    totalBullets += bullets.length;
    quantifiedBullets += bullets.filter((b) => quantPattern.test(b)).length;
  }

  const charCount = markdown.length;

  let majorCompanyCoverage = 0;
  for (const company of MAJOR_COMPANIES) {
    if (markdown.includes(company)) majorCompanyCoverage++;
  }

  // Scoring weights — each component contributes to the total
  const total =
    sectionCount * 5 + // ~6 sections × 5 = 30 points
    positionCount * 8 + // ~10 positions × 8 = 80 points
    totalBullets * 3 + // ~30 bullets × 3 = 90 points
    quantifiedBullets * 5 + // ~15 quant bullets × 5 = 75 points
    majorCompanyCoverage * 10 + // ~10 companies × 10 = 100 points
    Math.min(charCount / 100, 80); // max 80 points for length

  return {
    total: Math.round(total),
    sectionCount,
    positionCount,
    totalBullets,
    quantifiedBullets,
    charCount,
    majorCompanyCoverage,
  };
}

export function formatScoreReport(label: string, score: ResumeQualityScore): string {
  return [
    `   ${label} Quality Score: ${score.total}`,
    `     Sections: ${score.sectionCount} | Positions: ${score.positionCount} | Bullets: ${score.totalBullets}`,
    `     Quantified bullets: ${score.quantifiedBullets}/${score.totalBullets} (${score.totalBullets > 0 ? Math.round((score.quantifiedBullets / score.totalBullets) * 100) : 0}%)`,
    `     Major companies: ${score.majorCompanyCoverage}/${MAJOR_COMPANIES.length} | Length: ${score.charCount.toLocaleString()} chars`,
  ].join("\n");
}
