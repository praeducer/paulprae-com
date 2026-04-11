import fs from "fs";
import type { CareerData, CareerPosition } from "./types";
import { PATHS } from "./config";

/**
 * Load career data from the generated JSON file.
 * Returns null if the file doesn't exist (pipeline hasn't run yet).
 */
export function loadCareerData(): CareerData | null {
  try {
    const raw = fs.readFileSync(PATHS.careerDataOutput, "utf-8");
    return JSON.parse(raw) as CareerData;
  } catch {
    return null;
  }
}

// ─── Current Role Selection ─────────────────────────────────────────────────
// Any code that needs to know "who is Paul working for right now" should
// route through these helpers instead of hardcoding an employer name. When
// the current job changes, the only edits required are in the source data
// (Positions.csv + the knowledge base) — everything else derives from it.

/**
 * Companies that are perpetual side-ventures and should never be treated
 * as Paul's primary current employer, even if their entries carry a null
 * endDate. The getCurrentRole() heuristic skips these first.
 */
const SIDE_VENTURE_COMPANIES = new Set(["Modular Earth", "Hyperbloom", "Paul Prae"]);

/**
 * Pick the position that best represents Paul's current primary role.
 *
 * Heuristic:
 *   1. Consider only positions with endDate === null (active roles).
 *   2. Exclude perpetual side-ventures (Modular Earth, Hyperbloom, self-brand).
 *   3. Among the remainder, pick the one with the latest startDate.
 *   4. If no non-side-venture role is active, fall back to the latest active
 *      role regardless of type (so founder-only periods still render something).
 *   5. If no active role exists at all, return null.
 */
export function getCurrentRole(data: CareerData): CareerPosition | null {
  const active = data.positions.filter((p) => p.endDate === null);
  if (active.length === 0) return null;

  const byLatestStart = (a: CareerPosition, b: CareerPosition) =>
    b.startDate.localeCompare(a.startDate);

  const primary = active
    .filter((p) => !SIDE_VENTURE_COMPANIES.has(p.company))
    .sort(byLatestStart)[0];

  if (primary) return primary;

  return active.slice().sort(byLatestStart)[0];
}

/** Short company-name accessor. Empty string if no current role is set. */
export function getCurrentEmployer(data: CareerData): string {
  return getCurrentRole(data)?.company ?? "";
}

/** Current employer's website URL, derived from companies.json (SSOT). */
export function getCurrentEmployerUrl(employerName: string): string {
  try {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const companiesPath = path.join(
      process.cwd(),
      "data",
      "sources",
      "knowledge",
      "career",
      "companies.json",
    );
    if (!fs.existsSync(companiesPath)) return "";
    const raw = JSON.parse(fs.readFileSync(companiesPath, "utf-8"));
    const entries = raw.data ?? raw;
    const list = Array.isArray(entries) ? entries : [entries];
    const match = list.find(
      (c: Record<string, unknown>) =>
        typeof c.name === "string" && c.name.toLowerCase() === employerName.toLowerCase(),
    );
    return (match?.website as string) ?? "";
  } catch {
    return "";
  }
}

/**
 * Third-person grounding sentence for chat few-shot examples.
 * Example: "Currently he's a Solutions Architect at Autonomize AI."
 * Returns a safe fallback if Paul has no current primary role.
 */
export function formatCurrentRoleSentence(data: CareerData): string {
  const role = getCurrentRole(data);
  if (!role) {
    return "A Principal AI Engineer & Architect with deep healthcare AI experience.";
  }
  return `Currently he's a ${role.title} at ${role.company}.`;
}

/**
 * Short hero-copy phrase: "Currently Solutions Architect at Autonomize AI."
 */
export function formatCurrentRoleHero(data: CareerData): string {
  const role = getCurrentRole(data);
  if (!role) {
    return "Currently exploring new opportunities in healthcare AI.";
  }
  return `Currently ${role.title} at ${role.company}.`;
}
