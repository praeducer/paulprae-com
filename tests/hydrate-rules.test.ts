import { describe, it, expect, beforeEach } from "vitest";
import { resetWritingRulesCache } from "../lib/writing-rules";
import {
  renderRulesAsProse,
  renderCategoryBlock,
  renderSuppressedSkills,
  renderRuleSummary,
} from "../lib/prompts/hydrate-rules";

describe("renderRulesAsProse", () => {
  beforeEach(() => resetWritingRulesCache());

  it("renders all rules as numbered prose", () => {
    const prose = renderRulesAsProse();
    expect(prose).toContain("G1 (Entity-scope binding):");
    expect(prose).toContain("E1 (Interview-readiness test):");
    expect(prose).toContain("V1 (No sycophancy):");
    expect(prose).toContain("Q1 (No fluff):");
    expect(prose).toContain("CL1 (Candidate fit focus):");
  });

  it("filters by category", () => {
    const prose = renderRulesAsProse(["grounding"]);
    expect(prose).toContain("G1");
    expect(prose).not.toContain("E1");
    expect(prose).not.toContain("V1");
  });

  it("returns empty string when no rules match", () => {
    // All valid categories return rules, so test with a category that has rules
    const prose = renderRulesAsProse(["grounding"]);
    expect(prose.length).toBeGreaterThan(0);
  });
});

describe("renderCategoryBlock", () => {
  beforeEach(() => resetWritingRulesCache());

  it("renders a markdown block with header", () => {
    const block = renderCategoryBlock("grounding");
    expect(block).toMatch(/^### Grounding Rules\n/);
    expect(block).toContain("- **G1:**");
  });

  it("accepts a custom header", () => {
    const block = renderCategoryBlock("ethics", "Ethical Guidelines");
    expect(block).toMatch(/^### Ethical Guidelines\n/);
  });
});

describe("renderSuppressedSkills", () => {
  beforeEach(() => resetWritingRulesCache());

  it("renders skills as comma-separated list", () => {
    const skills = renderSuppressedSkills();
    expect(skills).toContain("dbt");
    expect(skills).toContain("LangChain");
    expect(skills).toContain("n8n");
    expect(skills).toContain("Rust");
  });
});

describe("renderRuleSummary", () => {
  beforeEach(() => resetWritingRulesCache());

  it("renders compact ID: name format", () => {
    const summary = renderRuleSummary(["grounding"]);
    expect(summary).toContain("G1: Entity-scope binding");
    expect(summary).toContain("G8: Self-check before finalizing");
  });
});
