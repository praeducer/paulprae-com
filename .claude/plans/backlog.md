# AI Assistant Backlog — paulprae.com

Only actionable coding/documentation tasks belong here.

> Last reconciled: 2026-03-04 against `feat/phase2-implementation` branch (Sprint 2 + hardening complete, 341 unit + 11 E2E tests).

## Pipeline Enhancements

- [ ] Add job description comparison CLI (`npm run compare:jobs`) with stakeholder persona voting and weighted scoring.
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file.
- [ ] Add optional JSON Resume export from `career-data.json`.

## Cost Optimization (moved from iterative-dev-qa.md Round 4)

Current generation cost: ~$2.90 per run (Claude Opus 4.6, max effort, ~453s).

Options to evaluate in order:

1. **Reduce thinking effort from "max" to "high":** May save 30-50% on output tokens. Run A/B comparison with `npm run compare --judge` to measure quality delta.
2. **Try Sonnet 4.6 instead of Opus 4.6:** ~10x cheaper. Run A/B comparison. If quality is within 5%, switch default to Sonnet and reserve Opus for final/production generations.
3. **Reduce max_tokens from 128K to 16K:** The resume is ~8K chars. 128K is excessive headroom. Even 16K provides 2x the needed space.
4. **Verify prompt caching:** Already implemented. Check `cache_read_input_tokens` in generation telemetry to confirm it's working.

Acceptance criteria: quality score must stay ≥395 for any optimization to be accepted.

## Phase 2 Remaining (low priority / nice-to-have)

- [x] ~~AI Gateway integration~~ — `@ai-sdk/gateway` with direct Anthropic fallback for local dev
- [x] ~~Block-level prompt caching~~ — implemented via `providerOptions.anthropic.cacheControl` on chat route
- [ ] Platform-aware copy-to-clipboard in tools mode (Plan 2B)
- [ ] Character count display for tools mode (Plan 2B)

## Phase 2 Completed (Sprint 2 + Hardening)

- [x] Agent tools: `generate_tailored_resume`, `get_resume_links` in `/api/chat` (Plan 2A Step 6)
- [x] Resume generator system prompt + PromptMode extension (Plan 2A)
- [x] Welcome message enhancement with recruiter value proposition (Plan 2B)
- [x] "Tailored resume" quick action chip (Plan 2B)
- [x] Component/API tests: context, QuickActions, ChatHome, chat-api (Plans 2A/2B)
- [x] Dead component cleanup: SectionNav, BackToTop, ModeToggle (Plan 2B)
- [x] vercel.json: remove static export config, add API headers + CSP (Plan 2C)
- [x] CI workflow: validate .next/BUILD_ID (Plan 2C)
- [x] Smoke tests: resume page + chat API validation checks (Plan 2C)
- [x] Release check: .next/BUILD_ID output (Plan 2C)
- [x] Sitemap: add /resume route (Plan 2C)
- [x] Documentation: CLAUDE.md, README, TDD updates (Plan 2C)
- [x] Chat API hardening: JSON parse safety, 100KB body limit, 50 msg limit (GPT-5.3 review)
- [x] Anthropic prompt caching on chat/resume-generator routes (GPT-5.3 review)
- [x] Stale static export references removed from docs (GPT-5.3 review)
- [x] Legacy out/ test block removed (GPT-5.3 review)
- [x] CHANGELOG.md + SECURITY.md added (GPT-5.3 review)
- [x] Playwright E2E tests: 11 smoke tests (GPT-5.3 review + user request)

## UX Enhancements (deferred from Phase 1 review)

- [ ] Add professional headshot to header/OG image (requires obtaining a photo asset).
- [ ] Add highlight reel badges below the header (defer to Phase 2 component work).
- [ ] Add skill-tier visualization (chips/progress bars/tag clouds; currently plain grouped lists).
- [ ] Add contact chips/badges styling for Email/LinkedIn/GitHub links.
- [ ] Add `<time>` element wrapping for date ranges in resume body as optional SEO micro-optimization.

## MCP Expansion (when corresponding stack exists)

- [ ] Add Sentry MCP when production monitoring is enabled.
- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 3 is active.
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active.
- [ ] Evaluate `mcp-pandoc` when on-demand export is needed in chat workflows.
