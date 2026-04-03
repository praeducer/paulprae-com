# AI-Driven Backlog — paulprae.com

Actionable coding and documentation tasks for Claude Code. No human-only tasks here (those are in `human-tasks.md`).

> Last reconciled: 2026-04-03 against `feat/interview-booking-cta` (PR #28 — MERGED ✅)

---

## Post-Merge Automation

- [ ] Bump `package.json` version to `2.0.0` after merging PR #28 to main (currently `0.1.0`)
- [ ] Add CI route validation — `test -d .next/server/app/resume` to verify specific routes exist in build output

## Observability

- [ ] **Confirm cache 1h vs 5m TTL** — `[chat] cache_tokens: ephemeral_1h/5m` always show `"n/a"` because `providerMetadata.anthropic.usage` doesn't include those fields in AI SDK 3.0.58. Two options: (1) upgrade `@ai-sdk/anthropic` to `3.0.66` which may expose them, or (2) check Anthropic Console directly for "Cache Write (1h)" vs "Cache Write (5m)" bucket breakdown. If 1h is confirmed, cron at 55 min is correct. If only 5m, increase cron frequency (see below).
- [ ] **Cron frequency if 1h TTL not working** — If Anthropic Console confirms only 5m cache writes, change `vercel.json` cron from `*/55 * * * *` to `*/4 * * * *`. Note: 4-min cron with 5m TTL costs ~$4/hour in cache writes; only viable if 1h TTL is definitively broken and cannot be fixed.
- [ ] **Upgrade `@ai-sdk/anthropic`** from `3.0.58` to latest stable (`3.0.66`) — may fix 1h TTL serialization and expose `ephemeral_1h_input_tokens` in usage metadata

## Pipeline Enhancements

- [ ] Add job description comparison CLI (`npm run compare:jobs`) with stakeholder persona voting and weighted scoring
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file
- [ ] Add optional JSON Resume export from `career-data.json`

## Cost Optimization

Current generation cost: ~$2.90 per run (Claude Opus 4.6, max effort, ~453s).

Options to evaluate in order:

1. **Reduce thinking effort from "max" to "high":** May save 30-50% on output tokens. Run A/B comparison with `npm run compare --judge` to measure quality delta.
2. **Try Sonnet 4.6 instead of Opus 4.6:** ~10x cheaper. Run A/B comparison. If quality is within 5%, switch default to Sonnet and reserve Opus for final/production generations.
3. **Reduce max_tokens from 128K to 16K:** The resume is ~8K chars. 128K is excessive headroom.
4. **Prompt caching:** Implemented and confirmed working — `cache_read: 73,923` tokens on every warm request. 1-hour TTL intent present; see Observability backlog for TTL confirmation steps.

Acceptance criteria: quality score must stay >=395 for any optimization to be accepted.

## UX Enhancements

- [ ] Platform-aware copy-to-clipboard in tools mode
- [ ] Character count display for tools mode
- [ ] Add highlight reel badges below the header (defer to Phase 3 component work)
- [ ] Add skill-tier visualization (chips/progress bars/tag clouds; currently plain grouped lists)
- [ ] Add contact chips/badges styling for Email/LinkedIn/GitHub links
- [ ] Add `<time>` element wrapping for date ranges in resume body (SEO micro-optimization)

## MCP Expansion (when corresponding stack exists)

- [ ] Add Sentry MCP when production monitoring is enabled
- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 3 is active
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active
- [ ] Evaluate `mcp-pandoc` when on-demand export is needed in chat workflows
