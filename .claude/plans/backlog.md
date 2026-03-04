# AI Assistant Backlog — paulprae.com

Only actionable coding/documentation tasks belong here.

> Last reconciled: 2026-03-04 against `main` and `.claude/plans/phase2{a,b,c}-*.md`.

## Pipeline Enhancements

- [ ] Add job description comparison CLI (`npm run compare:jobs`) with stakeholder persona voting and weighted scoring.
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file.
- [ ] Add optional JSON Resume export from `career-data.json`.

> **Moved to phase2a-backend-agent-api.md:** Tailored resume generation (`--job-url`, `--job-text`) — now part of the agent's `generateResume()` + CLI flags.

## Phase 2 Preparation

- [ ] Add reusable UI component foundation for chat/resume tooling in `components/`.
- [ ] Add configurable knowledge path constants only when structured retrieval is implemented.

> **Moved to phase2a-backend-agent-api.md:** Knowledge schema standardization, knowledge-base audit tests.

## UX Enhancements (deferred from Phase 1 review)

- [ ] Add professional headshot to header/OG image (requires obtaining a photo asset).
- [ ] Add highlight reel badges below the header (defer to Phase 2 component work).
- [ ] Add skill-tier visualization (chips/progress bars/tag clouds; currently plain grouped lists).
- [ ] Add contact chips/badges styling for Email/LinkedIn/GitHub links.
- [ ] Add `<time>` element wrapping for date ranges in resume body as optional SEO micro-optimization.

## MCP Expansion (when corresponding stack exists)

- [ ] Add Sentry MCP when production monitoring is enabled.
- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 2 is active.
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active.
- [ ] Evaluate `mcp-pandoc` when on-demand export is needed in chat workflows.
