# CLAUDE.md — Project Memory for Claude Code

## 🛑 First thing to do in any session: read `.claude/plans/README.md`

The `.claude/plans/` directory contains the in-repo planning docs for active branches. The README there is the session-start entry point — it documents current state, authoritative career timeline, how to iterate on the NVIDIA submission content, fraud-detection history, and common gotchas. Read it before editing career data or generated content.

## Project Overview

**paulprae.com** is an AI-powered career platform that positions Paul Prae as a Principal AI Engineer & Architect. The site features an AI chat assistant for recruiter Q&A, tailored resume generation, and job search tools — all grounded in structured career data.

**Current Phase:** Phase 2 — AI Chat Platform (complete and live)
**Repository:** github.com/praeducer/paulprae-com
**Live URL:** https://paulprae.com (also: paulprae-com-one.vercel.app)

## Tech Stack

See [README.md](README.md#tech-stack) for the full tech stack. Key versions: Next.js 16.1.x, Tailwind CSS 4.x, Vitest 4.x, ESLint 9, Prettier 3.x. AI generation via `@anthropic-ai/sdk` (Claude Opus 4.6). Resume export via Pandoc + Typst (system binaries). Chat: Vercel AI SDK 6 (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/gateway`), `@assistant-ui/react` for UI. Rate limiting: `@upstash/redis` + `@upstash/ratelimit`.

## Key Conventions

- **App Router** — all routes use the `app/` directory (not `pages/`)
- **Server components by default** — only use `"use client"` when client interactivity is required
- **TypeScript strict mode** — no `any` types, strict null checks enabled
- **Server-rendered** — Next.js with API routes and streaming. No `output: 'export'`
- **Tailwind CSS only** — no CSS modules, no styled-components
- **Routes:** `/` (chat), `/resume` (static resume), `/tools` (noindex), `/api/chat` (streaming)

## File Organization

```
app/                   → Next.js App Router pages and layouts
app/api/chat/          → Streaming chat API route (AI SDK 6 + Claude)
app/components/        → Shared UI components (ChatHome, SiteNav, BookInterviewLink, QuickActions, Icons)
app/resume/            → Resume page with section nav
app/tools/             → Job search tools page (noindex)
data/sources/linkedin/ → LinkedIn CSV exports (gitignored — raw exports may contain unparsed columns)
data/sources/knowledge/→ Knowledge base JSONs (committed — recruiter-facing content for RAG)
data/generated/        → Pipeline outputs: career-data.json + Paul-Prae-Resume.md (committed), PDF + DOCX (gitignored)
scripts/               → Pipeline scripts (ingest, generate, export, brand) + resume-pdf.typ stylesheet
lib/                   → Shared utilities: constants, config, types, markdown, career-data, ui-utils, script-utils
lib/agent/             → Career context builder for chat system prompts
lib/prompts/           → System prompt templates (career-chat, job-tools, resume-writer)
tests/                 → Unit, integration, and component tests (Vitest + Testing Library)
proxy.ts               → Next.js 16 proxy (CORS + origin validation for API routes)
public/                → Static assets (OG image, favicons, resume downloads) committed for Vercel
docs/                  → Technical documentation (TDD, dev environment, MCP, browser prompts)
.mcp.json              → MCP config for Claude Code (project root; see docs/mcp-setup.md)
.cursor/mcp.json       → MCP config for Cursor (same sources as .mcp.json)
```

## Critical Rules

1. **data/generated/Paul-Prae-Resume.md is GENERATED** — To change resume output, edit `scripts/generate-resume.ts` (the prompt, formatting instructions, or data processing). Never edit the resume markdown directly — it gets overwritten by the pipeline. The filename is derived from `career-data.json` (profile.name → "Paul-Prae-Resume").

2. **Server-rendered mode** — The site uses server-rendered Next.js with API routes. The `/api/chat` route streams responses via Vercel AI SDK 6. The `/resume` page reads committed markdown at build time.

3. **Minimal dependencies** — Do NOT install:
   - shadcn/ui (not needed — using assistant-ui + Tailwind)
   - Supabase or @supabase/ssr (Phase 3)
   - Any database drivers or ORMs

4. **Environment variables** — `ANTHROPIC_API_KEY` in `.env.local` (never committed). Used by both build scripts and the `/api/chat` runtime. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for rate limiting (optional in dev).

5. **Data committal policy** — All pipeline data is recruiter-facing content, so most is committed to git for portability across machines. Only LinkedIn CSV raw exports are gitignored (may contain unparsed columns). Knowledge base JSONs, career-data.json, and the resume markdown are all committed. PDF/DOCX in `data/generated/` are gitignored as regenerable binary artifacts, but copies in `public/` (PDF, DOCX, MD) are committed so Vercel can serve them as downloads. **Principle:** if data can't be public, it shouldn't be in the data model — this pipeline generates content sent to strangers.

6. **Public download sync** — After modifying any resume output in `data/generated/`, always run `npm run check:fix` or `npm run export` to sync `public/` copies. The release check (`npm run check`) detects hash mismatches before push. Never edit files in `public/` directly — they are byte-exact copies of their sources.

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
1. npm run ingest        → Parse LinkedIn CSVs + knowledge JSONs → data/generated/career-data.json
2. npm run build:prompts → Pre-build system prompts → lib/generated/system-prompts.ts (committed)
3. npm run generate      → Claude API (Opus 4.6) → Paul-Prae-Resume.staging.md (NOT live)
4. npm run compare       → Interactive section-by-section review (optional: --judge for LLM scoring)
5. npm run approve       → Promote staging → Paul-Prae-Resume.md (approved/live)
6. npm run export        → Pandoc + Typst convert → Paul-Prae-Resume.pdf + .docx
7. npm run build         → Next.js reads approved resume + pre-built prompts → .next/ output
8. git push              → Vercel auto-deploys from main branch
```

**Full pipeline shortcut:** `npm run pipeline` (runs ingest → build:prompts → generate → export)

**Content review workflow:** `npm run generate` → `npm run compare` → `npm run approve` → `npm run export`

**Composable sub-pipelines:** `pipeline:content` (ingest + build:prompts + generate), `pipeline:render` (export), `pipeline:full` (pipeline + build), `pipeline:deploy` (full + git stage)

**Pre-built system prompts:** `lib/generated/system-prompts.ts` is committed and regenerated by `build:prompts`. It ensures byte-identical strings for Anthropic cache hit rates and eliminates runtime file I/O. `npm run build` runs `prebuild` (which runs `build:prompts`) automatically, so Vercel always deploys fresh prompts.

**Pipeline vs Website:** The pipeline and website are independent. `npm run pipeline` produces data files; `npm run build` compiles the website from committed files. No API key needed for website development.

**Staging/Approved decoupling:** Generation writes to `.staging.md`; the website and export read from the approved `.md`. This prevents regeneration from overwriting reviewed content. First-time generation auto-approves.

**Skip logic:** All pipeline steps skip automatically when outputs are newer than inputs. Use `--force` to override (e.g., `npm run generate:force`).

**System dependencies for export:** `pandoc` and `typst` must be installed (see TDD §5.6).

## Common Commands

See [README.md](README.md#commands) for the full command reference. Quick shortcuts:

- `npm run dev` — local development server with hot reload
- `npm run pipeline` — full pipeline: ingest → generate → export (no build)
- `npm run build` — website only (reads committed data, no API key)
- `npm run pipeline:full` — pipeline + build (convenience)
- `npm run brand` — generate brand assets (OG image, favicons) if missing
- `npm test` — run all unit/component tests
- `npm run test:e2e` — Playwright E2E smoke tests
- `npm run check` — full pre-push release checklist (data + docs + lint + format + test + build + validate)
- `npm run check:quick` — instant data file validation only
- `npm run check:fix` — quick check + auto-fix stale public/ copies
- `npm run validate:docs` — validate internal markdown links and required docs

## Phase 2 — AI Chat Platform (Live)

Phase 2 is the current platform. Chat-first homepage with AI career assistant, tailored resume generation via tool-calling, and job search content tools.

**Key features:**

- `/` — AI chat with recruiter-focused Q&A and tailored resume generation
- `/resume` — Static resume page with section navigation
- `/tools` — Job search content tools (cover letters, LinkedIn messages, etc., noindex)
- `/api/chat` — Streaming chat endpoint with tool-calling (AI SDK 6 + Claude Sonnet)

**Runtime env vars (set on Vercel):**

- `ANTHROPIC_API_KEY` — Claude API access for chat + tool-calling
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Rate limiting (optional in dev)

**Post-deploy testing:** See [`docs/uat-checklist.md`](docs/uat-checklist.md)

## Phase 3 Preview (Do Not Implement Yet)

Phase 3 adds knowledge graph and automation:

- **Neo4j AuraDB** career knowledge graph (Person → Role → Company → Project → Skill → Outcome)
- **AI Agent** with tool-calling via Vercel AI SDK 6 Agent class
- **n8n workflows** for automated data ingestion and content enrichment
- **Rust microservices** for performance-critical batch processing
