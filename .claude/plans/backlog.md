# Backlog — paulprae.com

> **Updated:** 2026-02-28
> **Status:** Phase 1 complete and deployed. All items below are optional enhancements or Phase 2+ work. None block the current site.

---

## Phase 1 Polish (Requires Human Action)

### Favicon & OG Image

`public/` has `robots.txt` and `sitemap.xml` but no visual branding assets.

1. **Favicon:** Add `favicon.ico` or `favicon.svg` to `public/`. A "PP" monogram or initials-based design.
2. **OG Image:** Create `public/og-image.png` (1200x630px) for social media link previews. Then update `app/layout.tsx`:
   ```typescript
   openGraph: {
     images: [{ url: '/og-image.png', width: 1200, height: 630 }],
   }
   ```
3. **Apple Touch Icon:** Optional for iOS bookmarks.

### Analytics

Add privacy-respecting analytics to track recruiter engagement:

- **Vercel Analytics** (built-in, zero-config) — simplest option
- **Plausible or Fathom** — privacy-first alternatives
- Note: May require removing `output: 'export'` or using a client-side script

---

## Dev Environment Consolidation (Requires Human Action)

All steps require physical machine access and human decisions.

### 1. Apply .wslconfig

Requires WSL shutdown (interrupts all running WSL sessions):

```powershell
wsl --shutdown
```

Then relaunch and verify: `free -h` (should show ~32 GB), `nproc` (should show 12).

### 2. Move paloist-core to Dev Drive

```powershell
robocopy C:\dev\paloist-core D:\dev\paloist-core /E /MOVE
```

### 3. Clone active repos to Dev Drive

Human decision needed on which repos to clone to `D:\dev\`.

### 4. Consolidate WSL repos

Move repos from `~/workspace/` to `~/dev/`, then remove `~/workspace`.

### 5. Clean up cloud drive repos

Delete duplicate git repos from OneDrive/iCloudDrive (verify all pushed to GitHub first). Keep old company repos in iCloud as-is.

---

## Pipeline Enhancements (Phase 2+ Roadmap)

### Evaluation Loop (Evaluator-Optimizer Pattern)

Add a quality gate: generate → score (Sonnet) → revise if below threshold (max 2 loops).

### Resume Tailoring (Job Description → Tailored Resume)

Accept `--job-url <url>` or `--job-text` flag. Generate role-specific resume to `resume-tailored.{md,pdf,docx}`.

### Pipeline Metrics & Observability

Log tokens, cost, latency, file sizes to `data/generated/pipeline-metrics.json` (gitignored).

### A/B Resume Variants

Generate variants (AI/ML leadership, solutions architecture, engineering management) and track effectiveness.

### JSON Resume Schema Compatibility

Export `career-data.json` in [JSON Resume](https://jsonresume.org/) format for interoperability.

---

## Architecture Evolution (Phase 2+)

### MCP Integration

`mcp-pandoc` for agent-driven format conversion in the chat interface.

### Vercel AI SDK Migration

Replace `@anthropic-ai/sdk` with `@ai-sdk/anthropic` + `generateText()`/`streamText()`.

### Claude Agent SDK Exploration

Evaluate `@anthropic-ai/claude-agent-sdk` for pipeline orchestration and self-evaluation.

---

## Architecture Notes

### Orchestration

The 4-step linear pipeline doesn't need Dagster/Prefect/n8n. A single TypeScript orchestrator suffices through Phase 2. Revisit in Phase 3.

### DOCX Styling

Pandoc default DOCX is ATS-friendly. For custom styling: `pandoc -o reference.docx --print-default-data-file reference.docx`, customize in Word, pass via `--reference-doc`.

### Print CSS

`@media print` rules exist in `app/globals.css`. Browser `Ctrl+P` produces a clean PDF as a third export path alongside Typst.
