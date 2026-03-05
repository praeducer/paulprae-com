# Plan 2C: DevOps — CI/CD, Deployment Config, Documentation

> **Status:** COMPLETE ✅ (Sprint 2). All steps implemented and committed.
> **Sequence:** Plan 2A (backend) → Plan 2B (frontend) → Plan 2C (this)
> **Branch:** Continue on `feat/phase2-implementation` (no separate branch — keeps the merge atomic)
> **Depends on:** Plan 2A + 2B Sprint 1 (COMPLETE), Sprint 2+ (NOT started)
> **Blocks:** Nothing — final plan in sequence. Must be done BEFORE merging feature branch to main.
> **Human steps:** See `human-steps-phase2.md` Steps 1-4 (Vercel Pro, Upstash, AI Gateway, env vars)
> **Authoritative redesign plan:** `docs/phase2-redesign-plan.md`

---

## Phase 1 CI/CD Foundation (Already Working ✅)

These items were completed during v2.1 and do NOT need to be redone in Plan 2C:

- **GitHub secrets configured:** VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_AUTOMATION_BYPASS_SECRET, ANTHROPIC_API_KEY — all 5 set as repository secrets
- **Deploy workflow (deploy.yml) is working:** CI → preview → smoke test (6/6) → promote → production smoke — fully verified (all green as of 2026-03-04)
- **Production smoke wait:** 30s delay after promote for CDN cache invalidation (fixed from 15s, issue #24)
- **Vercel authentication bypass:** Protection Bypass for Automation configured; smoke test sends `x-vercel-protection-bypass` header automatically
- **`--scope` flag:** Both `vercel deploy` and `vercel promote` use `--scope="${VERCEL_ORG_ID}"` for correct team scoping
- **Pipeline workflow (pipeline.yml):** ANTHROPIC_API_KEY secret set; monthly cron + manual dispatch enabled
- **Git integration is OFF:** `vercel.json: git.deploymentEnabled: false` — all deploys go through GitHub Actions
- **Issue auto-creation on failure:** deploy.yml creates a GitHub issue with commit SHA, preview URL, and run link

Plan 2C only needs to UPDATE the existing working config for Phase 2 (remove static export, update smoke tests, update CSP, etc.), not set up CI/CD from scratch.

### Known Issue on Feature Branch

The feature branch CI currently fails at the "Validate build output" step:

```
test -f out/index.html  →  FAILS because Phase 2 uses .next/ not out/
```

This is expected and will be resolved by Step 3 of this plan.

### Claude Code Execution Notes

```
"Execute Plan 2C on feat/phase2-implementation: update vercel.json, next.config.ts, CI workflow,
smoke-test.ts, release-check.ts, sitemap, CLAUDE.md, README.md, and TDD. Run npm test after each
step. Commit after each step."
```

- This plan is mostly config/docs/script changes — lower risk than 2A/2B
- Run `npm test` after each step to catch regressions
- Run `npm run check` as final verification (after updating the check script itself)
- CLAUDE.md updates are critical — they affect all future Claude Code sessions

---

## Objective

Update all deployment configuration, CI/CD pipelines, smoke tests, security headers, and documentation to support the Phase 2 server-rendered Next.js app with:

- **`/`** — AI chat interface (dynamic, client component)
- **`/resume`** — Professional resume (static pre-render, server component)
- **`/api/chat`** — Streaming chat API (Vercel Fluid Compute, 800s max duration)
- **Vercel Fluid Compute** — Pro plan required for long-running AI responses

---

## Current State → Target State

| Config Area             | Phase 1 (Current on `main`)                     | Phase 2 (Target)                                  |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `next.config.ts`        | `output: 'export'` (static HTML)                | No output config (server-rendered)                |
| `vercel.json` framework | `"framework": null` (static)                    | Removed — Vercel auto-detects Next.js             |
| `vercel.json` output    | `"outputDirectory": "out"`                      | Removed — Vercel uses `.next/` default            |
| Build output            | `out/index.html` (single page)                  | `.next/` (server app with routes)                 |
| Routes                  | `/` (resume)                                    | `/` (chat), `/resume` (resume), `/api/chat`       |
| CI build validation     | `test -f out/index.html`                        | `test -d .next` + route validation                |
| Smoke test homepage     | Checks for "Paul Prae" + "Professional Summary" | Checks for chat UI markers                        |
| Smoke test resume       | N/A (was homepage)                              | New check on `/resume` for resume content         |
| CSP `connect-src`       | `'self'`                                        | `'self'` (sufficient for same-origin `/api/chat`) |

---

## Implementation Steps

### Step 1: Next.js Configuration (`next.config.ts`)

> **Note:** This change was already made on the feature branch in Sprint 1.
> Verify it's correct and no additional config is needed.

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 2: dynamic rendering enabled for API routes (/api/chat)
  // Resume page uses generateStaticParams for static pre-rendering
};

