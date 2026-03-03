# Plan: Refactor Resume Generation Pipeline for AI Engineering Excellence

## Context

The paulprae-com resume pipeline is a production-grade 4-stage system (ingest → generate → export → build) that transforms LinkedIn career data into an AI-generated resume via Claude Opus 4.6. Phase 1 is complete and deployed. The code is well-tested (245+ tests) and functional, but the AI layer was built pragmatically — the system prompt is embedded in a script, knowledge base schemas are ad-hoc, there's no AI service abstraction, and the architecture doesn't position for the next phase: a chat interface with dynamic resume generation, RAG over career data, and convergence with the [job-finding-assistant](https://github.com/Modular-Earth-LLC/job-finding-assistant) project's 6 AI skills.

This refactoring has three goals:

1. **Demonstrate principal AI engineer competence** — clean prompt architecture, proper context engineering, agentic design patterns
2. **Position for Phase 2** — skills-based architecture, RAG-ready data model, pgvector preparation
3. **Maintain simplicity** — the local pipeline must keep working; no premature frameworks

### What prompted this

- Knowledge base already contains `agents/agent-definitions.json` mapping to job-finding-assistant prompts — the bridge exists but isn't utilized
- System prompt (166 lines) is embedded in `generate-resume.ts` — not versionable, not reusable, not testable as a standalone asset
- Knowledge base has 3+ incompatible schemas (KnowledgeEntry, raw arrays, structured career data) — needs standardization before pgvector
- No telemetry beyond console.log — can't track prompt quality, cost trends, or cache effectiveness
- `ingest-linkedin.ts` is 958 lines — monolithic, mixing CSV parsing, date normalization, knowledge loading, and Zod validation

---

## Phase A: Prompt Architecture — Extract, Version, Structure

**Goal:** Prompts become first-class assets — versionable files that map 1:1 to future Anthropic Agent Skills.

### A1. Create prompt file format

Create `lib/prompts/` directory with markdown-based prompt files:

```
lib/prompts/
  resume-writer.system.md      ← extracted from generate-resume.ts line 49-166
  resume-writer.config.json    ← model settings (currently in lib/config.ts CLAUDE object)
  README.md                    ← documents the prompt format convention
```

**Prompt file format** (`resume-writer.system.md`):

- YAML frontmatter with metadata: `id`, `version`, `model`, `description`, `tags`
- Body is the raw system prompt text (no code, no TypeScript)
- This maps directly to how Anthropic Agent Skills package instructions

**Config file** (`resume-writer.config.json`):

```json
{
  "model": "claude-opus-4-6",
  "maxTokens": 32768,
  "thinking": { "type": "adaptive" },
  "effort": "max",
  "cacheSystemPrompt": true
}
```

### A2. Create prompt loader utility

Create `lib/prompts/loader.ts`:

- `loadPrompt(id: string)` → returns `{ systemPrompt: string, config: PromptConfig, metadata: PromptMetadata }`
- Parses YAML frontmatter from `.system.md` files
- Loads corresponding `.config.json`
- Add `PromptConfig` and `PromptMetadata` types to `lib/types.ts`
- Validates config with Zod (fail fast on invalid model/token settings)

### A3. Refactor generate-resume.ts

- Remove embedded `SYSTEM_PROMPT` constant (lines 49-166)
- Replace with `loadPrompt("resume-writer")` call
- Add `promptVersion` field to `GenerationResult` type (tracks which prompt version produced each output)
- Embed prompt version in the HTML comment header of generated resume files
- Keep `buildUserMessage()` in the script (it's data-specific, not a prompt)

### A4. Update tests

- `tests/generate.test.ts`: Update tests that reference `_testExports.SYSTEM_PROMPT` to use `loadPrompt()`
- Add `tests/prompts.test.ts`: Test prompt loading, frontmatter parsing, config validation
- Add prompt regression test: hash the system prompt content and assert stability (catches accidental edits)

**Files created:** `lib/prompts/resume-writer.system.md`, `lib/prompts/resume-writer.config.json`, `lib/prompts/loader.ts`, `lib/prompts/README.md`, `tests/prompts.test.ts`
**Files modified:** `scripts/generate-resume.ts`, `lib/types.ts`, `tests/generate.test.ts`
**Files deleted:** None
**Net effect:** ~166 lines removed from generate-resume.ts, ~80 lines added to loader.ts + types, prompt file is ~170 lines of pure markdown

---

## Phase B: AI Service Layer — Thin, Typed, Observable

**Goal:** Encapsulate Anthropic SDK patterns (streaming, caching, error handling, telemetry) in a reusable service. Not a framework — just clean DRY patterns.

### B1. Create AI client module

Create `lib/ai/client.ts`:

- `createClient()` → wraps `new Anthropic()` with env validation
- `generateWithPrompt(promptId, userMessage, options?)` → loads prompt, calls API with streaming, returns typed result
- Encapsulates: streaming setup, `stream.finalMessage()`, thinking block extraction, cache stat reporting, error classification (401/429/529)
- Returns `GenerationResponse` type with: `text`, `thinkingTokens`, `usage`, `cacheStats`, `durationMs`, `stopReason`, `promptVersion`

### B2. Create telemetry module

Create `lib/ai/telemetry.ts`:

- `GenerationTelemetry` type: tokens, cost estimate, cache hits, duration, model, prompt version, timestamp
- `logGeneration(telemetry)` → structured JSON to `data/generated/.telemetry.jsonl` (gitignored, append-only)
- `estimateCost(usage)` → calculate dollar cost from token counts and model pricing
- Console output formatter for human-readable summaries (replaces current ad-hoc console.log block in generate-resume.ts lines 443-462)

### B3. Refactor generate-resume.ts to use AI service

- Replace lines 327-375 (API call, streaming, block extraction) with `generateWithPrompt("resume-writer", buildUserMessage(careerData))`
- Replace lines 426-462 (telemetry logging) with telemetry module calls
- Replace lines 489-506 (error handling) with AI client's classified errors
- `generate()` function drops from ~210 lines to ~80 lines

### B4. Update compare-resumes.ts

- If `compare-resumes.ts` uses Claude for LLM scoring, refactor it to use the same AI client
- Ensure `compare:judge` benefits from the service layer

**Files created:** `lib/ai/client.ts`, `lib/ai/telemetry.ts`, `lib/ai/index.ts` (barrel export)
**Files modified:** `scripts/generate-resume.ts`, `scripts/compare-resumes.ts`
**Net effect:** generate-resume.ts drops from 506 to ~300 lines. AI patterns become reusable for Phase 2 chat.

---

## Phase C: Ingest Decomposition — Focused Modules

**Goal:** Break the 958-line monolith into composable, testable modules.

### C1. Extract date utilities

Create `lib/ingest/dates.ts`:

- Move `MONTH_MAP`, `normalizeDate()` from ingest-linkedin.ts (lines 59-100)
- Already well-tested with 4+ format variations
- Reusable for any date normalization across the pipeline

### C2. Extract CSV parsing

Create `lib/ingest/csv.ts`:

- Move BOM stripping, PapaParse wrapper, header normalization
- Move ZIP extraction logic (Python3 zipfile call)
- Export: `parseLinkedInCsv<T>(filePath)`, `extractZipArchive(zipPath, targetDir)`

### C3. Extract normalizers

Create `lib/ingest/normalizers.ts`:

- Move all 13 normalize functions: `normalizePositions()`, `normalizeEducation()`, `normalizeSkills()`, etc.
- Each takes raw LinkedIn rows → typed Career\* objects
- Import `normalizeDate` from `dates.ts`, `safeString` as a local helper

### C4. Extract knowledge base loader

Create `lib/ingest/knowledge.ts`:

- Move recursive JSON discovery, `isKnowledgeEntry()`, wrapping logic, `enrichProfileFromKnowledge()`
- Replace ad-hoc `isKnowledgeEntry()` type check with Zod `.safeParse()` using `KnowledgeEntrySchema`
- Add `KnowledgeEntrySchema` to `lib/types.ts` (Zod version of the existing `KnowledgeEntry` interface)

### C5. Extract validation

Create `lib/ingest/validation.ts`:

- Move `CareerDataSchema` (the Zod schema, currently defined inline in ingest-linkedin.ts)
- Move `buildStats()` function
- Export the Zod schema so it's importable by tests and other modules

### C6. Slim down ingest-linkedin.ts

- Becomes an orchestrator: import modules → call in sequence → write output
- Skip logic stays here (it's orchestration, not domain logic)
- Target: ~150-200 lines (down from 958)

### C7. Update tests

- `tests/ingest.test.ts`: Update imports from `_testExports` to direct module imports where possible
- Tests should continue passing unchanged (same functions, new locations)
- Add focused tests for knowledge base Zod validation (backlog item)

**Files created:** `lib/ingest/dates.ts`, `lib/ingest/csv.ts`, `lib/ingest/normalizers.ts`, `lib/ingest/knowledge.ts`, `lib/ingest/validation.ts`, `lib/ingest/index.ts`
**Files modified:** `scripts/ingest-linkedin.ts`, `lib/types.ts`, `tests/ingest.test.ts`
**Net effect:** ingest-linkedin.ts drops from 958 to ~150-200 lines. Each module is independently testable.

---

## Phase D: Knowledge Base Schema Standardization

**Goal:** One canonical schema for all knowledge entries — works for local JSON, pgvector embeddings, and RAG retrieval.

### D1. Audit current knowledge base schemas

Current state (28 files across 4 subdirectories):

- `career/*.json` — Rich structured objects with `id`, `company_id`, `technologies`, `industries`, `sort_order` (NOT KnowledgeEntry format)
- `brand/*.json` — Mix of string arrays (`brand-narratives.json`) and objects
- `strategy/*.json` — Various structured objects
- `agents/*.json` — Agent definitions with `id`, `role`, `purpose`, `prerequisites`, `outputs`, `source_prompt_file`
- `content/*.json` — Various structured content

Only some files follow the `KnowledgeEntry` interface. The ingest currently wraps non-conforming files at load time.

### D2. Design unified KnowledgeDocument type

Add to `lib/types.ts`:

```typescript
// Universal knowledge document — works for JSON files, pgvector rows, and RAG retrieval
interface KnowledgeDocument {
  id: string; // Stable identifier (e.g., "arine-staff-data-ops-2025")
  category: string; // Taxonomy: "career", "brand", "strategy", "agent", "content"
  subcategory: string; // Finer grain: "position", "narrative", "objective"
  title: string; // Human-readable title
  content: string; // Primary text content (for embedding/RAG)
  metadata: Record<string, unknown>; // Structured data preserved from source
  tags: string[]; // For filtering and retrieval
  relatedPositions?: string[]; // Cross-reference to career positions
  source: string; // File path or origin (for provenance)
}
```

This is an evolution of `KnowledgeEntry`, not a replacement. The key additions:

- `id` — stable identifier for deduplication and cross-referencing (many files already have this)
- `subcategory` — finer taxonomy (currently lost when wrapping arbitrary JSON)
- `metadata` — preserves original structured data (currently flattened to string)
- `source` — provenance tracking (which file did this come from)

### D3. Add Zod schema for KnowledgeDocument

Create `KnowledgeDocumentSchema` in `lib/types.ts` — validates at ingest time.
Create `KnowledgeEntrySchema` in `lib/types.ts` — validates the legacy format for backward compat.

### D4. Update knowledge loader

In `lib/ingest/knowledge.ts` (from Phase C4):

- Transform all source formats into `KnowledgeDocument` at load time
- Career positions: `id` from source, `category: "career"`, `subcategory: "position"`, structured fields in `metadata`
- Brand narratives: generate deterministic `id`, `category: "brand"`, `subcategory: "narrative"`, each string becomes a separate document
- Agent definitions: `id` from source, `category: "agent"`, `subcategory: "definition"`, full definition in `metadata`
- Validate with `KnowledgeDocumentSchema.safeParse()`

### D5. Update CareerData to use KnowledgeDocument

Change `knowledge: KnowledgeEntry[]` to `knowledge: KnowledgeDocument[]` in `CareerData`.
Update `buildUserMessage()` in generate-resume.ts to format `KnowledgeDocument[]` for Claude.

### D6. Migration: Convert knowledge base files (optional, future)

Don't rewrite all 28 JSON files now. The loader handles transformation at ingest time. When we're ready for pgvector, we can batch-export normalized `KnowledgeDocument` records.

**Files modified:** `lib/types.ts`, `lib/ingest/knowledge.ts`, `scripts/generate-resume.ts` (buildUserMessage), `tests/ingest.test.ts`
**Net effect:** Universal document model ready for pgvector. No source file changes needed.

---

## Phase E: Context Engineering — Optimize Token Usage

**Goal:** Reduce input tokens, improve context quality, prepare for selective RAG retrieval.

### E1. Optimize career data serialization

Current `buildUserMessage()` dumps the entire CareerData as `JSON.stringify(coreData, null, 2)` — ~50K tokens of indented JSON including empty strings, null values, and irrelevant fields.

Refactor `buildUserMessage()`:

- Strip empty/null fields before serialization
- Use compact JSON (`JSON.stringify(data)` without indentation) — saves ~20% tokens
- Omit rarely-useful fields for resume generation (e.g., `licenseNumber`, `activities`, `cause`)
- Add field-level comments as JSON keys only when values exist

### E2. Structured context sections

Replace single JSON dump with labeled sections in the user message:

```
## Profile
Name: Paul Prae | Location: Buford, GA | Email: hireme@paulprae.com
...

## Positions (16 total, most recent first)
### Staff AI DataOps Engineer — Arine (Sep 2025–Present)
Description: ...
Highlights: ...
Technologies: MLOps, HIPAA, Data Pipelines

## Skills (70)
AI & Machine Learning, Cloud Computing, Python, ...

## Knowledge Context (29 entries, grouped by category)
### Career Achievements
- [arine-staff-data-ops-2025] Leading data operations...
### Brand Narratives
- Drives innovation that serves human flourishing...
```

This gives Claude structured natural language instead of raw JSON — better for reasoning, fewer tokens.

### E3. Token budget estimation

Add to `lib/ai/client.ts`:

- `estimateTokens(text)` — rough estimation (chars / 4 for English text, chars / 3 for JSON)
- Log estimated input tokens before API call
- Warn if estimated input exceeds 80% of context window (currently 200K standard)

**Files modified:** `scripts/generate-resume.ts` (buildUserMessage), `lib/ai/client.ts`
**Net effect:** ~20-30% reduction in input tokens (~15-22K fewer tokens per generation, saving ~$0.05-0.07/run)

---

## Phase F: Prompt Quality Improvements

**Goal:** Higher-quality, more consistent resume output.

### F1. Add few-shot examples to system prompt

Add 2-3 examples of strong vs weak resume bullets to `lib/prompts/resume-writer.system.md`:

```markdown
## Examples of Strong Position Bullets

Weak: "Worked on machine learning projects"
Strong: "Designed and deployed 3 production ML models serving 50M+ health plan members,
reducing manual clinical review time by 40% and generating $2M+ in annual value"

Weak: "Led a team of engineers"
Strong: "Led cross-functional team of 8 engineers delivering HIPAA-compliant AI agents
across 45+ health plans, reducing manual data operations by 60%"
```

### F2. Add section priority guidance

Add explicit priority weighting to the system prompt:

- Professional Summary: Most critical — screened first by recruiters
- Experience: Core content — most resume real estate
- Skills: ATS gating — must include target keywords
- Certifications/Projects/Publications: Supporting evidence — selective inclusion

### F3. Add output format validation

Strengthen `validateResumeOutput()`:

- Check for markdown link syntax validity
- Verify date format consistency (Mon YYYY)
- Check for forbidden patterns (first-person "I", passive voice markers)
- Count action verbs per position (should be ≥2)

**Files modified:** `lib/prompts/resume-writer.system.md`, `scripts/generate-resume.ts`
**Net effect:** More consistent resume quality. Regression-testable via prompt hash + output validation.

---

## Phase G: Backlog Bug Fixes

**Goal:** Clear open backlog items that touch the pipeline.

### G1. Add `github` to CareerDataSchema

In `lib/ingest/validation.ts` (after Phase C5 extraction):

- Add `github: z.string().optional()` to the profile schema
- Currently `CareerProfile` interface has `github?: string` but Zod schema doesn't validate it

### G2. Add enrichProfileFromKnowledge tests

In `tests/ingest.test.ts`:

- Test linkedin URL enrichment from knowledge base
- Test website enrichment
- Test email enrichment
- Test github enrichment
- Test that existing values are not overwritten

**Files modified:** `lib/ingest/validation.ts`, `tests/ingest.test.ts`

---

## Phase H: Skills Architecture Preparation

**Goal:** Design the prompt/skills structure so it maps naturally to Anthropic Agent Skills and the job-finding-assistant prompts.

### H1. Document the skills mapping

Create `lib/prompts/README.md` documenting how local prompt files map to:

- Anthropic Agent Skills (folders of instructions/scripts/resources)
- job-finding-assistant system prompts (6 specialized assistants)
- Future paulprae.com chat interface skills

Mapping table:
| Local Prompt File | job-finding-assistant | Anthropic Skill | Purpose |
|---|---|---|---|
| `resume-writer.system.md` | Stage 4B (resume) | Resume Generation | Generate ATS-optimized resume |
| `brand-voice.system.md` (future) | personal_brand_development | Brand Development | Guide brand voice and positioning |
| `career-coach.system.md` (future) | career_coach_assistant | Career Coaching | Initial consultation and objective gathering |
| `interview-prep.system.md` (future) | job_application_interview | Interview Prep | Interview preparation and strategy |
| `market-positioning.system.md` (future) | job_market_positioning | Market Analysis | Competitive positioning analysis |
| `resume-reviewer.system.md` (future) | (new) | Resume Review | Critique and improve resume drafts |

### H2. Prepare agent-definitions.json integration

The knowledge base already has `agents/agent-definitions.json` with structured definitions referencing `source_prompt_file: "AI_assistants/career_coach_assistant.system.prompt.md"`. This is the bridge to the job-finding-assistant project.

For now: document this mapping. When Phase 2 arrives, the prompt loader can resolve `source_prompt_file` references to load skills from either local files or the job-finding-assistant repo.

**Files created:** `lib/prompts/README.md` (comprehensive skills architecture doc)
**Net effect:** Clear roadmap for skills convergence. No premature implementation.

---

## Implementation Order

Execute phases in this order to minimize risk and maximize incremental value:

```
Phase G (30 min)  → Bug fixes — clear backlog, zero risk
Phase A (2-3 hrs) → Prompt extraction — highest visibility, moderate risk
Phase C (3-4 hrs) → Ingest decomposition — largest file, moderate risk
Phase B (2-3 hrs) → AI service layer — depends on Phase A prompts
Phase E (1-2 hrs) → Context engineering — depends on Phase B client
Phase D (2-3 hrs) → Knowledge schema — depends on Phase C knowledge loader
Phase F (1 hr)    → Prompt quality — depends on Phase A prompt files
Phase H (1 hr)    → Skills architecture — documentation only, depends on Phase A
```

Total estimated effort: ~14-18 hours across multiple sessions.

**After each phase:** Run `npm test` to verify all 245+ tests pass. Run `npm run check:quick` to validate data files.

---

## What This Enables (Phase 2)

After this refactoring, the codebase is positioned for:

1. **Chat interface** — `lib/ai/client.ts` handles streaming; `lib/prompts/` provides skills; `KnowledgeDocument` feeds RAG
2. **Dynamic resume generation** — `generateWithPrompt("resume-writer", jobSpecificContext)` with different user messages per job
3. **pgvector migration** — `KnowledgeDocument` records map directly to embedding rows with metadata
4. **Anthropic Agent Skills** — each `lib/prompts/*.system.md` file is a deployable skill
5. **job-finding-assistant convergence** — skills mapping documented, prompt loader designed for multi-source resolution
6. **Vercel AI SDK integration** — AI service layer can wrap either Anthropic SDK (batch) or Vercel AI SDK (streaming UI) behind the same interface
7. **Cost tracking** — telemetry JSONL enables cost trend analysis and prompt optimization

---

## What We're NOT Doing (Intentionally)

- **No database** — pgvector/Supabase is Phase 2
- **No API routes** — static export stays for Phase 1
- **No Vercel AI SDK yet** — wait for Phase 2 chat interface
- **No LangChain** — too heavy for this use case; Anthropic SDK is sufficient
- **No knowledge base file rewrites** — loader transforms at runtime
- **No CLI framework** — current arg parsing is adequate
- **No multi-agent orchestration** — single-agent pipeline is correct for Phase 1

---

## Verification Plan

After all phases complete:

1. **Tests pass:** `npm test` — all 245+ existing tests pass + new tests added
2. **Pipeline works:** `npm run pipeline` — full ingest → generate → export succeeds
3. **Build works:** `npm run build` — static site builds correctly
4. **Release check:** `npm run check` — full pre-push validation passes
5. **Resume quality:** Generated resume is at least as good as current output (manual comparison)
6. **Code reduction:** `scripts/generate-resume.ts` drops from 506 to ~300 lines; `scripts/ingest-linkedin.ts` drops from 958 to ~200 lines
7. **New test count:** Expect ~270+ tests (up from 245+)

### Critical files to verify:

- `lib/prompts/resume-writer.system.md` — contains extracted system prompt
- `lib/prompts/loader.ts` — prompt loading works correctly
- `lib/ai/client.ts` — API calls work with streaming, caching, telemetry
- `lib/ai/telemetry.ts` — structured logging to .telemetry.jsonl
- `lib/ingest/` — all 6 extracted modules work correctly
- `lib/types.ts` — KnowledgeDocument type added, PromptConfig/PromptMetadata added
- `scripts/generate-resume.ts` — uses AI client + prompt loader
- `scripts/ingest-linkedin.ts` — uses extracted modules
