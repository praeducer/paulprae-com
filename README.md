# paulprae.com — AI-Powered Career Platform

A professional career platform that uses AI to generate, tailor, and present Paul Prae's experience as a Principal AI Engineer & Architect. Built with Next.js 16, TypeScript, and Claude AI.

## Overview

This project evolves across three phases:

1. **Phase 1 (Current):** AI-generated static resume — LinkedIn data + knowledge base fed to Claude, rendered as a styled static site on Vercel
2. **Phase 2:** Full-stack interactive platform — AI chat interface for recruiters, dynamic resume generation tailored to job descriptions, RAG over career data via Supabase + pgvector
3. **Phase 3:** Knowledge-graph-augmented AI — Neo4j career graph, AI agents with tool-calling, n8n automation pipelines

## Phase 1: AI-Generated Static Resume

The current phase implements an automated pipeline:

```
LinkedIn CSV Export → Ingestion Script → Claude API → Markdown Resume → Next.js Static Site → Vercel CDN
```

1. **Ingest** LinkedIn data exports and knowledge base JSONs into a unified career data file
2. **Generate** a professional Markdown resume by calling Claude Opus 4.6 with structured career data + brand guidelines
3. **Export** the Markdown resume to PDF (via Pandoc + Typst) and DOCX (via Pandoc)
4. **Build** a responsive static site with Next.js that renders the Markdown resume
5. **Deploy** automatically to Vercel on every push to `main`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling | Tailwind CSS 4.x |
| Markdown | react-markdown + remark-gfm |
| AI Generation | Anthropic Claude API (Opus 4.6) |
| Validation | Zod (schema validation) |
| Resume Export | Pandoc (MD→DOCX) + Typst (MD→PDF) |
| Testing | Vitest (150+ unit and integration tests) |
| Deployment | Vercel (free tier, auto-deploy from GitHub) |
| Dev Tooling | Claude Code CLI + Cursor |

## Getting Started

### Prerequisites

- Node.js 24+ (via nvm)
- npm or pnpm
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))
- Pandoc ([pandoc.org](https://pandoc.org/installing.html)) — for resume export
- Typst ([typst.app](https://github.com/typst/typst)) — for PDF export

### Setup

```bash
git clone https://github.com/praeducer/paulprae-com.git
cd paulprae-com

# Install all dependencies (Node.js, npm packages, pandoc, typst)
# Linux/WSL/macOS:
bash scripts/setup/install-pipeline-deps.sh
# Windows: powershell -NoProfile -File scripts\setup\install-dev-tools.ps1

npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Add your LinkedIn data exports
# Drop CSV files into data/sources/linkedin/
# Drop knowledge base JSONs into data/sources/knowledge/
```

### Run the Pipeline

```bash
# Full pipeline: ingest → generate → export → build
npm run pipeline

# Or run steps individually:
npm run ingest      # Parse LinkedIn CSVs + knowledge JSONs → career-data.json
npm run generate    # Call Claude API → data/generated/resume.md
npm run export      # Convert to PDF + DOCX (requires pandoc + typst)
npm run export:pdf  # PDF only
npm run export:docx # DOCX only
npm run build       # Next.js static export → out/
```

### Testing

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only (pure logic, no generated files needed)
npm run test:pipeline # Pipeline integration tests (validates generated outputs)
```

### Local Development

```bash
npm run dev         # Start dev server with Turbopack
```

## Deployment

The site auto-deploys to Vercel on every push to `main`:

1. Push changes: `git push origin main`
2. Vercel builds and deploys within ~60 seconds
3. Live at `paulprae.vercel.app` (custom domain: `paulprae.com`)

## Project Structure

```
paulprae-com/
├── app/                    # Next.js App Router pages and layouts
├── components/             # Reusable React components
├── data/
│   ├── sources/
│   │   ├── linkedin/       # LinkedIn CSV exports (gitignored — may contain unparsed columns)
│   │   └── knowledge/      # Knowledge base JSONs (committed — recruiter-facing content)
│   └── generated/          # Pipeline output: career-data.json + resume.md (committed), PDF + DOCX (gitignored)
├── tests/                  # Unit tests (Vitest) + pipeline integration tests
├── docs/                   # Technical documentation and design docs
├── scripts/                # Build pipeline + export scripts + resume-pdf.typ stylesheet
├── lib/                    # Shared utilities (config, types, markdown helpers)
├── public/                 # Static assets
├── .env.local.example      # Environment variable template
├── CLAUDE.md               # Claude Code project memory
└── next.config.ts          # Next.js configuration
```

## Roadmap

### Phase 2: Full-Stack Interactive Platform (Weeks 2-6)
- Supabase PostgreSQL database with pgvector for career data and embeddings
- AI chat interface where recruiters can ask questions about Paul's career
- Dynamic resume generation tailored to specific job descriptions
- Admin dashboard for managing career content
- Supabase Auth for admin access

### Phase 3: Knowledge-Graph-Augmented AI (Weeks 7-12+)
- Neo4j knowledge graph capturing career relationships (skills → projects → roles → outcomes)
- AI agent with tool-calling (graph queries, vector search, web research)
- n8n automation workflows for data ingestion and content enrichment
- Interactive career timeline and skill visualizations

## Documentation

| Doc | Purpose |
|---|---|
| [`docs/technical-design-document.md`](docs/technical-design-document.md) | Full architecture, schema, and implementation plan |
| [`docs/pipeline-setup-checklist.md`](docs/pipeline-setup-checklist.md) | Step-by-step pipeline setup: API keys, LinkedIn data, first run |
| [`docs/linux-dev-environment-setup.md`](docs/linux-dev-environment-setup.md) | Linux/WSL setup: nvm, Claude Code CLI, Cursor, pipeline deps |
| [`docs/windows-dev-environment-setup.md`](docs/windows-dev-environment-setup.md) | Windows-specific setup: Dev Drive, filesystem layout, cross-machine parity |
| [`scripts/setup/`](scripts/setup/) | Automated setup scripts (Windows + Linux/WSL) for dev environment and pipeline deps |

## Resume Versioning

Each pipeline run archives the resume to `data/generated/versions/` and logs it in [`data/generated/VERSIONS.md`](data/generated/VERSIONS.md). Use git tags (`resume/YYYY-MM-DD`) for milestone versions.

## License

[MIT](LICENSE)