export default nextConfig;
```

**Key change:** Removing `output: 'export'` is the single most important Phase 2 config change. It enables:

- API routes (`app/api/chat/route.ts`)
- Dynamic server-side rendering
- Vercel Fluid Compute for long-running functions

**Verify:** Already done on feature branch. No additional action needed.

### Step 2: Vercel Configuration (`vercel.json`)

> **Critical:** The feature branch `vercel.json` currently still has `"framework": null"` and `"outputDirectory": "out"` — these are Phase 1 settings that conflict with the removed `output: 'export'`. This step fixes that.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  },
  "buildCommand": "npm run build",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

**Changes from Phase 1:**

| Change                                       | Reason                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| Remove `"framework": null`                   | Let Vercel auto-detect Next.js for proper server-rendered builds          |
| Remove `"outputDirectory": "out"`            | Vercel uses `.next/` by default for Next.js apps                          |
| Keep `"git": { "deploymentEnabled": false }` | All deploys still go through GitHub Actions                               |
| Keep `"buildCommand": "npm run build"`       | Same build command works for both phases                                  |
| Add `/api/*` header block                    | `Cache-Control: no-store` prevents CDN caching of AI responses            |
| Keep `connect-src 'self'` as-is              | `'self'` already covers same-origin `/api/chat` calls — no changes needed |

**Why NOT add `https://paulprae.com` to `connect-src`:** The `'self'` directive matches the origin of the page. Since the chat page and API are on the same origin, `'self'` already permits the connection. Adding the full URL is redundant.

### Step 3: CI Workflow Updates (`.github/workflows/ci.yml`)

Update the build output validation step:

**Before (Phase 1):**

```yaml
- name: Validate build output
  run: test -f out/index.html || { echo "::error::out/index.html not found"; exit 1; }
```

**After (Phase 2):**

```yaml
- name: Validate build output
  run: |
    test -d .next || { echo "::error::.next/ directory not found"; exit 1; }
    # Verify resume page was pre-rendered (static optimization)
    test -f .next/server/app/resume.html || echo "::warning::resume.html not pre-rendered"
```

**What stays the same:** All other CI steps (checkout, setup-node, npm ci, validate:docs, lint, format, test, build, check:quick) are unchanged.

### Step 4: Smoke Test Updates (`scripts/smoke-test.ts`)

This is the most critical deployment-pipeline change. The current 6 smoke checks need updating because `/` is now a chat interface, not a resume page.

**Current checks → Phase 2 updates:**

| #   | Current Check                                                | Phase 2 Change                                                                      |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | Homepage: HTTP 200, has "Paul Prae" + "Professional Summary" | **Split:** Homepage checks for chat UI markers; new Resume check for resume content |
| 2   | Resume MD hash: matches local file                           | **Unchanged** — download URL path is the same                                       |
| 3   | PDF download: 200, correct content-type, ≥10 KB              | **Unchanged**                                                                       |
| 4   | DOCX download: 200, correct content-type, ≥5 KB              | **Unchanged**                                                                       |
| 5   | HTTPS redirect                                               | **Unchanged**                                                                       |
| 6   | Security headers: 5 headers verified                         | **Unchanged**                                                                       |

**New check architecture (7 checks):**

```typescript
// Check 1: Chat homepage — verify the chat interface loads
async function checkChatHomepage(): Promise<SmokeResult> {
  const res = await fetchWithTimeout(BASE_URL);
  if (!res.ok) return { name: "Chat homepage", passed: false, detail: `HTTP ${res.status}` };
  const html = await res.text();
  const markers = [
    { label: "page title", pattern: /Paul Prae/i },
    { label: "chat UI", pattern: /Ask About Paul|chat|assistant/i },
    { label: "meta description", pattern: /<meta[^>]*description/i },
  ];
  // ... validate markers
}

// Check 2: Resume page — verify resume content on /resume
async function checkResumePage(): Promise<SmokeResult> {
  const res = await fetchWithTimeout(`${BASE_URL}/resume`);
  if (!res.ok) return { name: "Resume page", passed: false, detail: `HTTP ${res.status}` };
  const html = await res.text();
  const markers = [
    { label: "name", pattern: /Paul Prae/i },
    { label: "Professional Summary", pattern: /Professional Summary/i },
    { label: "download link", pattern: /\.pdf/i },
  ];
  // ... validate markers
}

// Checks 3-7: Resume MD hash, PDF download, DOCX download, HTTPS redirect, Security headers
// (unchanged from current implementation)
```

**Key decisions:**

