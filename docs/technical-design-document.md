# Technical Design Document — paulprae.com

This document is the canonical technical narrative for the project.
It describes what exists today, why it is designed this way, and what changes are planned by phase.

## 1. Objectives

### Primary objective

Deliver a fast, shareable professional site at `https://paulprae.com` that presents a high-quality AI-generated resume and downloadable artifacts (PDF, DOCX, Markdown).

### Engineering objectives

- Keep Phase 1 simple, reproducible, and low-cost.
- Generate recruiter-facing artifacts from structured career data.
- Deploy as static output for predictable hosting behavior.
- Preserve clear migration paths for Phase 2 (interactive) and Phase 3 (graph/agent workflows).

## 2. Current Architecture (Phase 1)

### 2.1 Runtime model

- **Frontend:** Next.js App Router static site (`output: 'export'`)
- **Backend at request time:** none (no API routes, no SSR)
- **Build-time AI:** Claude API invoked locally by scripts
- **Hosting:** Vercel static hosting from `out/`

### 2.2 Core stack (implemented)

| Layer              | Technology                            |
| ------------------ | ------------------------------------- |
| Framework          | Next.js 16 + TypeScript               |
| Styling            | Tailwind CSS 4                        |
| Markdown rendering | `react-markdown` + `remark-gfm`       |
| AI generation      | `@anthropic-ai/sdk` (Claude Opus 4.6) |
| Validation         | Zod                                   |
| Testing            | Vitest                                |
| Export             | Pandoc (DOCX) + Typst (PDF)           |
| Deployment         | Vercel                                |

### 2.3 Constraints and guardrails

- Site must remain static-export compatible in Phase 1.
- No server runtime secrets are needed in Vercel for generation.
- Generated resume markdown is an artifact; source-of-truth logic is in generation scripts.
- Recruiter-facing data is versioned in git; raw LinkedIn exports remain local/gitignored.

## 3. Data and Content Architecture

### 3.1 Inputs

- LinkedIn CSV exports under `data/sources/linkedin/` (gitignored)
- Curated knowledge JSON under `data/sources/knowledge/` (committed)

### 3.2 Generated artifacts

- `data/generated/career-data.json` (normalized structured data)
- `data/generated/Paul-Prae-Resume.md` (AI-generated source resume)
- `public/Paul-Prae-Resume.{pdf,docx,md}` (served downloadable assets)

### 3.3 Data policy

- Do not model private/sensitive information that should not be public.
- Keep generated public-facing data portable and reproducible.
- Keep credentials/tokens out of repository content and docs.

## 4. Build and Generation Pipeline

Pipeline order:

1. `npm run ingest` -> parse CSV/knowledge inputs into `career-data.json`
2. `npm run generate` -> generate Markdown resume from structured data
3. `npm run export` -> produce PDF/DOCX artifacts from Markdown
4. `npm run build` -> static export into `out/`
5. push to `main` -> Vercel builds and deploys

Supporting commands:

- `npm run pipeline` for end-to-end execution
- `npm run pipeline:content` for AI generation only
- `npm run pipeline:render` for export/build from existing markdown
- `npm run brand` for OG image and favicon assets

## 5. Deployment and Domain Operations

### 5.1 Deployment source of truth

- Deployment behavior and commands are documented in `README.md`.

### 5.2 Domain and DNS source of truth

- DNS operations, verification, and rollback are documented in `domain-dns-runbook.md`.

### 5.3 Operational separation

- README: deployment workflow
- DNS runbook: domain records and propagation checks
- This document: architectural intent and system boundaries

## 6. Quality Strategy

### 6.1 Automated checks

- Pre-commit: `lint-staged` runs Prettier on staged files (via husky `prepare` hook — installs on `npm install`). Works cross-platform: WSL/Linux/macOS use `npx` directly; Windows Git clients (GitHub Desktop, VS Code) auto-delegate to WSL
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run test:pipeline` (validates generated outputs when available)

### 6.2 Manual checks

- Validate live routing and downloadable assets after deployment
- Spot-check generated resume quality for factual consistency and tone

## 7. Roadmap (Planned, Not Implemented)

### Phase 2

- Introduce server runtime and API routes
- Add recruiter chat and tailored resume generation
- Add Supabase + pgvector for retrieval workflows

### Phase 3

- Add Neo4j knowledge graph
- Add agent/tool orchestration for richer multi-step reasoning
- Add automation workflows for ingestion/enrichment

Active implementation tasks are tracked in `.claude/plans/backlog.md`.

## 8. Non-goals for Phase 1

- No auth-gated admin interface
- No production API routes
- No dynamic server-side personalization at request time
- No database dependency for current static-site operation

## 9. References

- `README.md` (setup, pipeline, deployment)
- `CLAUDE.md` (project memory and guardrails)
- `docs/domain-dns-runbook.md` (domain DNS operations)
- `docs/linux-dev-environment-setup.md` (Linux/WSL setup)
- `docs/windows-dev-environment-setup.md` (Windows setup)
- `docs/mcp-setup.md` (MCP configuration)
