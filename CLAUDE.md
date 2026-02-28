# CLAUDE.md — Project Memory for Claude Code

## Project Overview

**paulprae.com** is an AI-powered career platform that positions Paul Prae as a Principal AI Engineer & Architect. The site generates professional resumes from structured career data using Claude AI, serves them as a responsive static site, and will evolve into an interactive platform with AI chat and dynamic resume generation.

**Current Phase:** Phase 1 — AI-Generated Static Resume
**Repository:** github.com/praeducer/paulprae-com
**Live URL:** paulprae.vercel.app (custom domain: paulprae.com)

## Tech Stack (Phase 1)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, TypeScript strict, Turbopack) | 16.1.x |
| Styling | Tailwind CSS | 4.x |
| Markdown | react-markdown + remark-gfm | Latest |
| AI | Anthropic Claude API via @anthropic-ai/sdk | Latest |
| CSV Parsing | PapaParse | Latest |
| Script Runner | tsx | Latest |
| Resume Export | Pandoc (MD→DOCX) + Typst (MD→PDF) | System binaries |
| Deployment | Vercel (static export, free tier) | Latest |

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
data/generated/        → Pipeline outputs: career-data.json + resume.md (committed), PDF + DOCX (gitignored)
scripts/               → Pipeline scripts (ingest, generate, export) + resume-pdf.typ stylesheet
lib/                   → Shared utilities, TypeScript interfaces, pipeline config
public/                → Static assets (favicon, OG image)
docs/                  → Technical documentation and architecture docs
```

## Critical Rules

1. **data/generated/resume.md is GENERATED** — To change resume output, edit `scripts/generate-resume.ts` (the prompt, formatting instructions, or data processing). Never edit resume.md directly — it gets overwritten by the pipeline.

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

5. **Data committal policy** — All pipeline data is recruiter-facing content, so most is committed to git for portability across machines. Only LinkedIn CSV raw exports are gitignored (may contain unparsed columns). Knowledge base JSONs, career-data.json, and resume.md are all committed. PDF/DOCX are gitignored as regenerable binary artifacts. **Principle:** if data can't be public, it shouldn't be in the data model — this pipeline generates content sent to strangers.

## Brand Voice Guidelines

When generating resume content or any copy for paulprae.com, follow these guidelines:

- **Tone:** Confident, technically precise, action-oriented
- **Perspective:** First-person for summaries, third-person acceptable for bios
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
2. npm run generate  → Load career data → Claude API (Opus 4.6) → data/generated/resume.md
3. npm run export    → Pandoc + Typst convert resume.md → data/generated/resume.pdf + .docx
4. npm run build     → Next.js reads resume.md at build time → static HTML in out/
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
npm run generate    # Generate resume via Claude API → resume.md
npm run export      # Export resume to PDF + DOCX (requires pandoc + typst)
npm run export:pdf  # Export PDF only
npm run export:docx # Export DOCX only
npm run pipeline    # Full pipeline: ingest → generate → export → build
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