- Chat homepage markers are intentionally loose (`chat|assistant`) to avoid coupling smoke tests to specific UI text
- Resume page check uses the SAME markers as the current homepage check — just against `/resume`
- Download URLs don't change — PDFs are still served from `public/` at the root
- **New: `/api/chat` validation smoke check** — POST with empty JSON body `{}` to `/api/chat` and assert HTTP 400 response. This proves the Vercel function deployed and is running without burning Anthropic API tokens (the route validates input before calling the LLM).

### Step 5: Release Check Script Updates (`scripts/release-check.ts`)

Update `checkBuildOutput()` for Phase 2's `.next/` output:

**Before (Phase 1):**

```typescript
function checkBuildOutput(): CheckResult {
  const indexPath = path.join(ROOT, "out", "index.html");
  // Checks: file exists, size > 10KB, content markers (Paul Prae, Professional Summary, .pdf, meta description)
}
```

**After (Phase 2):**

```typescript
function checkBuildOutput(): CheckResult {
  const nextDir = path.join(ROOT, ".next");
  const issues: string[] = [];

  if (!fs.existsSync(nextDir)) {
    issues.push(".next/ directory not found (run build first)");
  } else {
    // Verify resume page was pre-rendered (static optimization)
    const resumePath = path.join(nextDir, "server", "app", "resume.html");
    if (!fileExists(resumePath)) {
      issues.push("resume.html not pre-rendered");
    } else {
      const html = fs.readFileSync(resumePath, "utf-8");
      const markers = [
        { label: "name", pattern: /Paul Prae/i },
        { label: "Professional Summary", pattern: /Professional Summary/i },
        { label: "download link", pattern: /\.pdf/i },
      ];
      for (const marker of markers) {
        if (!marker.pattern.test(html)) {
          issues.push(`missing in resume: ${marker.label}`);
        }
      }
    }
  }
  // ...
}
```

**What stays the same:**

- `checkDataFiles()` — unchanged (career-data.json + resume.md)
- `checkResumeQuality()` — unchanged (reads from approved resume markdown)
- `checkPublicDownloads()` — unchanged (PDF/DOCX/MD hash sync)
- `checkLint()`, `checkFormat()`, `checkTests()`, `checkDocs()` — unchanged

### Step 6: Sitemap Update (`public/sitemap.xml`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://paulprae.com/</loc>
    <lastmod>2026-03-XX</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://paulprae.com/resume</loc>
    <lastmod>2026-03-XX</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

**Changes:** Add `/resume` route. Update `lastmod` dates to reflect Phase 2 deploy date. No changes to `robots.txt` — default behavior is correct.

### Step 7: Documentation Updates

#### Already Completed ✅ (done during v2.1 sessions)

These doc updates were made on `main` and are already synced to the feature branch:

| File               | Change                                                                               | Status  |
| ------------------ | ------------------------------------------------------------------------------------ | ------- |
| CLAUDE.md          | Phase 2 status, test count (315+), new dependencies, env vars, human steps reference | ✅ Done |
| .env.local.example | Phase 2 runtime env vars (Upstash, AI Gateway)                                       | ✅ Done |
| README.md          | Test count (315+), deployment section rewritten for GitHub Actions CI/CD             | ✅ Done |
| CONTRIBUTING.md    | Test count (315+)                                                                    | ✅ Done |

#### Still Needed (do during Plan 2C execution)

**CLAUDE.md additional changes:**

| Section           | Change                                                                          |
| ----------------- | ------------------------------------------------------------------------------- |
| Tech Stack        | Add: AI SDK 6, @ai-sdk/anthropic, @assistant-ui/react, @upstash/redis           |
| File Organization | Add `lib/agent/`, `lib/prompts/`, `app/api/`, `app/resume/`                     |
| Critical Rules #2 | Remove static export rule; note resume page is still statically optimized       |
| Critical Rules #3 | Move AI SDK from "do NOT install" to tech stack; keep Supabase/Neo4j as Phase 3 |
| Common Commands   | Add `npm run dev` for chat testing                                              |

**README.md additional changes:**

| Section      | Change                                                     |
| ------------ | ---------------------------------------------------------- |
| Architecture | Add server-side architecture (API routes + Fluid Compute)  |
| Tech Stack   | Add AI SDK 6, @assistant-ui/react, Upstash Redis           |
| Routes       | Document `/` (chat), `/resume` (resume), `/api/chat` (API) |

**Technical Design Document (`docs/technical-design-document.md`):**

