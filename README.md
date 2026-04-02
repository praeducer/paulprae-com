# paulprae.com

[![CI](https://github.com/praeducer/paulprae-com/actions/workflows/ci.yml/badge.svg)](https://github.com/praeducer/paulprae-com/actions/workflows/ci.yml)
[![Deploy](https://github.com/praeducer/paulprae-com/actions/workflows/deploy.yml/badge.svg)](https://github.com/praeducer/paulprae-com/actions/workflows/deploy.yml)

An AI career platform at [paulprae.com](https://paulprae.com). Recruiters chat with a Claude-powered career assistant, explore a structured resume, and request tailored resumes for specific roles — all grounded in real career data.

This project is both a product and a portfolio piece. The codebase demonstrates production AI engineering: streaming LLM integration, tool-calling, prompt engineering with grounding rules, security hardening, and a CI/CD pipeline that deploys with zero manual steps.

## What It Does

| Route                                    | Purpose                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`/`](https://paulprae.com)              | AI chat — recruiter Q&A, resume downloads, tailored resume generation                                 |
| [`/resume`](https://paulprae.com/resume) | Full resume with section navigation and PDF/DOCX/MD downloads                                         |
| `/api/chat`                              | Streaming chat API with [tool-calling](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) |

## Architecture

Two independent workflows connected by committed data files:

```
Resume Pipeline (local)              Website + Chat (Vercel)
─────────────────────────            ──────────────────────────
LinkedIn CSV + knowledge JSONs       Next.js App Router
    ↓ npm run ingest                     ↓ npm run build
career-data.json ──────────────────→ /resume (static pre-render)
    ↓ npm run generate                   ↓
Paul-Prae-Resume.md                  /api/chat (streaming)
    ↓ npm run export                     │ system prompt = career data
PDF + DOCX                               │ + grounding rules
                                         ↓
                                     Claude Sonnet 4.6 → SSE stream → UI
```

The pipeline and website are independent. Website development requires only Node.js. The chat API requires `ANTHROPIC_API_KEY` at runtime.

### AI Chat System

The chat API ([`app/api/chat/route.ts`](app/api/chat/route.ts)) streams responses via [Vercel AI SDK 6](https://ai-sdk.dev/docs/introduction) with two tools:

- **`generate_tailored_resume`** — accepts a job description, calls Claude to produce a role-specific resume
- **`get_resume_links`** — returns download URLs for PDF, DOCX, Markdown, and web formats

Career data (~90K tokens) is loaded into the system prompt with [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) (5-min TTL). After the first request, subsequent turns reuse the cached prompt at ~90% cost reduction.

System prompts include grounding rules (G1-G10) that require every fact to be attributed to a specific company and role — preventing hallucination and cross-employer conflation. Security rules (S1-S5) defend against prompt injection. Prompts live in [`lib/prompts/`](lib/prompts/) as Markdown files with YAML frontmatter.

### Resume Pipeline

The pipeline generates career artifacts from structured data:

1. **Ingest** — parse LinkedIn CSV exports + knowledge base JSONs into [`career-data.json`](data/generated/career-data.json)
2. **Generate** — call Claude Opus 4.6 with career data + brand guidelines → staging markdown resume
3. **Compare** — optional interactive section-by-section review (`--judge` for LLM scoring)
4. **Approve** — promote staging resume to approved (the version the website reads)
5. **Export** — Pandoc + Typst convert → PDF and DOCX

Generation writes to a staging file; the website reads the approved file. This prevents regeneration from overwriting reviewed content. All pipeline steps skip automatically when outputs are newer than inputs.

## Tech Stack

| Layer         | Technology                                                                                                              | Version |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| Framework     | [Next.js](https://nextjs.org/) (App Router, TypeScript)                                                                 | 16.x    |
| AI Chat       | [Vercel AI SDK](https://ai-sdk.dev/) (`ai` + `@ai-sdk/anthropic`) + Claude Sonnet 4.6                                   | 6.x     |
| Chat UI       | [`@assistant-ui/react`](https://github.com/assistant-ui/assistant-ui) (Radix-style primitives)                          | 0.12.x  |
| Styling       | [Tailwind CSS](https://tailwindcss.com/)                                                                                | 4.x     |
| AI Generation | [Anthropic Claude API](https://docs.anthropic.com/) (Opus 4.6) for resume pipeline                                      | —       |
| Rate Limiting | [Upstash Redis](https://upstash.com/) (`@upstash/ratelimit`) with in-memory fallback                                    | —       |
| Validation    | [Zod](https://zod.dev/)                                                                                                 | 4.x     |
| Resume Export | [Pandoc](https://pandoc.org/) (MD→DOCX) + [Typst](https://typst.app/) (MD→PDF)                                          | —       |
| Testing       | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + [Playwright](https://playwright.dev/) | —       |
| Linting       | ESLint 9 + Prettier + husky + lint-staged                                                                               | —       |
| Deployment    | [Vercel](https://vercel.com/) via [GitHub Actions](https://github.com/praeducer/paulprae-com/actions) CI/CD             | —       |

## Getting Started

### Website Development (no API key needed)

```bash
git clone https://github.com/praeducer/paulprae-com.git
cd paulprae-com
npm install
npm run dev     # localhost:3000 with Turbopack hot-reload
```

The website reads committed data files and works immediately. For UI/style changes, this is all you need.

### Full Pipeline Setup

To regenerate resume content from LinkedIn data:

```bash
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY (https://console.anthropic.com/settings/keys)

# Place LinkedIn CSVs in data/sources/linkedin/
# Export from: https://www.linkedin.com/mypreferences/d/download-my-data
# Select "Download larger data archive" for full position descriptions

# Install export dependencies (for PDF/DOCX)
# Ubuntu/WSL: sudo apt-get install -y pandoc && cargo install typst-cli
# macOS: brew install pandoc typst

npm run pipeline     # ingest → generate → export
```

### Commands

```bash
# Development
npm run dev                # Dev server (Turbopack)
npm run build              # Production build
npm test                   # 480+ unit/component tests (~1s)
npm run test:e2e           # Playwright E2E smoke tests
npm run check              # Full pre-push checklist (lint + format + test + build + validate)

# Pipeline
npm run pipeline           # Full: ingest → generate → export
npm run pipeline:content   # AI steps only: ingest → generate
npm run ingest             # Parse LinkedIn CSVs + knowledge JSONs → career-data.json
npm run generate           # Claude API → Paul-Prae-Resume.staging.md
npm run export             # Pandoc + Typst → PDF + DOCX
```

Playwright notes:

- Default `npm run test:e2e` runs fast mocked smoke tests on Chromium only.
- Use `PW_FULL_MATRIX=1 npm run test:e2e` for Firefox/WebKit/mobile matrix.
- Use `E2E_LIVE_CHAT=1 npx playwright test e2e/live-chat.spec.ts` for optional real API validation.

## Security

The chat API includes multiple defense layers documented in [`docs/security.md`](docs/security.md):

- **Origin validation** — [`proxy.ts`](proxy.ts) blocks cross-origin requests from unauthorized domains
- **Rate limiting** — 20 req/min per IP via Upstash Redis (in-memory fallback when Redis unavailable)
- **Input validation** — request body size (256KB), message count (50), per-message length (4K chars)
- **Prompt injection defense** — security rules S1-S5 in all system prompts, XML delimiters around user input in tool calls
- **Security headers** — CSP, HSTS, X-Frame-Options (DENY), Permissions-Policy via [`vercel.json`](vercel.json)

## Deployment

Deploys through GitHub Actions — [Vercel Git integration is not used](https://vercel.com/docs/deployments/git):

```
Push to main → CI: lint, format, test, build, validate
             → Deploy: preview → smoke test → promote to production
```

| Environment | URL                                  | Trigger                          |
| ----------- | ------------------------------------ | -------------------------------- |
| Local       | `localhost:3000`                     | `npm run dev`                    |
| Preview     | `*.vercel.app`                       | CI passes → deploy workflow      |
| Production  | [paulprae.com](https://paulprae.com) | Smoke test passes → auto-promote |

AI generation runs locally. Vercel only runs `next build` against committed files — no API key needed in the build step.

## Project Structure

```
app/                        Next.js App Router pages and layouts
  api/chat/route.ts         Streaming chat API with tool-calling
  components/               SiteNav, ChatHome, BookInterviewLink, QuickActions, Icons
  resume/                   Resume page with section nav, downloads
  tools/                    Job search content tools (noindex)
lib/
  agent/context.ts          Career context builder for system prompts
  prompts/                  System prompts (Markdown + YAML frontmatter + few-shot examples)
  data-utils.ts             Shared utilities (stripEmpty for token optimization)
  constants.ts              Shared constants (client + server)
data/
  sources/linkedin/         LinkedIn CSV exports (gitignored)
  sources/knowledge/        Knowledge base JSONs (committed)
  generated/                Pipeline outputs (career-data.json, resume .md committed; PDF/DOCX gitignored)
scripts/                    Pipeline scripts + Typst stylesheet
tests/                      Unit, integration, component tests (Vitest + Testing Library)
e2e/                        Playwright E2E smoke tests
proxy.ts                    Next.js 16 proxy (CORS + origin validation)
docs/                       Technical documentation
```

## Documentation

| Document                                                                 | Purpose                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| [`docs/technical-design-document.md`](docs/technical-design-document.md) | System architecture, constraints, and phase roadmap   |
| [`docs/ai-architecture.md`](docs/ai-architecture.md)                     | AI architecture decisions and well-architected review |
| [`docs/devops.md`](docs/devops.md)                                       | Deployment, smoke tests, rollback, CI/CD              |
| [`docs/uat-checklist.md`](docs/uat-checklist.md)                         | Manual QA checklist for post-deploy verification      |
| [`docs/domain-dns-runbook.md`](docs/domain-dns-runbook.md)               | DNS operations, validation, troubleshooting           |
| [`docs/security.md`](docs/security.md)                                   | Security policy, threat model, cost controls          |
| [`CHANGELOG.md`](CHANGELOG.md)                                           | Release history                                       |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                     | Development workflow and code standards               |

## Roadmap

### Phase 3: Knowledge-Graph-Augmented AI (planned)

- Neo4j knowledge graph (Person → Role → Company → Project → Skill → Outcome)
- AI agents with tool-calling via Claude Agent SDK
- n8n automation workflows for data ingestion and enrichment

## License

[MIT](LICENSE)
