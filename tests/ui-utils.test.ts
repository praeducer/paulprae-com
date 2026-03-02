import { describe, it, expect } from "vitest";
import { slugify } from "../lib/ui-utils";

describe("slugify", () => {
  it("converts basic text to lowercase slug", () => {
    expect(slugify("Professional Experience")).toBe("professional-experience");
  });

  it("handles special characters", () => {
    expect(slugify("Skills & Technologies")).toBe("skills-technologies");
  });

  it("collapses multiple non-alphanumeric characters into single hyphen", () => {
    expect(slugify("Education --- Certifications")).toBe("education-certifications");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("handles single word", () => {
    expect(slugify("Summary")).toBe("summary");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("handles numbers", () => {
    expect(slugify("Phase 2 Planning")).toBe("phase-2-planning");
  });

  it("handles all-special-characters input", () => {
    expect(slugify("@#$%")).toBe("");
  });
});
