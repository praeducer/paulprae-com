import { describe, it, expect, beforeEach } from "vitest";
import {
  loadWritingRules,
  resetWritingRulesCache,
  getRulesFor,
  getAllRules,
  getSuppressedSkills,
  getRulesPayload,
  getRuleById,
} from "../lib/writing-rules";

describe("writing-rules typed loader", () => {
  beforeEach(() => {
    resetWritingRulesCache();
  });

  it("loads writing-rules.json successfully", () => {
    const rules = loadWritingRules();
    expect(rules).not.toBeNull();
    expect(rules?.version).toBe("1.0");
  });

  it("caches the result on second call", () => {
    const first = loadWritingRules();
    const second = loadWritingRules();
    expect(first).toBe(second); // same object reference
  });

  it("has all 5 rule categories", () => {
    const rules = loadWritingRules();
    expect(rules?.rules).toBeDefined();
    expect(Object.keys(rules!.rules)).toEqual(
      expect.arrayContaining(["grounding", "ethics", "voice", "quality", "cover_letter"]),
    );
  });
});

describe("getRulesFor", () => {
  beforeEach(() => resetWritingRulesCache());

  it("returns grounding rules with G-prefixed IDs", () => {
    const grounding = getRulesFor("grounding");
    expect(grounding.length).toBeGreaterThanOrEqual(8);
    expect(grounding.every((r) => r.id.startsWith("G"))).toBe(true);
  });

  it("returns ethics rules with E-prefixed IDs", () => {
    const ethics = getRulesFor("ethics");
    expect(ethics.length).toBeGreaterThanOrEqual(6);
    expect(ethics.every((r) => r.id.startsWith("E"))).toBe(true);
  });

  it("returns voice rules with V-prefixed IDs", () => {
    const voice = getRulesFor("voice");
    expect(voice.length).toBeGreaterThanOrEqual(8);
    expect(voice.every((r) => r.id.startsWith("V"))).toBe(true);
  });

  it("returns quality rules with Q-prefixed IDs", () => {
    const quality = getRulesFor("quality");
    expect(quality.length).toBeGreaterThanOrEqual(6);
    expect(quality.every((r) => r.id.startsWith("Q"))).toBe(true);
  });

  it("returns cover letter rules with CL-prefixed IDs", () => {
    const cl = getRulesFor("cover_letter");
    expect(cl.length).toBeGreaterThanOrEqual(5);
    expect(cl.every((r) => r.id.startsWith("CL"))).toBe(true);
  });
});

describe("getAllRules", () => {
  beforeEach(() => resetWritingRulesCache());

  it("returns all rules across all categories", () => {
    const all = getAllRules();
    // G8 + E6 + V8 + Q6 + CL5 = 33 minimum
    expect(all.length).toBeGreaterThanOrEqual(33);
  });

  it("filters by category when specified", () => {
    const subset = getAllRules(["grounding", "ethics"]);
    expect(subset.every((r) => r.id.startsWith("G") || r.id.startsWith("E"))).toBe(true);
  });

  it("every rule has id, name, and rule fields", () => {
    const all = getAllRules();
    for (const rule of all) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.rule).toBeTruthy();
    }
  });
});

describe("getSuppressedSkills", () => {
  beforeEach(() => resetWritingRulesCache());

  it("returns the suppressed skills list", () => {
    const skills = getSuppressedSkills();
    expect(skills).toContain("dbt");
    expect(skills).toContain("LangChain");
    expect(skills).toContain("n8n");
    expect(skills).toContain("Rust");
  });

  it("returns exactly 4 suppressed skills", () => {
    expect(getSuppressedSkills()).toHaveLength(4);
  });
});

describe("getRulesPayload", () => {
  beforeEach(() => resetWritingRulesCache());

  it("returns the full rules object for LLM injection", () => {
    const payload = getRulesPayload();
    expect(payload).not.toBeNull();
    expect(payload?.rules).toBeDefined();
    expect(payload?.suppress_from_output).toBeDefined();
    expect(payload?.source_references).toBeDefined();
  });
});

describe("getRuleById", () => {
  beforeEach(() => resetWritingRulesCache());

  it("finds G1 by ID", () => {
    const rule = getRuleById("G1");
    expect(rule).toBeDefined();
    expect(rule?.name).toBe("Entity-scope binding");
  });

  it("finds CL5 by ID", () => {
    const rule = getRuleById("CL5");
    expect(rule).toBeDefined();
    expect(rule?.name).toBe("Human-written feel");
  });

  it("returns undefined for non-existent ID", () => {
    expect(getRuleById("Z99")).toBeUndefined();
  });
});
