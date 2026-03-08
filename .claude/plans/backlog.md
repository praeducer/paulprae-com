# AI-Driven Backlog — paulprae.com

Actionable coding and documentation tasks for Claude Code. No human-only tasks here (those are in `human-tasks.md`).

> Last reconciled: 2026-03-08 against `feat/phase2-implementation` branch (pre-merge to main).

---

## Post-Merge Automation

- [ ] Bump `package.json` version to `2.0.0` after merging Phase 2 to main
- [ ] Add CI route validation — `test -d .next/server/app/resume` to verify specific routes exist in build output

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
4. **Verify prompt caching:** Already implemented. Check `cache_read_input_tokens` in generation telemetry to confirm it's working.

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
