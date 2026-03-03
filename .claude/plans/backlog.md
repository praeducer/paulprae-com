# AI Assistant Backlog — paulprae.com

Only actionable coding/documentation tasks belong here.

> Last reconciled: 2026-03-03 against local git history and current `main` working tree.

## Repository State (completed)

- [x] Merge PR #11 (`Claude/fix word formatting and improve sticky header layout`) into `main`.
- [x] Merge PR #12 (`fix: address Copilot review — safer DOCX repackaging and robust tests`) into `main`.
- [x] Delete stale remote branches: `claude/fix-word-formatting-aWxHa`, `claude/test-github-connection-tOmsE`, `fix/header-layout-nav-uat`, `fix/nav-buttons-layout-github`.
- [x] Delete stale local branches for the same remotes.
- [x] Delete no-op branch `claude/copilot-review-fixes-aWxHa` after confirming its tree was identical to `main` (no net file diff).
- [x] Confirm only `main` remains both locally and on `origin`.

## Branch Review Follow-ups (open)

- [ ] Add `github: z.string().optional()` to `CareerDataSchema` in `scripts/ingest-linkedin.ts` so runtime validation matches `CareerProfile`.
- [ ] Add targeted unit tests for `enrichProfileFromKnowledge` in `tests/ingest.test.ts` (linkedin/website/email/github enrichment).
- [x] Keep GitHub header link WCAG touch target compliant (`min-h-[44px]`) in `app/page.tsx` (verified on current `main`).

## Pipeline Enhancements

- [x] Add resume comparison and approval pipeline (`npm run compare`, `npm run approve`) with staging/approved decoupling.
- [ ] Add job description comparison CLI (`npm run compare:jobs`) with stakeholder persona voting and weighted scoring.
- [ ] Add tailored resume generation flags (`--job-url` and `--job-text`) with output `resume-tailored.{md,pdf,docx}`.
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file.
- [ ] Add optional JSON Resume export from `career-data.json`.

## Phase 2 Preparation

- [ ] Introduce structured knowledge types and schema validation for future Supabase/Neo4j ingestion.
- [ ] Add knowledge-base audit tests in Vitest (schema validity, coverage, required fields).
- [ ] Add reusable UI component foundation for chat/resume tooling in `components/`.
- [ ] Add configurable knowledge path constants only when structured retrieval is implemented.

## UX Enhancements (deferred from Phase 1 review)

- [x] Add dark mode support (CSS-only `prefers-color-scheme` + Tailwind `dark:` variants).
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
