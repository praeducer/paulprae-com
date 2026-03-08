/**
 * Post-deployment smoke test — verifies the live site is healthy.
 *
 * Checks:
 *   1. Homepage returns 200 and contains expected content
 *   2. Resume MD download matches local hash
 *   3. PDF download returns 200 with correct content-type and reasonable size
 *   4. DOCX download returns 200 with correct content-type and reasonable size
 *   5. HTTP → HTTPS redirect works
 *   6. Security headers are present (HSTS, X-Frame-Options, etc.)
 *
 * Usage:
 *   npm run smoke                                  # Test against https://paulprae.com
 *   SMOKE_TEST_URL=https://example.com npm run smoke  # Test against custom URL
 *
 * Exit code:
 *   0  All checks passed
 *   1  One or more checks failed
 */

import crypto from "crypto";
import fs from "fs";
import { PATHS, RESUME_FILE_BASE } from "../lib/config";
import { isDirectRun } from "../lib/script-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SmokeResult {
  name: string;
  passed: boolean;
  detail: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.SMOKE_TEST_URL || "https://paulprae.com").replace(/\/$/, "");

/**
 * Vercel Deployment Protection bypass secret.
 * When set, all requests include x-vercel-protection-bypass header so CI
 * can smoke-test protected preview deployments. Set via
 * VERCEL_AUTOMATION_BYPASS_SECRET GitHub secret → deploy.yml env.
 * See: https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-for-automation
 */
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";

