# Opus Planning Prompt: Phase 1 Wrap-Up & Vercel Deployment

**Purpose:** Hand this prompt to Claude (Opus 4.6) in a new session to plan and execute the remaining Phase 1 wrap-up tasks and initial Vercel deployment. This document captures the full context needed to pick up where the previous session left off.

**Generated:** 2026-02-26
**Branch:** claude/linkedin-resume-pipeline-cXKBe
**Last Commit:** 97d8f69 — QA pass (model ID fix, BOM handling, config extraction, email parsing)

---

## Prompt

You are continuing work on **paulprae.com**, an AI-powered career platform built with Next.js 16, TypeScript strict, Tailwind CSS 4, and Claude Opus 4.6. The Phase 1 data pipeline (LinkedIn CSV → Claude API → Markdown resume → static site) is fully implemented and has passed three iterations of QA. Your job is to wrap up the remaining Phase 1 tasks and get the site deployed to Vercel.

Read `CLAUDE.md` for project conventions and `docs/technical-design-document.md` for full architecture context before starting.

---

## Section 1: Wrap-Up Tasks (Pre-Deployment)

These items were identified during QA but deferred. Complete them before deployment.

### 1.1 Run the Pipeline with Real Data

**Status:** Pipeline code is complete and tested with synthetic data. Never run with real LinkedIn export.

**Steps:**
1. Confirm the user has placed their LinkedIn CSV export files in `data/linkedin/`. Expected files (all optional except `positions.csv` and `profile.csv`):
   - `Positions.csv`, `Education.csv`, `Skills.csv`, `Certifications.csv`
   - `Projects.csv`, `Publications.csv`, `Profile.csv`, `Languages.csv`
   - `Recommendations_Received.csv`, `Honors.csv`, `Volunteering.csv`
   - `Courses.csv`, `Email Addresses.csv`
   - Note: LinkedIn exports use Title Case filenames; the ingestion script lowercases for matching via `LINKEDIN_CSV_FILES` in `lib/config.ts`
