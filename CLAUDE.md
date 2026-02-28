# CLAUDE.md — Project Memory for Claude Code

## Project Overview

**paulprae.com** is an AI-powered career platform that positions Paul Prae as a Principal AI Engineer & Architect. The site generates professional resumes from structured career data using Claude AI, serves them as a responsive static site, and will evolve into an interactive platform with AI chat and dynamic resume generation.

**Current Phase:** Phase 1 — AI-Generated Static Resume
**Repository:** github.com/praeducer/paulprae-com
**Live URL:** paulprae.vercel.app (custom domain: paulprae.com)

## Tech Stack (Phase 1)

| Layer         | Technology                                         | Version         |
| ------------- | -------------------------------------------------- | --------------- |
| Framework     | Next.js (App Router, TypeScript strict, Turbopack) | 16.1.x          |
| Styling       | Tailwind CSS                                       | 4.x             |
| Markdown      | react-markdown + remark-gfm                        | Latest          |
| AI            | Anthropic Claude API via @anthropic-ai/sdk         | Latest          |
| CSV Parsing   | PapaParse                                          | Latest          |
| Validation    | Zod                                                | Latest          |
| Env Loading   | dotenv                                             | Latest          |
| Script Runner | tsx                                                | Latest          |
| Resume Export | Pandoc (MD→DOCX) + Typst (MD→PDF)                  | System binaries |
| Linting       | ESLint 9 (flat config) + eslint-config-next        | Latest          |
| Formatting    | Prettier                                           | 3.x             |
| Testing       | Vitest                                             | 4.x             |
| Deployment    | Vercel (static export, free tier)                  | Latest          |

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
components/            → Reusable React components
data/sources/linkedin/ → LinkedIn CSV exports (gitignored — raw exports may contain unparsed columns)
data/sources/knowledge/→ Knowledge base JSONs (committed — recruiter-facing content for Phase 2 RAG)
data/generated/        → Pipeline outputs: career-data.json + Paul-Prae-Resume.md (committed), PDF + DOCX (gitignored)
scripts/               → Pipeline scripts (ingest, generate, export) + resume-pdf.typ stylesheet
lib/                   → Shared utilities: config.ts, types.ts, markdown.ts, knowledge-types.ts
tests/                 → Unit and integration tests (Vitest)
public/                → Static assets
docs/                  → Technical documentation and architecture docs
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

5. **Data committal policy** — All pipeline data is recruiter-facing content, so most is committed to git for portability across machines. Only LinkedIn CSV raw exports are gitignored (may contain unparsed columns). Knowledge base JSONs, career-data.json, and the resume markdown are all committed. PDF/DOCX are gitignored as regenerable binary artifacts. **Principle:** if data can't be public, it shouldn't be in the data model — this pipeline generates content sent to strangers.

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

**System dependencies for export:** `pandoc` and `typst` must be installed (see TDD §5.6).

## Common Commands

```bash
npm run dev         # Local dev server with Turbopack (hot reload)
npm run build       # Production build (static export to out/)
npm run start       # Serve production build locally
npm run ingest      # Parse LinkedIn data → career-data.json
npm run generate    # Generate resume via Claude API → Paul-Prae-Resume.md
npm run export      # Export resume to PDF + DOCX (requires pandoc + typst)
npm run export:pdf  # Export PDF only
npm run export:docx # Export DOCX only
npm run pipeline    # Full pipeline: ingest → generate → export → build
npm test            # Run all tests (Vitest)
npm run test:unit   # Unit tests only (pure logic)
npm run test:pipeline # Pipeline integration tests (validates generated outputs)
npm run lint        # ESLint check (cached)
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier format all files
npm run format:check # Prettier check (CI-friendly)
```

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
