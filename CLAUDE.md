# CLAUDE.md — Project Memory for Claude Code

## Project Overview

**paulprae.com** is an AI-powered career platform that positions Paul Prae as a Principal AI Engineer & Architect. The site generates professional resumes from structured career data using Claude AI, serves them as a responsive static site, and will evolve into an interactive platform with AI chat and dynamic resume generation.

**Current Phase:** Phase 1 — AI-Generated Static Resume
**Repository:** github.com/praeducer/paulprae-com
**Live URL:** paulprae-com-one.vercel.app (custom domain: paulprae.com — DNS pending)

## Tech Stack (Phase 1)

See [README.md](README.md#tech-stack) for the full tech stack. Key versions: Next.js 16.1.x, Tailwind CSS 4.x, Vitest 4.x, ESLint 9, Prettier 3.x. AI generation via `@anthropic-ai/sdk` (Claude Opus 4.6). Resume export via Pandoc + Typst (system binaries).

## Key Conventions

- **App Router** — all routes use the `app/` directory (not `pages/`)
- **Server components by default** — only use `"use client"` when client interactivity is required
- **TypeScript strict mode** — no `any` types, strict null checks enabled
- **Static export** — `output: 'export'` in next.config.ts. No API routes, no SSR in Phase 1
- **Tailwind CSS only** — no CSS modules, no styled-components
- **Single-page site** — Phase 1 is one page (app/page.tsx) rendering the generated resume

## File Organization

```
app/                   → Next.js App Router pages and layouts
data/sources/linkedin/ → LinkedIn CSV exports (gitignored — raw exports may contain unparsed columns)
data/sources/knowledge/→ Knowledge base JSONs (committed — recruiter-facing content for Phase 2 RAG)
data/generated/        → Pipeline outputs: career-data.json + Paul-Prae-Resume.md (committed), PDF + DOCX (gitignored)
scripts/               → Pipeline scripts (ingest, generate, export) + resume-pdf.typ stylesheet
lib/                   → Shared utilities: config.ts, types.ts, markdown.ts
tests/                 → Unit and integration tests (Vitest)
public/                → Static assets + resume downloads (PDF, DOCX, MD committed for Vercel)
docs/                  → Technical documentation (TDD, dev environment setup, MCP)
.mcp.json              → MCP config for Claude Code (project root; see docs/mcp-setup.md)
.cursor/mcp.json       → MCP config for Cursor (same sources as .mcp.json)
```

## Critical Rules

1. **data/generated/Paul-Prae-Resume.md is GENERATED** — To change resume output, edit `scripts/generate-resume.ts` (the prompt, formatting instructions, or data processing). Never edit the resume markdown directly — it gets overwritten by the pipeline. The filename is derived from `career-data.json` (profile.name → "Paul-Prae-Resume").

2. **Static export mode** — Phase 1 uses `output: 'export'`. This means:
   - No API routes (`app/api/` will not work)
   - No server-side rendering at request time
   - No middleware
   - All data must be available at build time

3. **Minimal dependencies for Phase 1** — Do NOT install:
   - shadcn/ui (not needed for a single static page)
   - Supabase or @supabase/ssr (Phase 2)
   - Vercel AI SDK or @ai-sdk/anthropic (Phase 2)
   - Any database drivers or ORMs

4. **Environment variables** — `ANTHROPIC_API_KEY` in `.env.local` (never committed). Used only by build scripts, not by the Next.js runtime.

5. **Data committal policy** — All pipeline data is recruiter-facing content, so most is committed to git for portability across machines. Only LinkedIn CSV raw exports are gitignored (may contain unparsed columns). Knowledge base JSONs, career-data.json, and the resume markdown are all committed. PDF/DOCX in `data/generated/` are gitignored as regenerable binary artifacts, but copies in `public/` (PDF, DOCX, MD) are committed so Vercel can serve them as downloads. **Principle:** if data can't be public, it shouldn't be in the data model — this pipeline generates content sent to strangers.

## Brand Voice Guidelines

When generating resume content or any copy for paulprae.com, follow these guidelines:

- **Tone:** Confident, technically precise, action-oriented
- **Perspective:** Third-person professional (no "I" statements)
- **Emphasis areas:**
  - AI engineering leadership and architecture
  - Healthcare domain expertise (Arine, BCBS, Humana ecosystem)
  - Fortune 500 and enterprise delivery track record (AWS, Microsoft, Slalom)
  - Full-stack capability spanning data engineering, ML systems, and cloud infrastructure
- **Quantify impact** wherever data supports it (e.g., "reduced pipeline failures by 40%")
- **Target roles:** Principal AI Engineer, Solutions Architect, Senior Engineering Manager
- **Avoid:** Buzzword stuffing, vague claims, passive voice, overly humble hedging
- **Resume length:** Approximately 2 pages when rendered

## Data Pipeline

The build pipeline transforms raw career data into a deployed site:

```
1. npm run ingest    → Parse LinkedIn CSVs + knowledge JSONs → data/generated/career-data.json
2. npm run generate  → Load career data → Claude API (Opus 4.6) → data/generated/Paul-Prae-Resume.md
3. npm run export    → Pandoc + Typst convert → data/generated/Paul-Prae-Resume.pdf + .docx
4. npm run build     → Next.js reads Paul-Prae-Resume.md at build time → static HTML in out/
5. git push          → Vercel auto-deploys from main branch
```

**Full pipeline shortcut:** `npm run pipeline` (runs ingest → generate → export → build sequentially)

**Composable sub-pipelines:** `pipeline:content` (ingest + generate), `pipeline:render` (export + build), `pipeline:deploy` (full + git stage)

**Skip logic:** All pipeline steps skip automatically when outputs are newer than inputs. Use `--force` to override (e.g., `npm run generate:force`).

**System dependencies for export:** `pandoc` and `typst` must be installed (see TDD §5.6).

## Common Commands

See [README.md](README.md#5-run-the-pipeline) for the full command reference. Quick shortcuts:

- `npm run pipeline` — full pipeline: ingest → generate → export → build
- `npm test` — run all 160+ tests
- `npm run lint && npm run format:check` — verify code quality

## Phase 2 Preview (Do Not Implement Yet)

Phase 2 will transform this into a full-stack platform:

- **Supabase** PostgreSQL database with pgvector for career data + embeddings
- **Vercel AI SDK 6** with `@ai-sdk/anthropic` for streaming chat and resume generation
- **AI chat interface** where recruiters ask questions about Paul's career (RAG over career data)
- **Dynamic resume generation** tailored to specific job descriptions
- **Supabase Auth** for admin-gated content management
- Remove `output: 'export'` and switch to server-rendered Next.js

## Phase 3 Preview (Do Not Implement Yet)

Phase 3 adds knowledge graph and automation:

- **Neo4j AuraDB** career knowledge graph (Person → Role → Company → Project → Skill → Outcome)
- **AI Agent** with tool-calling via Vercel AI SDK 6 Agent class
- **n8n workflows** for automated data ingestion and content enrichment
- **Rust microservices** for performance-critical batch processing
