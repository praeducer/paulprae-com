# Remaining Work — Phase 2 Merge & Beyond

> **Status:** Phase 2 code complete (Sprint 1+2 + hardening + security). Ready for live testing and merge.
> **Branch:** `feat/phase2-implementation` (360 unit tests + 11 E2E, builds clean, lint/format pass)
> **PR:** #21 (DRAFT)

---

## Pre-Merge Checklist

### Human Steps (all critical infra complete)

- [x] Vercel Pro upgrade ($20/mo) — Fluid Compute enabled
- [x] `ANTHROPIC_API_KEY` set on Vercel (Production + Preview)
- [x] Anthropic spending limits configured
- [x] Vercel spending limits configured
- [x] Upstash Redis provisioned — `upstash-kv-redis-rest-paulprae-com` via Vercel KV integration. Rate limiting verified: 20 req/min/IP with 429 responses
- [x] AI Gateway configured — enabled on Vercel project, OIDC auth active. Provides observability, budget controls, model routing
- [ ] **Live end-to-end test** — `npm run dev` with `ANTHROPIC_API_KEY` in `.env.local`:
  - [ ] `/` — chat renders, send a message, streaming response works
  - [ ] "Tailored resume" chip — triggers tool-calling, returns formatted resume
  - [ ] "Download resume" chip — returns download links
  - [ ] `/resume` — resume page renders with section nav and downloads
  - [ ] `/tools` — tools mode renders with 8 chips
  - [ ] Mobile responsive check (375px viewport)

### Merge Steps

- [ ] Run `npm run check` (full release checklist)
- [ ] Tag current `main` as `v1.0.0` before merge (Phase 1 milestone)
- [ ] Update PR #21 description for full Phase 2 scope
- [ ] Mark PR as ready for review (remove DRAFT)
- [ ] Merge to `main`

### Post-Merge

- [ ] Verify deploy workflow: CI → preview → smoke test → promote → production smoke
- [ ] Post-deploy verification per `human-steps-phase2.md` Step 5
- [ ] Verify AI Gateway logs calls in Vercel dashboard → AI → Gateway
- [ ] Monitor costs for first few days (Vercel AI → Usage, Anthropic Console)
- [ ] Update `package.json` version to `2.0.0`

---

## Completed (Security + Hardening Pass)

- [x] Chat API hardened — JSON parse try-catch, 100KB body limit, 50 message limit
- [x] Anthropic prompt caching enabled (`providerOptions.anthropic.cacheControl`)
- [x] Stale static export references removed from docs/devops.md, TDD, commands
- [x] Legacy `out/` test block removed from pipeline.test.ts
- [x] CHANGELOG.md and SECURITY.md added
- [x] Playwright E2E tests (11 tests: pages, navigation, API, chat interaction)
- [x] Chat API tests expanded (3 → 14 cases)
- [x] Origin validation middleware — CORS blocking for unauthorized domains
- [x] In-memory rate limiter fallback — fail-safe when Redis unavailable
- [x] Per-message content validation (4K chars) + total input budget
- [x] Content-Type enforcement (415 for non-JSON)
- [x] Prompt injection defenses (S1-S5) in all system prompts
- [x] XML delimiters in tool-calling for untrusted input isolation
- [x] Zod schema limits on tool inputs
- [x] Character counter in chat composer (appears at 75% of limit)
- [x] Upstash Redis integration (KV*REST_API*_ + UPSTASH*REDIS_REST*_ support)
- [x] AI Gateway integration — `@ai-sdk/gateway` with direct Anthropic fallback
- [x] Security headers in middleware (works in dev + production)
- [x] QA fixes: aria-label, canonical URL, node prop leak, poweredByHeader

---

## Nice-to-Have Enhancements (not blocking merge)

### Tools Mode UX

- [ ] **Platform-aware copy-to-clipboard** — strip markdown for LinkedIn, separate subject/body for email
- [ ] **Character count display** — show real-time count sourced from `platform-constraints.json` in `/tools` mode

### Infrastructure

- [ ] **CI route validation** — add `test -d .next/server/app/resume` to verify specific routes exist in build output

### Pipeline Cost Optimization

- [ ] Reduce thinking effort from "max" to "high" (A/B test with `npm run compare --judge`)
- [ ] Try Sonnet 4.6 for pipeline generation (~10x cheaper than Opus)
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