| Section        | Change                                                  |
| -------------- | ------------------------------------------------------- |
| §3.1 Routes    | `/chat` → `/` for chat, add `/resume` for resume        |
| §3.2 Stack     | `@vercel/kv` → `@upstash/redis`                         |
| §3.8 Client    | `useChat` → `@assistant-ui/react` with `useChatRuntime` |
| §3.9 Structure | `packages/` → `lib/` flat structure                     |
| Stack table    | Add `@assistant-ui/react`                               |

### Step 8: CORS and Security Verification

- **CSP `connect-src 'self'`** already allows same-origin API calls — no changes needed
- **API routes validate** `Content-Type: application/json` in route.ts (already implemented in Sprint 1)
- **Rate limiting** via Upstash Redis protects against abuse (graceful fallback when env vars absent)
- **No CORS headers needed** — chat page and API are same-origin
- **`/api/*` headers** add `Cache-Control: no-store` (Step 2) — prevents CDN caching AI responses
- **Vercel Speed Insights:** Monitor `va.vercel-scripts.com` 503 errors (observed in Phase 1 QA; see `human-steps.md`)

---

## Merge & Deploy Strategy

The Phase 2 merge is a coordinated transition — both CI/CD and application code change simultaneously.

### Approach: Atomic Merge

All Plan 2C changes are committed on the feature branch alongside the Sprint 1 code. The PR merges everything at once. This works because:

1. **CI runs against the branch** — the updated `ci.yml` validates `.next/` on the feature branch (fixes the known CI failure)
2. **Deploy workflow triggers after merge** — by the time `deploy.yml` runs on main, the smoke test code is already updated
3. **No intermediate broken state** — there's no window where old smoke tests run against new code

### Pre-Merge Checklist

Before merging `feat/phase2-implementation` → `main`:

- [ ] All Plan 2C steps completed and committed on feature branch
- [ ] `npm run build` succeeds (`.next/` output, not `out/`)
- [ ] `npm test` — all tests pass
- [ ] `npm run lint && npm run format:check` — clean
- [ ] `npm run check` — release checklist passes (with updated Phase 2 checks)
- [ ] Human steps 1-4 completed (Vercel Pro, Upstash, AI Gateway, env vars)
- [ ] `ANTHROPIC_API_KEY` set as Vercel environment variable (not just GitHub secret)
- [ ] PR #21 reviewed and approved

### Post-Merge Deploy Sequence

After merge to main:

1. **CI workflow triggers** → lint, format, test, build (validates `.next/`), check
2. **Deploy workflow triggers** (on CI success):
   - `vercel deploy` → preview URL (Vercel auto-detects Next.js → server-rendered build)
   - Preview smoke test (7 checks): chat homepage, resume page, downloads, HTTPS, headers
   - `vercel promote` → production
   - Production smoke test (30s wait → 7 checks)
3. **Human step 5** → Post-deploy verification (see `human-steps-phase2.md`)

### Rollback Plan

If the deploy fails after merge:

1. Production is untouched until smoke tests pass (preview → smoke → promote pattern)
2. If preview smoke fails: production stays on Phase 1 — investigate and fix on the feature branch
3. If production smoke fails after promote: revert the merge commit on main → CI/Deploy re-runs with Phase 1 code
4. Manual fallback: `npx vercel rollback --yes --scope="${VERCEL_ORG_ID}" --token="${VERCEL_TOKEN}"`

---

## Verification Checklist

- [ ] `npm run build` succeeds with `.next/` output
- [ ] `npm test` — all tests pass
- [ ] `npm run lint && npm run format:check` — clean
- [ ] `npm run check` — full release checklist passes (updated for Phase 2)
- [ ] CI workflow passes on feature branch (validates `.next/`, not `out/`)
- [ ] Vercel preview deployment works (both `/` and `/resume`)
- [ ] Chat homepage (`/`) loads with mode toggle and quick actions
- [ ] Resume page (`/resume`) renders with downloads and navigation
- [ ] API route responds correctly (`/api/chat` POST returns stream)
- [ ] CSP headers don't block chat API calls
- [ ] `/api/*` responses have `Cache-Control: no-store`
- [ ] Sitemap includes both routes
- [ ] All documentation is consistent and accurate
- [ ] Smoke tests pass against preview deployment (7/7)

---

## What This Plan Does NOT Cover

- Agent core logic (Plan 2A — Sprint 1 COMPLETE)
- API route implementation (Plan 2A — Sprint 1 COMPLETE)
- Chat UI components (Plan 2B — Sprint 1 COMPLETE)
- Agent tools, `/api/resume` route, AI Gateway integration (Plan 2A — Sprint 2+)
- Platform-aware copy, character count, welcome message (Plan 2B — Sprint 2+)
- Component/API route tests (Plans 2A/2B — Sprint 2+)
- Supabase/pgvector (Phase 3)
- Neo4j knowledge graph (Phase 3)
