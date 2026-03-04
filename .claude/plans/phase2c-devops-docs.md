# Plan 2C: DevOps — CI/CD, Deployment Config, Documentation

> **Sequence:** Plan 2A (backend) → Plan 2B (frontend) → Plan 2C (this)
> **Branch:** `feat/phase2c-devops` from `feat/phase2b-frontend` (or `main` after 2B merges)
> **Depends on:** Plan 2A (knows what env vars, routes exist), Plan 2B (knows all pages/routes)
> **Blocks:** Nothing — final plan in sequence
> **Human steps:** See `human-steps-phase2.md` Steps 5-6 (env vars, post-deploy verification)

### Claude Code Execution Notes

This plan is optimized for autonomous execution by Claude Code:

```
"Execute Plan 2C: create feat/phase2c-devops branch, update vercel.json, update CI workflow,
update release-check script, update CLAUDE.md, README.md, and TDD. Run npm run check to verify."
```

- This plan is mostly config/docs changes — lower risk than 2A/2B
- Run `npm run check` (full release checklist) as final verification
- CLAUDE.md updates are critical — they affect all future Claude Code sessions
- After merging, human must do Steps 5-6 (Vercel dashboard config)

---

## Objective

Update all deployment configuration, CI/CD pipelines, security headers, and documentation to support the Phase 2 server-rendered Next.js app with API routes, chat page, and Vercel Fluid Compute.

---

## Implementation Steps

### Step 1: Vercel Configuration (`vercel.json`)

Major changes required now that the site is server-rendered:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
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
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://paulprae.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
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

**Key changes from Phase 1:**

- **Remove** `"framework": null` — let Vercel auto-detect Next.js (required for serverless functions)
- **Remove** `"outputDirectory": "out"` — Vercel manages `.next/` output
- **Remove** `"git": { "deploymentEnabled": false }` — re-enable Git-triggered deploys (or keep manual if preferred)
- **Update** CSP `connect-src` to allow `'self'` API calls from the chat page
- **Add** `/api/*` headers: `Cache-Control: no-store` to prevent caching of AI responses

### Step 2: Environment Variables on Vercel

Configure in Vercel dashboard (Settings → Environment Variables):

| Variable             | Environments        | Purpose                                  |
| -------------------- | ------------------- | ---------------------------------------- |
| `ANTHROPIC_API_KEY`  | Production, Preview | Claude API access for chat/resume routes |
| `AI_GATEWAY_API_KEY` | Production, Preview | Vercel AI Gateway (optional)             |
| `KV_REST_API_URL`    | Production, Preview | Upstash KV for rate limiting             |
| `KV_REST_API_TOKEN`  | Production, Preview | Upstash KV auth token                    |

**Security:** These are server-side only (used in API routes, never exposed to client). Vercel encrypts them at rest.

**Upstash setup:** Create a free Upstash Redis instance at upstash.com, or provision via Vercel's KV integration (Vercel Dashboard → Storage → Create → KV). The Vercel integration auto-populates `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

### Step 3: CI/CD Pipeline Updates (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Validate documentation
        run: npm run validate:docs

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Validate data and resume quality
        run: npm run check:quick -- --ci

      - name: Validate build output
        run: |
          # Phase 2: Next.js server build outputs to .next/, not out/
          test -d .next || { echo "::error::.next/ directory not found"; exit 1; }
          # Verify static pages were pre-rendered
          test -f .next/server/app/index.html || echo "::warning::index.html not pre-rendered (may be dynamic)"
```

**Key change:** Build output validation switches from `out/index.html` to `.next/` directory. The resume page should still be statically pre-rendered by Next.js even without `output: 'export'`.

### Step 4: Deployment Workflow (`.github/workflows/deploy.yml`)

If the deploy workflow references static output, update it similarly. The Vercel GitHub integration handles deployment automatically — the workflow may only need to run smoke tests after deploy.

### Step 5: Release Check Script Updates

Update `scripts/release-check.ts`:

- Change build output validation from `out/` to `.next/`
- Add check for required environment variables in Vercel (can verify via `vercel env ls` or skip in CI)
- Add check that `/api/chat` route exists in the build output

### Step 6: Documentation Updates

#### CLAUDE.md Changes

| Section           | Change                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| Project Overview  | Update phase to "Phase 2 — Interactive Career Platform"                          |
| Tech Stack        | Add: AI SDK 6, @ai-sdk/anthropic, @ai-sdk/react, @ai-sdk/gateway                 |
| File Organization | Add `packages/`, `app/chat/`, `app/api/` directories                             |
| Critical Rules #2 | Remove static export rule, note that resume page is still statically optimized   |
| Critical Rules #3 | Move AI SDK from "do NOT install" to tech stack. Keep Supabase/Neo4j as Phase 3. |
| Data Pipeline     | Add note about API routes using career data at runtime                           |
| Common Commands   | Add `npm run dev` chat testing instructions                                      |
| Phase 2 Preview   | Convert to "Phase 2 (Current)" with implemented features                         |
| Phase 3 Preview   | Keep as-is                                                                       |

#### README.md Changes

| Section           | Change                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Overview          | Update Phase 2 from "planned" to "current"                               |
| Architecture      | Add server-side architecture diagram (API routes + Vercel Fluid Compute) |
| Tech Stack        | Add AI SDK 6, Vercel AI Gateway                                          |
| Getting Started   | Add `ANTHROPIC_API_KEY` needed for Vercel (not just local pipeline)      |
| Deployment        | Update for server-rendered deployment (no more `framework: null`)        |
| Project Structure | Add `packages/`, `app/chat/`, `app/api/`                                 |

#### Technical Design Document (`docs/technical-design-document.md`)

Full rewrite of sections 2, 7, 8 to reflect Phase 2 architecture. See separate TDD update (being done alongside this plan).

#### New Documentation

| File                         | Content                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/agent-architecture.md` | Agent system design: context caching, model routing, tool use, ToolLoopAgent pattern, cost analysis |

### Step 7: CORS and Security

- Verify CSP `connect-src` allows API calls from the same origin
- API routes should validate `Content-Type: application/json`
- Rate limiting protects against abuse (implemented in Plan 2A)
- No CORS headers needed (same-origin API calls)

---

## Verification Checklist

- [ ] `npm run build` succeeds with new config
- [ ] `npm test` — all tests pass
- [ ] `npm run lint && npm run format:check` — clean
- [ ] `npm run check` — full release checklist passes
- [ ] Vercel preview deployment works (both `/` and `/chat`)
- [ ] Resume page (`/`) still renders correctly and is statically optimized
- [ ] Chat page (`/chat`) works in preview deploy
- [ ] API routes respond correctly in preview deploy
- [ ] CSP headers don't block chat API calls
- [ ] Smoke tests pass against preview URL
- [ ] All documentation is consistent and accurate

---

## Post-Merge: Vercel Dashboard Setup

Manual steps after merging to `main`:

1. Add environment variables (ANTHROPIC*API_KEY, KV*\*, optionally AI_GATEWAY_API_KEY)
2. Provision Upstash KV via Vercel Storage integration
3. Verify Vercel auto-detects Next.js framework (should happen automatically)
4. Run smoke test against production URL
5. Monitor first few chat conversations for cost/performance

---

## What This Plan Does NOT Cover

- Agent core logic (Plan 2A)
- API route implementation (Plan 2A)
- Chat UI components (Plan 2B)
- Supabase/pgvector (Phase 3)
- Neo4j knowledge graph (Phase 3)
