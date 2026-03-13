/**
 * constants.test.ts — Tests for shared constants (lib/constants.ts).
 *
 * Validates that all constants are defined, non-empty, and structurally
 * correct. These are contract tests — they catch accidental deletions or
 * misshapen values before they reach production.
 *
 * Run: npm test -- tests/constants.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  SITE_NAME,
  SITE_SUBTITLE,
  SITE_TAGLINE,
  SITE_URL,
  SITE_DOMAIN,
  SITE_DESCRIPTION,
  SITE_OG_DESCRIPTION,
  HERO_DESCRIPTION,
  YEARS_EXPERIENCE,
  BOOK_INTERVIEW_URL,
  GITHUB_URL,
  GITHUB_PROFILE_URL,
  RESUME_DOWNLOAD_PATHS,
  CHAT_MODEL_ID,
  CHAT_CONFIG,
  RESUME_GENERATION_CONFIG,
  MAX_MESSAGE_CHARS,
  CHAT_REQUEST_LIMITS,
  RATE_LIMIT_CONFIG,
  NAV_LINK_CLASS,
  CTA_BUTTON_CLASS,
  CONTACT_LINK_CLASS,
  FOOTER_LINK_CLASS,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
} from "../lib/constants";

// ─── Site Identity ──────────────────────────────────────────────────────────

describe("site identity constants", () => {
  it.each([
    ["SITE_NAME", SITE_NAME],
    ["SITE_SUBTITLE", SITE_SUBTITLE],
    ["SITE_TAGLINE", SITE_TAGLINE],
    ["SITE_DESCRIPTION", SITE_DESCRIPTION],
    ["SITE_OG_DESCRIPTION", SITE_OG_DESCRIPTION],
    ["HERO_DESCRIPTION", HERO_DESCRIPTION],
    ["YEARS_EXPERIENCE", YEARS_EXPERIENCE],
  ])("%s is a non-empty string", (_name, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("SITE_URL is valid HTTPS containing SITE_DOMAIN", () => {
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(SITE_DOMAIN).not.toContain("://");
    expect(SITE_URL).toContain(SITE_DOMAIN);
  });
});

// ─── External Links ─────────────────────────────────────────────────────────

describe("external link constants", () => {
  it("GITHUB_URL is a valid GitHub repo URL", () => {
    expect(GITHUB_URL).toMatch(/^https:\/\/github\.com\//);
  });

  it("GITHUB_PROFILE_URL is a valid GitHub profile URL", () => {
    expect(GITHUB_PROFILE_URL).toMatch(/^https:\/\/github\.com\//);
  });

  it("BOOK_INTERVIEW_URL is a valid HTTPS URL", () => {
    expect(BOOK_INTERVIEW_URL).toMatch(/^https:\/\//);
  });
});

// ─── Resume Downloads ───────────────────────────────────────────────────────

describe("RESUME_DOWNLOAD_PATHS", () => {
  it("has all expected format keys", () => {
    expect(RESUME_DOWNLOAD_PATHS).toHaveProperty("pdf");
    expect(RESUME_DOWNLOAD_PATHS).toHaveProperty("docx");
    expect(RESUME_DOWNLOAD_PATHS).toHaveProperty("md");
    expect(RESUME_DOWNLOAD_PATHS).toHaveProperty("web");
  });

  it("all paths start with /", () => {
    for (const [, value] of Object.entries(RESUME_DOWNLOAD_PATHS)) {
      expect(value).toMatch(/^\//);
    }
  });

  it("file download paths have correct extensions", () => {
    expect(RESUME_DOWNLOAD_PATHS.pdf).toMatch(/\.pdf$/);
    expect(RESUME_DOWNLOAD_PATHS.docx).toMatch(/\.docx$/);
    expect(RESUME_DOWNLOAD_PATHS.md).toMatch(/\.md$/);
  });

  it("web path is /resume", () => {
    expect(RESUME_DOWNLOAD_PATHS.web).toBe("/resume");
  });
});

// ─── Chat AI Configuration ──────────────────────────────────────────────────

describe("chat AI configuration", () => {
  it("CHAT_MODEL_ID is a non-empty string", () => {
    expect(typeof CHAT_MODEL_ID).toBe("string");
    expect(CHAT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("CHAT_CONFIG has valid numeric values", () => {
    expect(CHAT_CONFIG.maxOutputTokens).toBeGreaterThan(0);
    expect(CHAT_CONFIG.chatTemperature).toBeGreaterThanOrEqual(0);
    expect(CHAT_CONFIG.chatTemperature).toBeLessThanOrEqual(1);
    expect(CHAT_CONFIG.toolsTemperature).toBeGreaterThanOrEqual(0);
    expect(CHAT_CONFIG.toolsTemperature).toBeLessThanOrEqual(1);
  });

  it("RESUME_GENERATION_CONFIG has valid numeric values", () => {
    expect(RESUME_GENERATION_CONFIG.maxOutputTokens).toBeGreaterThan(0);
    expect(RESUME_GENERATION_CONFIG.temperature).toBeGreaterThanOrEqual(0);
    expect(RESUME_GENERATION_CONFIG.temperature).toBeLessThanOrEqual(1);
  });

  it("resume generation allows more tokens than chat", () => {
    expect(RESUME_GENERATION_CONFIG.maxOutputTokens).toBeGreaterThan(CHAT_CONFIG.maxOutputTokens);
  });
});

// ─── Input Limits ───────────────────────────────────────────────────────────

describe("input limits", () => {
  it("MAX_MESSAGE_CHARS is a positive number", () => {
    expect(MAX_MESSAGE_CHARS).toBeGreaterThan(0);
  });

  it("CHAT_REQUEST_LIMITS has all expected fields", () => {
    expect(CHAT_REQUEST_LIMITS.maxMessages).toBeGreaterThan(0);
    expect(CHAT_REQUEST_LIMITS.maxBodyBytes).toBeGreaterThan(0);
    expect(CHAT_REQUEST_LIMITS.maxJobDescriptionChars).toBeGreaterThan(0);
    expect(CHAT_REQUEST_LIMITS.maxEmphasisItems).toBeGreaterThan(0);
    expect(CHAT_REQUEST_LIMITS.maxEmphasisChars).toBeGreaterThan(0);
  });
});

// ─── Navigation Styles ─────────────────────────────────────────────────────

describe("navigation style constants", () => {
  it.each([
    ["NAV_LINK_CLASS", NAV_LINK_CLASS],
    ["CTA_BUTTON_CLASS", CTA_BUTTON_CLASS],
    ["CONTACT_LINK_CLASS", CONTACT_LINK_CLASS],
    ["FOOTER_LINK_CLASS", FOOTER_LINK_CLASS],
    ["BUTTON_PRIMARY_CLASS", BUTTON_PRIMARY_CLASS],
    ["BUTTON_SECONDARY_CLASS", BUTTON_SECONDARY_CLASS],
  ])("%s is a non-empty string", (_name, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });
});

// ─── Rate Limiting ──────────────────────────────────────────────────────────

describe("rate limit configuration", () => {
  it("has a positive window and max requests", () => {
    expect(RATE_LIMIT_CONFIG.windowMs).toBeGreaterThan(0);
    expect(RATE_LIMIT_CONFIG.maxRequests).toBeGreaterThan(0);
  });

  it("has a non-empty prefix", () => {
    expect(typeof RATE_LIMIT_CONFIG.prefix).toBe("string");
    expect(RATE_LIMIT_CONFIG.prefix.length).toBeGreaterThan(0);
  });
});