2. Confirm the user has set `ANTHROPIC_API_KEY` in `.env.local`
3. Run `npm run ingest` and verify:
   - `data/career-data.json` is created with populated fields
   - All CSV files are parsed without errors
   - Date normalization produces consistent "Mon YYYY" format
   - Email extraction picks the correct primary email
   - No warnings about unknown CSV files (or if there are, they're expected)
4. Run `npm run generate` and verify:
   - Claude Opus 4.6 returns a complete resume (stop_reason: "end_turn", not "max_tokens")
   - `content/resume.md` contains properly formatted markdown
   - Generation metadata header is present (timestamp, model, token count)
   - Resume follows brand voice guidelines (confident, action-oriented, quantified impact)
   - Resume is approximately 2 pages when rendered
   - No fabricated content (all claims traceable to career data)
5. Run `npm run build` and verify:
   - Static export succeeds to `out/` directory
   - No TypeScript errors
   - The resume renders correctly in the built HTML
6. Run `npm run dev` and visually inspect:
   - Resume renders with proper typography (prose styles, hierarchy)
   - Print view (`Ctrl+P`) produces clean 2-page PDF
   - Mobile responsive (test at 320px, 768px, 1024px widths)
   - HTML comments (generation metadata) are stripped from display

**Potential issues to watch for:**
- LinkedIn CSV encoding: Windows exports may have BOM (handled by `stripBOM()` in ingest script)
- LinkedIn CSV column names: may vary between export date/region — check warnings for unknown headers
- Large career histories: may exceed 2-page target — adjust `SYSTEM_PROMPT` quality criteria if needed
- API rate limits: Opus 4.6 with max effort can take 30-90 seconds — be patient

### 1.2 Knowledge Base Integration (Optional Enhancement)

**Status:** The ingestion script references `data/knowledge/` but knowledge base JSON parsing is not yet implemented.

**Decision needed:** Should knowledge base JSONs be integrated now (Phase 1.1) or deferred to Phase 2?

**If implementing now:**
1. Define a `KnowledgeEntry` interface in `lib/types.ts`:
   ```typescript
   export interface KnowledgeEntry {
     category: string;        // e.g., "achievement", "project-detail", "domain-expertise"
     title: string;
     content: string;
     tags?: string[];
     relatedPositions?: string[];  // Company or role names to associate with
   }
   ```
2. Add knowledge base loading to `scripts/ingest-linkedin.ts`:
   - Read all `.json` files from `data/knowledge/`
   - Validate against schema
   - Merge into `CareerData` (add a `knowledge` array field)
3. Update the system prompt in `scripts/generate-resume.ts` to instruct Claude how to incorporate knowledge base entries (supplement LinkedIn data, don't duplicate)
4. Create example knowledge base files (gitignored, but provide `.example` templates)

**If deferring:** No action needed. The pipeline works without knowledge base files.

### 1.3 Public Assets

**Status:** `public/` directory contains only `.gitkeep`. No favicon, no OG image.

**Tasks:**
1. **Favicon:** Add a `favicon.ico` or `favicon.svg` to `public/`. A simple monogram "PP" or initials-based design works.
2. **OG Image:** Create `public/og-image.png` (1200x630px) for social media link previews. Update `app/layout.tsx` metadata:
   ```typescript
   openGraph: {
     images: [{ url: '/og-image.png', width: 1200, height: 630 }],
   }
   ```
3. **Apple Touch Icon:** Optional but recommended for iOS bookmarks.

**Note:** These can be deferred post-deployment if the user wants to ship faster.

### 1.4 Update README with Pipeline Results

After running the pipeline successfully:
1. Update `README.md` to reference actual output (e.g., "Generates a 2-page resume with X positions and Y skills")
2. Consider adding a screenshot of the rendered resume to the README

---

## Section 2: Vercel Deployment

### 2.1 Prerequisites

- **Vercel account** connected to the `praeducer` GitHub account
- **Custom domain:** `paulprae.com` (if purchased; otherwise use `paulprae.vercel.app`)
- **Repository:** `github.com/praeducer/paulprae-com` — must be accessible from Vercel

### 2.2 Vercel Project Setup

1. Go to [vercel.com/new](https://vercel.com/new) and import the `praeducer/paulprae-com` repository
2. **Framework Preset:** Next.js (auto-detected)
3. **Build Command:** `npm run build` (default)
4. **Output Directory:** Vercel auto-detects `output: 'export'` and uses `out/`
5. **Install Command:** `npm install` (default)
6. **Node.js Version:** 24.x (match local development)
7. **Environment Variables:** None needed for the Vercel build (resume.md is pre-generated and committed to git; the Anthropic API key is only used locally by `npm run generate`)

### 2.3 Deployment Flow

The Phase 1 deployment workflow is:

```
[Local machine]                     [GitHub]              [Vercel]

1. npm run pipeline
   (ingest → generate → build)

2. git add content/resume.md
   git commit
   git push origin main ──────────→ push event ──────────→ auto-build
                                                           npm run build
                                                           deploy out/

3.                                                        paulprae.com ✅
```

**Key point:** `npm run generate` (which calls the Claude API) runs LOCALLY, not on Vercel. The generated `content/resume.md` is committed to git. Vercel only runs `npm run build` which reads the pre-generated markdown. This means:
- No `ANTHROPIC_API_KEY` needed on Vercel
- No API costs on every deploy
- Deterministic builds (same markdown → same HTML)
- Resume only changes when you explicitly re-run the pipeline locally

### 2.4 Custom Domain Configuration

If `paulprae.com` is registered:
1. In Vercel project settings → Domains → Add `paulprae.com`
2. Add DNS records per Vercel's instructions:
   - `A` record: `76.76.21.21` (Vercel's IP)
   - `CNAME` for `www`: `cname.vercel-dns.com`
3. Vercel auto-provisions SSL certificate (Let's Encrypt)
4. Verify in `app/layout.tsx` that `metadataBase` uses the correct URL:
   ```typescript
   metadataBase: new URL('https://paulprae.com'),
   ```

### 2.5 Vercel Configuration File (Optional)

A `vercel.json` is NOT required for basic static export deployment. However, if custom headers or redirects are needed later:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 2.6 Post-Deployment Verification

After the first deploy:
1. **Visual check:** Resume renders correctly at the live URL
2. **Mobile check:** Test on a real phone or Chrome DevTools responsive mode
3. **Print check:** `Ctrl+P` produces clean PDF from the live URL
4. **SEO check:** View page source — verify `<title>`, `<meta name="description">`, OG tags
5. **Performance:** Run Lighthouse audit — target 90+ across all categories (static site should score 95+)
6. **SSL:** Verify HTTPS works and HTTP redirects to HTTPS
7. **404 page:** Next.js static export generates a default 404 — verify it works

---

## Section 3: Post-Deployment Improvements (Phase 1.1)

These are optional enhancements after the initial deploy. Prioritize based on the user's job search timeline.

### 3.1 PDF Export Enhancement

**Current state:** Print CSS is configured in `app/globals.css` for browser `Ctrl+P` → Save as PDF.

**Potential improvement:** Add an automated PDF generation step to the pipeline using Puppeteer or Playwright:
```bash
npm run pipeline:pdf    # ingest → generate → build → screenshot to PDF
```
This would produce a `public/Paul-Prae-Resume.pdf` downloadable from the live site.

### 3.2 Analytics

Add privacy-respecting analytics to track recruiter engagement:
- **Vercel Analytics** (built-in, zero-config): Page views, visitors, referrers
- **Plausible or Fathom** (privacy-first alternatives)
- Requires removing `output: 'export'` or using a client-side script

### 3.3 Sitemap and robots.txt

For SEO:
1. Add `public/robots.txt`:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://paulprae.com/sitemap.xml
   ```
2. Generate `sitemap.xml` — for a single-page site this is simple:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemor.org/schemas/sitemap/0.9">
     <url><loc>https://paulprae.com/</loc></url>
   </urlset>
   ```

### 3.4 Testing Framework

**Not in Phase 1 MVP scope** but would increase confidence for Phase 2:
- **Vitest** for unit testing (pipeline scripts, date normalization, CSV parsing)
- **Playwright** for E2E testing (resume renders, print layout, responsive)
- Add `npm test` script to package.json

### 3.5 Linting and Formatting

**Not in Phase 1 MVP scope** but recommended before Phase 2:
- **ESLint** with Next.js config (`next lint`)
- **Prettier** for consistent formatting
- Add to pre-commit hooks

---

## Section 4: Phase 2 Preparation Checklist

These items should be completed before beginning Phase 2. They don't require code changes but set the stage for the full-stack transition.

### 4.1 Accounts and Services

- [ ] **Supabase account** created at [supabase.com](https://supabase.com)
- [ ] **Supabase project** created (free tier, closest region)
- [ ] **pgvector extension** enabled in Supabase SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] **Vercel project** linked to Supabase (environment variables)

### 4.2 Architecture Decisions

Before starting Phase 2, decide:
- [ ] **Chat model:** Sonnet 4.6 for streaming chat (lower latency, lower cost) vs Opus 4.6 for everything
- [ ] **Embedding model:** Anthropic's embedding API vs OpenAI's text-embedding-3-small vs Voyage
- [ ] **Auth scope:** Admin-only (Paul) vs public registration vs anonymous chat
- [ ] **Resume storage:** Generate on-the-fly vs cache in Supabase vs hybrid

### 4.3 Migration Path

Phase 2 requires these changes to Phase 1 code:
1. **Remove `output: 'export'`** from `next.config.ts` (enables SSR, API routes, middleware)
2. **Add Supabase client** (`@supabase/ssr`, `@supabase/supabase-js`)
3. **Add Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`)
4. **Move career data** from JSON file to Supabase PostgreSQL
5. **Add chat route** (`app/chat/page.tsx` with streaming AI responses)
6. **Add API routes** (`app/api/chat/route.ts` for AI SDK streaming)
7. **Add dynamic resume generation** (`app/api/generate/route.ts`)
8. **Update deployment** — Vercel will now run SSR (no more static export)

### 4.4 Database Schema Preview

From the TDD (§6.3), the Phase 2 schema includes:
```sql
-- Career data tables
CREATE TABLE positions (id UUID PRIMARY KEY, ...);
CREATE TABLE education (id UUID PRIMARY KEY, ...);
CREATE TABLE skills (id UUID PRIMARY KEY, ...);

-- Vector embeddings for RAG
CREATE TABLE career_embeddings (
  id UUID PRIMARY KEY,
  source_type TEXT,
  source_id UUID,
  content TEXT,
  embedding VECTOR(1536),  -- or 3072 depending on model
  metadata JSONB
);

-- Chat history
CREATE TABLE conversations (id UUID PRIMARY KEY, ...);
CREATE TABLE messages (id UUID PRIMARY KEY, conversation_id UUID REFERENCES conversations, ...);
```

---

## Section 5: Immediate Action Plan

When you start this session, execute in this order:

### Step 1: Verify Current State
```bash
git status
git log --oneline -5
npm run build    # Confirm clean build
```

### Step 2: Data Readiness Check
Ask the user:
1. "Have you placed your LinkedIn CSV export files in `data/linkedin/`?"
2. "Have you set `ANTHROPIC_API_KEY` in `.env.local`?"
3. "Do you want to include knowledge base JSON files, or proceed with LinkedIn data only?"

### Step 3: Run the Pipeline
```bash
npm run pipeline    # ingest → generate → build
```
Review the output at each step. If issues arise, debug and fix before proceeding.

### Step 4: Visual QA
```bash
npm run dev
```
Open `http://localhost:3000` and verify:
- Resume renders with proper formatting
- Print preview produces clean PDF
- Mobile layout works

### Step 5: Commit Generated Resume
```bash
git add content/resume.md
git commit -m "feat: generate resume from real LinkedIn data via Claude Opus 4.6"
```

### Step 6: Deploy to Vercel
Guide the user through Vercel project setup (Section 2.2) or confirm it's already configured.
```bash
git push origin main
```
Verify at the live URL.

### Step 7: Post-Deploy Verification
Run through the checklist in Section 2.6.

---

## Context Files Reference

| File | Purpose | Read First? |
|------|---------|-------------|
| `CLAUDE.md` | Project conventions, critical rules, data pipeline docs | Yes |
| `docs/technical-design-document.md` | Full architecture, schema, three-phase roadmap | Yes (§1, §5) |
| `lib/config.ts` | Centralized paths, Claude API settings, LinkedIn CSV registry | Yes |
| `lib/types.ts` | All TypeScript interfaces (LinkedIn CSV, CareerData, results) | Yes |
| `scripts/ingest-linkedin.ts` | LinkedIn CSV → career-data.json (BOM handling, date normalization) | If debugging ingest |
| `scripts/generate-resume.ts` | Claude API call, system prompt, resume output | If debugging generation |
| `app/page.tsx` | Server component that renders resume.md | If fixing display |
| `app/globals.css` | Tailwind + typography + print styles | If fixing styling |
| `package.json` | Dependencies, scripts | Reference |
| `.gitignore` | Data exclusion rules | Reference |