/** Retry delay for checks that may need CDN propagation time. */
const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 15_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // Inject bypass header when testing protected preview deployments
  if (VERCEL_BYPASS_SECRET) {
    const existing = (fetchOptions.headers as Record<string, string>) || {};
    fetchOptions.headers = { ...existing, "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET };
  }

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Checks ──────────────────────────────────────────────────────────────────

async function checkHomepage(): Promise<SmokeResult> {
  try {
    const res = await fetchWithTimeout(BASE_URL);
    if (!res.ok) {
      return {
        name: "Homepage",
        passed: false,
        detail: `HTTP ${res.status}`,
      };
    }
    const html = await res.text();
    const missing: string[] = [];
    if (!/Paul Prae/i.test(html)) missing.push("name");
    if (!/AI Career Assistant/i.test(html)) missing.push("chat interface");
    if (missing.length > 0) {
      return {
        name: "Homepage",
        passed: false,
        detail: `missing content: ${missing.join(", ")}`,
      };
    }
    return {
      name: "Homepage",
      passed: true,
      detail: `HTTP 200, content verified (${Math.round(html.length / 1024)} KB)`,
    };
  } catch (err) {
    return {
      name: "Homepage",
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checkResumeHash(): Promise<SmokeResult> {
  const localPath = PATHS.publicMd;
  if (!fs.existsSync(localPath)) {
    return {
      name: "Resume MD hash",
      passed: false,
      detail: `local file not found: ${localPath}`,
    };
  }

  const localContent = fs.readFileSync(localPath);
  const localHash = crypto.createHash("md5").update(localContent).digest("hex");

  // Retry to account for CDN propagation
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/${RESUME_FILE_BASE}.md`);
      if (!res.ok) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return {
          name: "Resume MD hash",
          passed: false,
          detail: `HTTP ${res.status}`,
        };
      }
      const remoteContent = Buffer.from(await res.arrayBuffer());
      const remoteHash = crypto.createHash("md5").update(remoteContent).digest("hex");

      if (localHash === remoteHash) {
        return {
          name: "Resume MD hash",
          passed: true,
          detail: `hashes match (${localHash.slice(0, 8)})`,
        };
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return {
        name: "Resume MD hash",
        passed: false,
        detail: `hash mismatch — local: ${localHash.slice(0, 8)}, live: ${remoteHash.slice(0, 8)}`,
      };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return {
        name: "Resume MD hash",
        passed: false,
        detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Unreachable, but TypeScript needs it
  return { name: "Resume MD hash", passed: false, detail: "unexpected error" };
}

async function checkDownload(
  label: string,
  filename: string,
  expectedContentType: string,
  minSizeKB: number,
): Promise<SmokeResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/${filename}`);
      if (!res.ok) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return {
          name: `${label} download`,
          passed: false,
          detail: `HTTP ${res.status}`,
        };
      }

      const contentType = res.headers.get("content-type") || "";
      const body = await res.arrayBuffer();
      const sizeKB = Math.round(body.byteLength / 1024);
      const issues: string[] = [];

      if (!contentType.includes(expectedContentType)) {
        issues.push(`content-type: ${contentType} (expected ${expectedContentType})`);
      }
      if (sizeKB < minSizeKB) {
        issues.push(`size: ${sizeKB} KB (expected >= ${minSizeKB} KB)`);
      }

      return {
        name: `${label} download`,
        passed: issues.length === 0,
        detail: issues.length === 0 ? `HTTP 200, ${sizeKB} KB, ${contentType}` : issues.join("; "),
      };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return {
        name: `${label} download`,
        passed: false,
        detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { name: `${label} download`, passed: false, detail: "unexpected error" };
}

async function checkHttpsRedirect(): Promise<SmokeResult> {
  const httpUrl = BASE_URL.replace("https://", "http://");
  try {
    const res = await fetchWithTimeout(httpUrl, { redirect: "manual" });
    const location = res.headers.get("location") || "";

    if (res.status >= 300 && res.status < 400 && location.startsWith("https://")) {
      return {
        name: "HTTPS redirect",
        passed: true,
        detail: `${res.status} → ${location}`,
      };
    }

    // Some hosts transparently upgrade without a redirect header
    if (res.ok) {
      return {
        name: "HTTPS redirect",
        passed: true,
        detail: "transparent upgrade (no redirect header)",
      };
    }

    return {
      name: "HTTPS redirect",
      passed: false,
      detail: `HTTP ${res.status}, location: ${location || "(none)"}`,
    };
  } catch (err) {
    return {
      name: "HTTPS redirect",
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checkSecurityHeaders(): Promise<SmokeResult> {
  try {
    const res = await fetchWithTimeout(BASE_URL);
    // HSTS is set by vercel.json but not injected on localhost or some preview URLs.
    // Only require it when testing against a real HTTPS deployment.
    const isLocal = BASE_URL.includes("localhost") || BASE_URL.includes("127.0.0.1");
    const required: { header: string; pattern?: RegExp }[] = [
      ...(!isLocal ? [{ header: "strict-transport-security", pattern: /max-age=\d+/ }] : []),
      { header: "x-frame-options" },
      { header: "x-content-type-options" },
      { header: "referrer-policy" },
      { header: "content-security-policy", pattern: /default-src/ },
    ];

    const missing: string[] = [];
    const present: string[] = [];

    for (const { header, pattern } of required) {
      const value = res.headers.get(header);
      if (!value) {
        missing.push(header);
      } else if (pattern && !pattern.test(value)) {
        missing.push(`${header} (invalid: ${value})`);
      } else {
        present.push(header);
      }
    }

    return {
      name: "Security headers",
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? `${present.length} headers verified`
          : `missing: ${missing.join(", ")}`,
    };
  } catch (err) {
    return {
      name: "Security headers",
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checkResumePage(): Promise<SmokeResult> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/resume`);
    if (!res.ok) {
      return { name: "Resume page", passed: false, detail: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const missing: string[] = [];
    if (!/Paul Prae/i.test(html)) missing.push("name");
    if (!/Professional Summary/i.test(html)) missing.push("summary section");
    if (missing.length > 0) {
      return {
        name: "Resume page",
        passed: false,
        detail: `missing content: ${missing.join(", ")}`,
      };
    }
    return {
      name: "Resume page",
      passed: true,
      detail: `HTTP 200, content verified (${Math.round(html.length / 1024)} KB)`,
    };
  } catch (err) {
    return {
      name: "Resume page",
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checkChatApiValidation(): Promise<SmokeResult> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      return {
        name: "Chat API validation",
        passed: true,
        detail: "400 on invalid input (expected)",
      };
    }
    return {
      name: "Chat API validation",
      passed: false,
      detail: `expected 400, got HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "Chat API validation",
      passed: false,
      detail: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log();
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│           Smoke Test                          │");
  console.log(`│  Target: ${BASE_URL.padEnd(35)} │`);
  console.log("└──────────────────────────────────────────────┘");
  console.log();

  // Wait for CDN propagation before starting checks
  const waitSeconds = parseInt(process.env.SMOKE_WAIT_SECONDS || "0", 10);
  if (waitSeconds > 0) {
    console.log(`  Waiting ${waitSeconds}s for CDN propagation...\n`);
    await sleep(waitSeconds * 1000);
  }

  const results: SmokeResult[] = await Promise.all([
    checkHomepage(),
    checkResumePage(),
    checkChatApiValidation(),
    checkResumeHash(),
    checkDownload("PDF", `${RESUME_FILE_BASE}.pdf`, "application/pdf", 10),
    checkDownload(
      "DOCX",
      `${RESUME_FILE_BASE}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      5,
    ),
    checkHttpsRedirect(),
    checkSecurityHeaders(),
  ]);

  // Report
  const maxName = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const color = r.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const name = r.name.padEnd(maxName);
    console.log(`  ${color}${icon}${reset}  ${name}  ${r.detail}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log();
  if (failed === 0) {
    console.log(`  \x1b[32m✓ All ${passed} smoke checks passed\x1b[0m`);
    console.log(`  ${BASE_URL} is healthy\n`);
  } else {
    console.log(`  \x1b[31m✗ ${failed} of ${passed + failed} smoke checks failed\x1b[0m`);
    console.log(`  ${BASE_URL} may have deployment issues\n`);
  }

  // GitHub Actions annotations
  if (process.env.GITHUB_ACTIONS) {
    for (const r of results) {
      if (!r.passed) {
        console.log(`::error::Smoke test failed: ${r.name} — ${r.detail}`);
      }
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (isDirectRun("smoke-test")) {
  main();
}

export const _testExports = {
  checkHomepage,
  checkResumePage,
  checkChatApiValidation,
  checkResumeHash,
  checkDownload,
  checkHttpsRedirect,
  checkSecurityHeaders,
  fetchWithTimeout,
  main,
};
