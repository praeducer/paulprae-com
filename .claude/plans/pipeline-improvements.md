# Pipeline Improvements Roadmap

Future improvements for the paulprae.com AI resume pipeline, organized by category. This file serves as a backlog for Claude Code sessions.

---

## Pipeline Enhancements

### Evaluation Loop (Evaluator-Optimizer Pattern)
Add a quality gate after resume generation: generate → score → revise if below threshold.
- Use a second Claude call as evaluator (Sonnet for speed/cost) to score the resume on: keyword coverage, quantified impact density, narrative coherence, formatting compliance
- If score < threshold (e.g., 85/100), feed evaluation feedback back to Opus for revision
- Max 2 revision loops to control cost
- Log scores to structured JSON for trend analysis
- Reference: Anthropic's evaluator-optimizer workflow pattern

### Resume Tailoring (Job Description → Tailored Resume)
Accept a job description URL or text as input, extract requirements, and generate a resume tailored to that specific role.
- Add `--job-url <url>` flag to `scripts/generate-resume.ts`
- Fetch and parse the JD (or accept `--job-text` for pasted content)
- Pass JD requirements as additional context to the generation prompt
- Output to `content/resume-tailored.md` (separate from the default resume)
- Export tailored versions to `out/resume-tailored.pdf` and `out/resume-tailored.docx`

### Pipeline Metrics & Observability
Log each pipeline step's metrics to structured JSON for cost tracking and optimization.
- Tokens used (input + output) and estimated cost per generation
- Latency per step (ingest, generate, export, build)
- File sizes of outputs
- Write to `data/pipeline-metrics.json` (gitignored)

---

## Architecture Evolution

### Phase 2: MCP Integration
Configure `mcp-pandoc` server for agent-driven format conversion in the chat interface.
- Enables "Download as PDF" and "Download as DOCX" buttons in the recruiter chat
- Claude calls the MCP tool instead of requiring shell access
- Monitor `mcp-pandoc` maturity (currently early development, PDF support incomplete)

### Phase 2: Vercel AI SDK Migration
Replace direct `@anthropic-ai/sdk` usage with `@ai-sdk/anthropic` + `generateText()`/`streamText()`.
- Enables streaming resume generation in the browser
- Unified provider interface (easy to swap models for evaluation)
- Aligns with Vercel's ecosystem (useChat hook, AI RSC, etc.)

### Claude Agent SDK Exploration
Evaluate `@anthropic-ai/claude-agent-sdk` for pipeline orchestration.
- Agent decides what sections to emphasize based on target role
- Self-evaluates and iterates on quality
- Could replace the manual evaluator-optimizer pattern with built-in agent loops

---

## Quality Improvements

### Print CSS
Add `@media print` rules to the website so `Ctrl+P` from the browser produces a clean PDF.
- Hide navigation, footer, and non-resume elements
- Set appropriate margins and font sizes for print
- This provides a third PDF export path (browser print) alongside Typst

### A/B Resume Variants
Generate multiple resume versions with different emphasis areas and track effectiveness.
- Variant A: AI/ML leadership focus
- Variant B: Solutions architecture focus
- Variant C: Engineering management focus
- Track which variant gets more interview callbacks

### JSON Resume Schema Compatibility
Export `career-data.json` in [JSON Resume](https://jsonresume.org/) format for interoperability.
- Enables use with dozens of existing resume themes and tools
- Standard schema used by LinkedIn resume exporters and resume builders

---

## Architecture Notes

### Orchestration Tooling
The pipeline (ingest → generate → export → build) is 4 linear steps. Dagster, Prefect, and n8n are overkill at this scale. A single TypeScript orchestrator script with error handling and retry logic is sufficient through Phase 2. Revisit in Phase 3 if the knowledge graph pipeline adds 10+ steps with branching dependencies.

### Reference DOCX Template
The `templates/reference.docx` file should be generated and customized once pandoc is installed:
```bash
pandoc -o templates/reference.docx --print-default-data-file reference.docx
```
Then open in Word/LibreOffice and customize heading styles, fonts (Inter or similar professional sans-serif), and spacing to match the Typst PDF output.
