# AI Assistant Backlog — paulprae.com

Only actionable coding/documentation tasks belong here.

## Phase 1 Follow-ups (next)

- [ ] Add privacy-preserving analytics (Vercel Analytics or Plausible) with a short architecture note in `README.md`.
- [ ] Add a docs quality check script (local markdown links + required-doc ownership) and wire it into CI.
- [ ] Add CI workflow for `npm run lint`, `npm run format:check`, and `npm test`.
- [ ] Add a release checklist script/command for pipeline + verification before pushing to `main`.

## Pipeline Enhancements

- [x] Add resume comparison and approval pipeline (`npm run compare`, `npm run approve`) — staging/approved decoupling with interactive CLI and optional LLM-as-judge scoring.
- [ ] Add tailored resume generation flags (`--job-url` and `--job-text`) with output `resume-tailored.{md,pdf,docx}`.
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file.
- [ ] Add optional JSON Resume export from `career-data.json`.

## Phase 2 Preparation

- [ ] Introduce structured knowledge types and schema validation for future Supabase/Neo4j ingestion.
- [ ] Add knowledge-base audit tests in Vitest (schema validity, coverage, required fields).
- [ ] Add reusable UI component foundation for chat/resume tooling in `components/`.
- [ ] Add configurable knowledge path constants only when structured retrieval is implemented.

## UX Enhancements (deferred from Phase 1 review)

- [ ] Add dark mode support — CSS-only `prefers-color-scheme` as quick-add, or full theme provider with localStorage toggle for Phase 2.
- [ ] Add professional headshot to header/OG image (requires obtaining a photo asset).
- [ ] Add highlight reel badges (e.g., "15+ Years", "Fortune 500", "50M+ Members") below the header — significant layout change better suited for Phase 2 component library.
- [ ] Add skill-tier visualization (chips, progress bars, or tag clouds) — advanced layout deferred; Phase 1 uses blank-line-separated categories.
- [ ] Add contact chips/badges styling (pill-shaped Email/LinkedIn/GitHub links) — nice-to-have lift for Phase 2 component system.
- [ ] Add `<time>` element wrapping for date patterns in resume body (e.g., "Sep 2025 – Present") — complex regex; consider as SEO micro-optimization.

## MCP Expansion (when corresponding stack exists)

- [ ] Add Sentry MCP when production monitoring is enabled.
- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 2 is active.
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active.
- [ ] Evaluate `mcp-pandoc` when on-demand export is needed in chat workflows.
