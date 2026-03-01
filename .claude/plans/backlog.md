# AI Assistant Backlog — paulprae.com

Only actionable coding/documentation tasks belong here.

## Phase 1 Follow-ups (next)

- [ ] Add privacy-preserving analytics (Vercel Analytics or Plausible) with a short architecture note in `README.md`.
- [ ] Add a docs quality check script (local markdown links + required-doc ownership) and wire it into CI.
- [ ] Add CI workflow for `npm run lint`, `npm run format:check`, and `npm test`.
- [ ] Add a release checklist script/command for pipeline + verification before pushing to `main`.

## Pipeline Enhancements

- [ ] Add evaluation loop to resume generation (generate -> score -> revise with max retry count).
- [ ] Add tailored resume generation flags (`--job-url` and `--job-text`) with output `resume-tailored.{md,pdf,docx}`.
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file.
- [ ] Add A/B resume variant generation and comparison summary output.
- [ ] Add optional JSON Resume export from `career-data.json`.

## Phase 2 Preparation

- [ ] Introduce structured knowledge types and schema validation for future Supabase/Neo4j ingestion.
- [ ] Add knowledge-base audit tests in Vitest (schema validity, coverage, required fields).
- [ ] Add reusable UI component foundation for chat/resume tooling in `components/`.
- [ ] Add configurable knowledge path constants only when structured retrieval is implemented.

## MCP Expansion (when corresponding stack exists)

- [ ] Add Sentry MCP when production monitoring is enabled.
- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 2 is active.
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active.
- [ ] Evaluate `mcp-pandoc` when on-demand export is needed in chat workflows.
