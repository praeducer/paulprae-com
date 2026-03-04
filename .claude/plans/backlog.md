# AI Assistant Backlog — paulprae.com

Only actionable coding/documentation tasks belong here.

> Last reconciled: 2026-03-04 against `feat/phase2-implementation` branch and `.claude/plans/phase2{a,b,c}-*.md`.

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

## Phase 2 Remaining (tracked in phase2a/2b/2c plans)

> These are NOT duplicated here — see the individual plan files for full details and status.
> Summary of what's left after Sprint 1:

- [ ] Agent tools: `get_resume_links`, `get_platform_constraints`, `generate_resume` (Plan 2A Step 6)
- [ ] `/api/resume` route for tailored resume generation with Opus 4.6 (Plan 2A Step 7)
- [ ] AI Gateway integration (Plan 2A Step 8)
- [ ] Prompt caching optimization with block-level cache control (Plan 2A Step 9)
- [ ] Unit tests for `lib/agent/context.ts`, API route, and ChatHome component (Plans 2A/2B)
- [ ] Platform-aware copy-to-clipboard in tools mode (Plan 2B)
- [ ] Character count display for tools mode (Plan 2B)
- [ ] Welcome message with suggested questions (Plan 2B)
- [ ] Delete dead `app/components/SectionNav.tsx` and `BackToTop.tsx` after move (Plan 2B)
- [ ] vercel.json, CI/CD, sitemap, documentation updates (Plan 2C — full plan)

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
