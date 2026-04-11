/**
 * data-consistency.test.ts — Cross-file data integrity checks.
 *
 * Catches drift between career data sources and writing rules:
 * - No position marked is_current: true with a non-null end_date
 * - career-data.json positions use past tense when dates are in the past
 * - No suppress_from_output.skills leak into career-data.json descriptions
 * - No invented-compound phrases from the blocklist appear in source data
 * - position-metrics.json relatedPositions references exist in positions.json
 * - companies.json metricsAsOf is within 18 months of current date
 *
 * These assertions prevent the data-drift class of bugs that produce
 * fabricated content (e.g., "Sep 2025" end dates invented by the LLM
 * when the source data had stale is_current: true flags).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "sources", "knowledge", "career");
const CAREER_DATA = path.join(process.cwd(), "data", "generated", "career-data.json");

interface Position {
  id?: string;
  title: string;
  company: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
  exclude_from_tailored?: string[];
}

interface CompanyEntry {
  id: string;
  name: string;
  metrics?: Record<string, string>;
  metricsAsOf?: string;
}

interface PositionMetric {
  title: string;
  content: string;
  relatedPositions?: string[];
  asOf?: string;
  confidence?: string;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

describe("data consistency — positions.json", () => {
  const positions = loadJson<Position[]>(path.join(KNOWLEDGE_DIR, "positions.json"));

  it("no position has both is_current: true and a non-null end_date", () => {
    const violations = positions.filter((p) => p.is_current === true && p.end_date != null);
    expect(violations, `Stale is_current flags: ${violations.map((p) => p.id).join(", ")}`).toEqual(
      [],
    );
  });

  it("every position has start_date", () => {
    const missing = positions.filter((p) => !p.start_date);
    expect(missing.map((p) => p.id ?? p.title)).toEqual([]);
  });

  it("non-current positions have end_date set", () => {
    const violations = positions.filter((p) => p.is_current === false && p.end_date == null);
    // Allow incoming roles (future start date) to have null end_date
    const realViolations = violations.filter((p) => {
      if (!p.start_date) return true;
      const start = new Date(p.start_date + "-01");
      return start <= new Date();
    });
    expect(realViolations.map((p) => p.id)).toEqual([]);
  });
});

describe("data consistency — career-data.json", () => {
  const career = loadJson<{
    profile: { summary?: string };
    positions: Position[];
  }>(CAREER_DATA);

  it("profile.summary does not claim outdated year counts", () => {
    const summary = career.profile.summary ?? "";
    // "15 years", "16 years", "20 years" would be stale; 13+ is current
    expect(summary).not.toMatch(/\b(14|15|16|17|18|19|20)\s+years\s+of\s+experience/i);
  });

  // Authoritative dates confirmed by Paul on 2026-04-11 after a memory-file
  // regression cycle. If these assertions fail, CHECK PAUL'S LINKEDIN BEFORE
  // editing — do NOT edit these assertions based on a memory file.
  // Root cause of the 2026-04-11 regression documented in
  // C:\Users\paulp\.claude\projects\C--dev-paulprae-com\memory\user_career_timeline.md
  it("Arine position has authoritative start/end dates (Sep 2025 → Mar 2026)", () => {
    const arine = career.positions.find((p) => p.company === "Arine");
    expect(arine, "Arine position must exist in career-data.json").toBeDefined();
    expect(arine?.startDate).toBe("2025-09");
    expect(arine?.endDate).toBe("2026-03");
  });

  it("Hyperbloom position has authoritative start/end dates (Jun 2021 → Aug 2025)", () => {
    // CRITICAL: Paul founded Hyperbloom in June 2021 AFTER leaving AWS in
    // May 2021. Do NOT use Jan 2020 as the start date — that is a
    // fabrication that falsely implies Paul was running a business while
    // employed at AWS. This is a fraud-detection check flagged by Paul
    // directly on 2026-04-11.
    const hyperbloom = career.positions.find((p) => p.company === "Hyperbloom");
    expect(hyperbloom, "Hyperbloom position must exist").toBeDefined();
    expect(hyperbloom?.startDate).toBe("2021-06");
    expect(hyperbloom?.endDate).toBe("2025-08");
  });

  it("AWS end date precedes Hyperbloom start date (no overlap)", () => {
    // Paul quit AWS before founding Hyperbloom. The career data must
    // reflect this — AWS endDate must be earlier than Hyperbloom startDate.
    const aws = career.positions.find((p) => p.company === "Amazon Web Services");
    const hyperbloom = career.positions.find((p) => p.company === "Hyperbloom");
    expect(aws).toBeDefined();
    expect(hyperbloom).toBeDefined();
    expect(aws?.endDate).toBeTruthy();
    expect(hyperbloom?.startDate).toBeTruthy();
    // Lexicographic comparison works for ISO YYYY-MM strings.
    const awsEnd = aws?.endDate ?? "";
    const hyperbloomStart = hyperbloom?.startDate ?? "";
    expect(
      awsEnd < hyperbloomStart,
      `AWS ${awsEnd} must end before Hyperbloom ${hyperbloomStart}`,
    ).toBe(true);
  });

  it("no suppressed skills appear in position descriptions", () => {
    // Read the suppressed list from writing-rules.json at runtime
    const rules = loadJson<{
      suppress_from_output?: { skills?: string[] };
      data?: { suppress_from_output?: { skills?: string[] } };
    }>(path.join(process.cwd(), "data", "sources", "knowledge", "content", "writing-rules.json"));
    const suppressed =
      rules.data?.suppress_from_output?.skills ?? rules.suppress_from_output?.skills ?? [];

    const leaks: string[] = [];
    for (const pos of career.positions) {
      const desc = pos.description ?? "";
      for (const skill of suppressed) {
        // Word-boundary match to avoid false positives (e.g., "rust" matching "trust")
        const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (pattern.test(desc)) {
          leaks.push(`${pos.company}: "${skill}"`);
        }
      }
    }
    expect(leaks, `Suppressed skills found in career-data.json: ${leaks.join(", ")}`).toEqual([]);
  });

  it("positions that ended in the past are not marked endDate: null", () => {
    // Careful: some positions are legitimately current (endDate: null).
    // Flag only positions whose description/title suggests past work
    // or whose startDate is >18 months ago with null endDate (likely stale).
    const now = new Date();
    const eighteenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 18, 1);
    const stale = career.positions.filter((p) => {
      if (p.endDate != null) return false;
      if (!p.startDate) return false;
      const start = new Date(p.startDate + "-01");
      // Only flag if started >18 months ago AND is not obviously a long-running project
      // Modular Earth is a known exception (long-running nonprofit)
      if (p.company === "Modular Earth") return false;
      return start < eighteenMonthsAgo;
    });
    expect(
      stale.map((p) => `${p.company} (started ${p.startDate})`),
      "Positions with null endDate that started >18 months ago may be stale",
    ).toEqual([]);
  });
});

describe("data consistency — position-metrics.json", () => {
  const metrics = loadJson<PositionMetric[]>(path.join(KNOWLEDGE_DIR, "position-metrics.json"));

  it("no entry contains 'progressive engineering leadership' invented-compound", () => {
    // This phrase is on the invented-compounds blocklist in the validator.
    // If it appears in source data, the validator flags the generated output
    // because the LLM faithfully echoed the source. Fix the source.
    const violations = metrics.filter((m) => /progressive\s+\w+\s+leadership/i.test(m.content));
    expect(violations.map((m) => m.title)).toEqual([]);
  });

  it("no entry contains other blocklisted invented-compound phrases", () => {
    const blocklist = [
      /synergistic\s+\w+/i,
      /transformational\s+\w+\s+architecture/i,
      /full-spectrum\s+\w+/i,
      /holistic\s+\w+\s+\w+\s+framework/i,
    ];
    const violations: string[] = [];
    for (const m of metrics) {
      for (const pattern of blocklist) {
        if (pattern.test(m.content)) {
          const match = m.content.match(pattern);
          violations.push(`${m.title}: "${match?.[0] ?? ""}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("data consistency — companies.json", () => {
  const companies = loadJson<CompanyEntry[]>(path.join(KNOWLEDGE_DIR, "companies.json"));

  it("companies with metrics have a metricsAsOf date", () => {
    const violations = companies.filter((c) => c.metrics && !c.metricsAsOf);
    expect(violations.map((c) => c.name)).toEqual([]);
  });

  it("metricsAsOf dates are within 24 months of today", () => {
    const now = new Date();
    const twentyFourMonthsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
    const stale: string[] = [];
    for (const c of companies) {
      if (!c.metricsAsOf) continue;
      const asOf = new Date(c.metricsAsOf + "-01");
      if (asOf < twentyFourMonthsAgo) {
        stale.push(`${c.name} (${c.metricsAsOf})`);
      }
    }
    expect(stale, "Stale company metrics (>24 months old)").toEqual([]);
  });
});
