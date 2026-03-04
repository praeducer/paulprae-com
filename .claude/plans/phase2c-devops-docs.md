# Plan 2C: DevOps — CI/CD, Deployment Config, Documentation

> **Status:** NOT STARTED. Blocked on Plan 2A/2B Sprint 2 completion.
> **Sequence:** Plan 2A (backend) → Plan 2B (frontend) → Plan 2C (this)
> **Branch:** `feat/phase2c-devops` (or continue on `feat/phase2-implementation`)
> **Depends on:** Plan 2A + 2B (needs to know all routes, env vars, dependencies)
> **Blocks:** Nothing — final plan in sequence
> **Human steps:** See `human-steps-phase2.md` Steps 5-6 (env vars, post-deploy verification)
> **Authoritative redesign plan:** `docs/phase2-redesign-plan.md`

### Claude Code Execution Notes

```
"Execute Plan 2C: update vercel.json, CI workflow, release-check script, CLAUDE.md, README.md,
and TDD. Run npm run check to verify. Commit after each step."
```

- This plan is mostly config/docs changes — lower risk than 2A/2B
- Run `npm run check` (full release checklist) as final verification
- CLAUDE.md updates are critical — they affect all future Claude Code sessions

---

## Objective

Update all deployment configuration, CI/CD pipelines, security headers, and documentation to support the Phase 2 server-rendered Next.js app with API routes, chat homepage (`/`), resume page (`/resume`), and Vercel Fluid Compute.

---

## Implementation Steps

### Step 1: Vercel Configuration (`vercel.json`)

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

- **Remove** `"framework": null` — let Vercel auto-detect Next.js
- **Remove** `"outputDirectory": "out"` — Vercel manages `.next/` output
- **Update** CSP `connect-src` to allow `'self'` API calls from the chat page
- **Add** `/api/*` headers: `Cache-Control: no-store` to prevent caching of AI responses

### Step 2: Environment Variables on Vercel

Configure in Vercel dashboard (Settings → Environment Variables):

| Variable                   | Environments        | Purpose                          |
| -------------------------- | ------------------- | -------------------------------- |
| `ANTHROPIC_API_KEY`        | Production, Preview | Claude API access for chat route |
| `AI_GATEWAY_API_KEY`       | Production, Preview | Vercel AI Gateway (optional)     |
| `UPSTASH_REDIS_REST_URL`   | Production, Preview | Upstash Redis for rate limiting  |
| `UPSTASH_REDIS_REST_TOKEN` | Production, Preview | Upstash Redis auth token         |

> **Changed from original plan:** Env vars are `UPSTASH_REDIS_REST_*` (not `KV_REST_API_*`). No `@vercel/kv` — uses `@upstash/redis` directly.

### Step 3: CI/CD Pipeline Updates (`.github/workflows/ci.yml`)

Key changes:

- Build output validation: `.next/` directory (not `out/`)
- Validate routes: `/`, `/resume`, `/api/chat` all present in build output
- No changes to test/lint/format steps

```yaml
- name: Validate build output
  run: |
    test -d .next || { echo "::error::.next/ directory not found"; exit 1; }
    # Verify resume page was pre-rendered
    test -f .next/server/app/resume.html || echo "::warning::resume.html not pre-rendered"
```

### Step 4: Release Check Script Updates

Update `scripts/release-check.ts`:

- Change build output validation from `out/` to `.next/`
- Add check that `/api/chat` route exists
- Verify both `/` and `/resume` routes are present

### Step 5: Sitemap and Robots

Update `public/sitemap.xml`:

```xml
<url><loc>https://paulprae.com/</loc></url>
<url><loc>https://paulprae.com/resume</loc></url>
```

### Step 6: Documentation Updates

#### CLAUDE.md Changes

| Section           | Change                                                                          |
| ----------------- | ------------------------------------------------------------------------------- |
| Project Overview  | Update phase to "Phase 2 — Interactive Career Platform"                         |
| Tech Stack        | Add: AI SDK 6, @ai-sdk/anthropic, @assistant-ui/react, @upstash/redis           |
| File Organization | Add `lib/agent/`, `lib/prompts/`, `app/api/`, `app/resume/`                     |
| Critical Rules #2 | Remove static export rule. Note: resume page is still statically optimized      |
| Critical Rules #3 | Move AI SDK from "do NOT install" to tech stack. Keep Supabase/Neo4j as Phase 3 |
| Common Commands   | Add `npm run dev` for chat testing                                              |
| Phase 2 Preview   | Convert to "Phase 2 (Current)" with implemented features                        |

#### README.md Changes

| Section      | Change                                                     |
| ------------ | ---------------------------------------------------------- |
| Overview     | Update Phase 2 from "planned" to "current"                 |
| Architecture | Add server-side architecture (API routes + Fluid Compute)  |
| Tech Stack   | Add AI SDK 6, @assistant-ui/react, Upstash Redis           |
| Routes       | Document `/` (chat), `/resume` (resume), `/api/chat` (API) |
| Deployment   | Update for server-rendered deployment                      |

#### Technical Design Document (`docs/technical-design-document.md`)

Key updates needed:

- §3.1: `/chat` → `/` for chat, add `/resume` for resume
- §3.2: `@vercel/kv` → `@upstash/redis`
- §3.8 Client: `useChat` → `@assistant-ui/react` with `useChatRuntime`
- §3.9: `packages/` → `lib/` flat structure
- Add `@assistant-ui/react` to stack table

### Step 7: CORS and Security

- Verify CSP `connect-src` allows same-origin API calls
- API routes validate `Content-Type: application/json`
- Rate limiting via Upstash protects against abuse
- No CORS headers needed (same-origin)

---

## Verification Checklist

- [ ] `npm run build` succeeds with new config
- [ ] `npm test` — all tests pass
- [ ] `npm run lint && npm run format:check` — clean
- [ ] `npm run check` — full release checklist passes
- [ ] Vercel preview deployment works (both `/` and `/resume`)
- [ ] Chat homepage (`/`) works in preview deploy
- [ ] Resume page (`/resume`) renders correctly
- [ ] API routes respond correctly in preview deploy
- [ ] CSP headers don't block chat API calls
- [ ] Sitemap includes both routes
- [ ] All documentation is consistent and accurate

---

## What This Plan Does NOT Cover

- Agent core logic (Plan 2A — Sprint 1 COMPLETE)
- API route implementation (Plan 2A — Sprint 1 COMPLETE)
- Chat UI components (Plan 2B — Sprint 1 COMPLETE)
- Supabase/pgvector (Phase 3)
- Neo4j knowledge graph (Phase 3)
