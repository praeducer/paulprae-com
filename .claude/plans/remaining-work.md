# Remaining Work — Phase 2 Merge & Beyond

> **Status:** Phase 2 code complete (Sprint 1+2). Pending: human setup, live testing, merge.
> **Branch:** `feat/phase2-implementation` (337 tests, builds clean, lint/format pass)
> **PR:** #21 (DRAFT)

---

## Pre-Merge Checklist

These must be done before merging `feat/phase2-implementation` to `main`.

### Human Steps (manual)

- [x] Vercel Pro upgrade ($20/mo) — Fluid Compute enabled
- [x] `ANTHROPIC_API_KEY` set on Vercel (Production + Preview)
- [x] Anthropic spending limits configured
- [x] Vercel spending limits configured
- [ ] **Provision Upstash Redis** — create free DB at https://console.upstash.com, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel env vars. Without this, rate limiting uses a no-op fallback (safe but unprotected).
- [ ] **Live end-to-end test** — `npm run dev` with `ANTHROPIC_API_KEY` in `.env.local`:
  - [ ] `/` — chat renders, send a message, streaming response works
  - [ ] "Tailored resume" chip — triggers tool-calling, returns formatted resume
  - [ ] "Download resume" chip — returns download links
  - [ ] `/resume` — resume page renders with section nav and downloads
  - [ ] `/tools` — tools mode renders with 8 chips
  - [ ] Mobile responsive check (375px viewport)

### Merge Steps

- [ ] Run `npm run check` (full release checklist)
- [ ] Update PR #21 description for Sprint 2 scope
- [ ] Mark PR as ready for review (remove DRAFT)
- [ ] Merge to `main`

### Post-Merge

- [ ] Verify deploy workflow: CI → preview → smoke test (8/8) → promote → production smoke
- [ ] Post-deploy verification per `human-steps-phase2.md` Step 5
- [ ] Monitor costs for first few days (Vercel AI → Usage, Anthropic Console)

---

## Nice-to-Have Enhancements (not blocking merge)

These are improvements that can be done post-merge on separate branches.

### Tools Mode UX

- [ ] **Platform-aware copy-to-clipboard** — strip markdown for LinkedIn, separate subject/body for email, section-level copy for STAR answers. Use `ActionBarPrimitive` custom copy actions.
- [ ] **Character count display** — show real-time count sourced from `platform-constraints.json` when in `/tools` mode.

### Infrastructure Optimization

- [ ] **AI Gateway integration** — replace direct `@ai-sdk/anthropic` with `@ai-sdk/gateway` for unified observability and budget controls. Low priority — direct calls work fine.
- [ ] **Block-level prompt caching** — split system prompt into cacheable blocks with `providerOptions.anthropic.cacheControl`. Worth measuring actual cache hit rates first.
- [ ] **CI route validation** — add `test -d .next/server/app/resume` to CI to verify specific routes exist in build output.

### Pipeline Cost Optimization

- [ ] Reduce thinking effort from "max" to "high" (A/B test with `npm run compare --judge`)
- [ ] Try Sonnet 4.6 for pipeline generation (~10x cheaper than Opus)
- [ ] Reduce max_tokens from 128K to 16K
- [ ] Verify prompt caching via `cache_read_input_tokens` in telemetry

### Pending DNS

- [ ] Update DreamHost A record from `216.198.79.1` to `76.76.21.21` (low priority, carried from v2.1)

---

## Phase 3 Preview (Do Not Implement Yet)

- Neo4j AuraDB career knowledge graph
- Supabase PostgreSQL + pgvector for RAG
- Claude Agent SDK for multi-step reasoning
- n8n automation workflows
- Supabase Auth for admin-gated tools mode
