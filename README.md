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

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Framework     | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling       | Tailwind CSS 4.x                               |
| Markdown      | react-markdown + remark-gfm                    |
| AI Generation | Anthropic Claude API (Opus 4.6)                |
| Validation    | Zod (schema validation)                        |
| Resume Export | Pandoc (MD→DOCX) + Typst (MD→PDF)              |
| Linting       | ESLint 9 + eslint-config-next + Prettier       |
| Testing       | Vitest (160+ unit and integration tests)       |
| Deployment    | Vercel (free tier, auto-deploy from GitHub)    |
| Dev Tooling   | Claude Code CLI + Cursor                       |

## Getting Started

### Prerequisites

- Node.js 24+ (via nvm)
- npm or pnpm
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))
- Pandoc ([pandoc.org](https://pandoc.org/installing.html)) — for resume export
- Typst ([typst.app](https://github.com/typst/typst)) — for PDF export

### 1. Clone and Install

```bash
git clone https://github.com/praeducer/paulprae-com.git
cd paulprae-com

# Install all dependencies (Node.js, npm packages, pandoc, typst)
# Linux/WSL/macOS:
bash scripts/setup/install-pipeline-deps.sh
# Windows: powershell -NoProfile -File scripts\setup\install-dev-tools.ps1

npm install
```

**Optional — MCP (Claude Code & Cursor):** To install shared MCP config (Vercel, GitHub, Filesystem, Fetch), run `bash scripts/setup/install-mcp.sh` (Linux/WSL/macOS) or `powershell -NoProfile -File scripts\setup\install-mcp.ps1` (Windows). See [docs/mcp-setup.md](docs/mcp-setup.md).

### 2. Configure API Key

```bash
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY (get one at console.anthropic.com/settings/keys)
```

> **Billing:** The pipeline uses Claude Opus 4.6. A single resume generation costs ~$0.50-$2.00 in API credits. Ensure your account has credits at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing).

### 3. Add LinkedIn Data

1. Go to [linkedin.com/mypreferences/d/download-my-data](https://www.linkedin.com/mypreferences/d/download-my-data)
2. Select **"Download larger data archive"** (the smaller export doesn't include full position descriptions)
3. Wait for LinkedIn's email (10 minutes to 24 hours), then download and unzip
4. Copy CSVs into `data/sources/linkedin/`

The pipeline recognizes these files (case-insensitive):

| File                           | Required?    | What it contains            |
| ------------------------------ | ------------ | --------------------------- |
| `Positions.csv`                | **Required** | Work experience             |
| `Education.csv`                | Recommended  | Degrees, schools            |
| `Skills.csv`                   | Recommended  | LinkedIn skill endorsements |
| `Profile.csv`                  | Recommended  | Name, headline, summary     |
| `Email Addresses.csv`          | Recommended  | Contact email               |
| `Certifications.csv`           | Optional     | Professional certifications |
| `Projects.csv`                 | Optional     | Project portfolio           |
| `Publications.csv`             | Optional     | Published works             |
| `Languages.csv`                | Optional     | Language proficiencies      |
| `Recommendations_Received.csv` | Optional     | Peer recommendations        |
| `Honors.csv`                   | Optional     | Awards, honors              |
| `Volunteering.csv`             | Optional     | Volunteer experience        |
| `Courses.csv`                  | Optional     | Course completions          |

At minimum, you need `Positions.csv` or `Education.csv` for the pipeline to succeed. LinkedIn CSVs are gitignored and stay local to your machine.

### 4. Install Export Dependencies (Optional — for PDF/DOCX)

If you want PDF and DOCX exports (not just the web resume):

**Ubuntu/WSL:**

```bash
sudo apt-get install -y pandoc
cargo install typst-cli  # or download from https://github.com/typst/typst/releases
```

**macOS:**

```bash
brew install pandoc typst
```

**Windows (PowerShell):**

```powershell
winget install --id JohnMacFarlane.Pandoc --exact
winget install --id Typst.Typst --exact
```

Verify: `pandoc --version && typst --version`

> The `npm run export` step will **fail** if pandoc/typst are missing. If you only need the web resume, skip the export step and run `npm run ingest && npm run generate && npm run build` instead.

### 5. Run the Pipeline

```bash
# Full pipeline: ingest → generate → export → build
npm run pipeline

# Or run steps individually:
npm run ingest      # Parse LinkedIn CSVs + knowledge JSONs → career-data.json
npm run generate    # Call Claude API → data/generated/Paul-Prae-Resume.md
npm run export      # Convert to PDF + DOCX (requires pandoc + typst)
npm run export:pdf  # PDF only
npm run export:docx # DOCX only
npm run build       # Next.js static export → out/

# Composable sub-pipelines:
npm run pipeline:content  # ingest → generate (AI steps only)
npm run pipeline:render   # export → build (from existing markdown)
npm run pipeline:deploy   # full pipeline + stage generated files for git

# Force variants (skip freshness checks):
npm run ingest:force      # Re-ingest even if inputs unchanged
npm run generate:force    # Regenerate even if resume is fresh
```

Pipeline steps skip automatically when their outputs are newer than their inputs. The ingest step uses SHA-256 content hashing; generate and export use file modification times. Use `--force` to override (e.g., `npm run generate:force`).

### Testing

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only (pure logic, no generated files needed)
npm run test:pipeline # Pipeline integration tests (validates generated outputs)
```

### Linting & Formatting

```bash
npm run lint          # ESLint check (cached)
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format all files
npm run format:check  # Prettier check (CI-friendly)
```

### Local Development

```bash
npm run dev         # Start dev server with Turbopack
```

### Repeating on a Fresh Machine

1. Clone the repo
2. `npm install`
3. Copy `.env.local` from your password manager (or create a new key)
4. Place LinkedIn CSVs in `data/sources/linkedin/` (re-export if needed)
5. Install pandoc + typst (see step 4)
6. `npm run pipeline`

The knowledge base (`data/sources/knowledge/`) is committed to git and transfers automatically with the repo.

### Troubleshooting

| Problem                       | Solution                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `tsx not found`               | Run `npm install` first, or use `npx tsx`                                                       |
| `ANTHROPIC_API_KEY not found` | Create `.env.local` per step 2                                                                  |
| `No CSV files found`          | Place LinkedIn CSVs in `data/sources/linkedin/` per step 3                                      |
| `API Error: 401`              | Check your API key in `.env.local`                                                              |
| `API Error: 429`              | Rate limited — wait 60 seconds and retry                                                        |
| `pandoc not found`            | Install per step 4, or skip export step                                                         |
| UNC path / CMD.EXE errors     | Run via WSL: `wsl bash -lc "source ~/.nvm/nvm.sh && cd ~/dev/paulprae-com && npm run pipeline"` |

## Deployment

The site auto-deploys to Vercel on every push to `main`. AI generation happens locally — Vercel only runs `next build` against committed files (no API keys needed on the server).

```
Local: npm run pipeline → ingest → generate → export → build
       git push origin main
Vercel: npm ci → next build → serves out/ directory via CDN
```

1. Run the pipeline locally: `npm run pipeline`
2. Commit generated files: `git add data/generated/ public/Paul-Prae-Resume.* && git commit`
3. Push to deploy: `git push origin main`
4. Vercel auto-builds within ~60 seconds
5. Live at [paulprae.com](https://paulprae.com) (also: [paulprae-com-one.vercel.app](https://paulprae-com-one.vercel.app/))

Vercel skips rebuilds when only docs or tooling files change (configured via `ignoreCommand` in `vercel.json`). The project uses `framework: null` in `vercel.json` because `output: 'export'` produces a plain static site that Vercel's Next.js adapter cannot serve directly.

## Project Structure

```
paulprae-com/
├── app/                    # Next.js App Router pages and layouts
├── data/
│   ├── sources/
│   │   ├── linkedin/       # LinkedIn CSV exports (gitignored — may contain unparsed columns)
│   │   └── knowledge/      # Knowledge base JSONs (committed — recruiter-facing content)
│   └── generated/          # Pipeline output: career-data.json + Paul-Prae-Resume.md (committed), PDF + DOCX (gitignored)
├── tests/                  # Unit tests (Vitest) + pipeline integration tests
├── docs/                   # Technical documentation and design docs
├── scripts/                # Build pipeline + export scripts + resume-pdf.typ stylesheet
├── lib/                    # Shared utilities (config, types, markdown helpers)
├── public/                 # Static assets (robots.txt, sitemap.xml)
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

| Doc                                                                              | Purpose                                                                             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`docs/technical-design-document.md`](docs/technical-design-document.md)         | Full architecture, schema, and implementation plan                                  |
| [`docs/linux-dev-environment-setup.md`](docs/linux-dev-environment-setup.md)     | Linux/WSL setup: nvm, Claude Code CLI, Cursor, pipeline deps                        |
| [`docs/windows-dev-environment-setup.md`](docs/windows-dev-environment-setup.md) | Windows-specific setup: Dev Drive, filesystem layout, cross-machine parity          |
| [`docs/mcp-setup.md`](docs/mcp-setup.md)                                         | MCP config for Claude Code and Cursor (Vercel, GitHub, Filesystem, Fetch)           |
| [`scripts/setup/`](scripts/setup/)                                               | Automated setup scripts (Windows + Linux/WSL) for dev environment and pipeline deps |

## Resume Versioning

Each pipeline run archives the resume to `data/generated/versions/` and logs it in [`data/generated/VERSIONS.md`](data/generated/VERSIONS.md). Use git tags (`resume/YYYY-MM-DD`) for milestone versions.

## License

[MIT](LICENSE)
