# Plan: Refactor Resume Generation Pipeline for AI Engineering Excellence

## Context

The paulprae-com resume pipeline is a production-grade 4-stage system (ingest → generate → export → build) that transforms LinkedIn career data into an AI-generated resume via Claude Opus 4.6. Phase 1 is complete and deployed. The code is well-tested (202 tests across 11 files) and functional, but the AI layer was built pragmatically — the system prompt is embedded in a script, knowledge base schemas are ad-hoc, there's no AI service abstraction, and the architecture doesn't position for the next phase: a chat interface with dynamic resume generation, RAG over career data, and convergence with the [job-finding-assistant](https://github.com/Modular-Earth-LLC/job-finding-assistant) project's 6 AI skills.

This refactoring has three goals:

1. **Demonstrate principal AI engineer competence** — clean prompt architecture, proper context engineering, agentic design patterns
2. **Position for Phase 2** — skills-based architecture, RAG-ready data model, pgvector preparation
3. **Maintain simplicity** — the local pipeline must keep working; no premature frameworks

### What prompted this

- Knowledge base already contains `agents/agent-definitions.json` mapping to job-finding-assistant prompts — the bridge exists but isn't utilized
- System prompt (118 lines) is embedded in `generate-resume.ts` — not versionable, not reusable, not testable as a standalone asset
- Knowledge base has 3+ incompatible schemas (KnowledgeEntry, raw arrays, structured career data) — needs standardization before pgvector
- No telemetry beyond console.log — can't track prompt quality, cost trends, or cache effectiveness
- `ingest-linkedin.ts` is 959 lines — monolithic, mixing CSV parsing, date normalization, knowledge loading, and Zod validation

---

## Stakeholder Review Summary

This plan was reviewed by 5 stakeholder personas. Key changes from their feedback:

| Stakeholder      | Role                     | Key Feedback Incorporated                                                                                                                          |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maya Chen**    | VP Engineering           | Added rollback strategy, reduced Phase C from 6→3 modules, added test import migration table, realistic time estimates                             |
| **Raj Patel**    | Staff AI/ML Engineer     | Config inheritance instead of duplication, two-tier AI client API, configurable few-shot examples, empirical testing before context format changes |
| **Sarah Kim**    | DevOps/Platform Engineer | CI impact analysis per phase, telemetry rotation, YAML dependency evaluation, explicit `_testExports` migration strategy                           |
| **David Torres** | Product Manager          | Reordered phases for business value (F first), deferred Phase D to Phase 2, cut Phase H as premature documentation                                 |
| **Lisa Wang**    | QA Lead                  | Added test strategy for AI service layer, snapshot test for context engineering, negative tests for validation, test count targets per phase       |

---

## Rollback Strategy

**After each phase:** Create a tagged commit (`refactor/phase-X-complete`). If the next phase breaks CI:

1. Run `npm test` and `npm run check:quick` to identify failures
2. If unfixable within 30 minutes, revert to the last phase tag
3. Root-cause the failure before reattempting

**Git discipline:** Each phase is a single PR or commit series. Never mix phases in one commit.

---

## Phase 1: Prompt Quality Improvements (Highest Business Value)

**Goal:** Better resume output — the only Phase 1 deliverable recruiters see.

**Rationale (David Torres feedback):** Infrastructure refactoring is invisible to end users. Start with what directly improves the product.

### 1.1. Add few-shot examples to system prompt

Add 2-3 examples of strong vs weak resume bullets directly in the `SYSTEM_PROMPT` constant in `generate-resume.ts`:

```markdown
## Examples of Strong Position Bullets

Weak: "Worked on machine learning projects"
Strong: "Designed and deployed 3 production ML models serving 50M+ health plan members,
reducing manual clinical review time by 40% and generating $2M+ in annual value"

Weak: "Led a team of engineers"
Strong: "Led cross-functional team of 8 engineers delivering HIPAA-compliant AI agents
across 45+ health plans, reducing manual data operations by 60%"
```

**Config option (Raj Patel feedback):** Add a `INCLUDE_FEW_SHOT` constant (default `true`) so Phase 2 chat skills can omit examples to save tokens per conversation turn.

### 1.2. Add section priority guidance

Add explicit priority weighting to the system prompt:

- Professional Summary: Most critical — screened first by recruiters
- Experience: Core content — most resume real estate
- Skills: ATS gating — must include target keywords
- Certifications/Projects/Publications: Supporting evidence — selective inclusion

### 1.3. Strengthen output format validation

Strengthen `validateResumeOutput()`:

- Check for markdown link syntax validity
- Verify date format consistency (Mon YYYY)
- Check for forbidden patterns (first-person "I", passive voice markers)
- Count action verbs per position (should be ≥2)

### 1.4. Tests for new validation rules

Add both positive and negative test cases (Lisa Wang feedback):

- Test that valid resumes pass all new checks
- Test that first-person "I" is caught
- Test that passive voice markers are caught
- Test that missing action verbs are caught
- Test that invalid markdown links are caught

**Quality gate:** Run current pipeline, apply prompt changes, regenerate, compare with `npm run compare -- --judge`. Document scores.

**Files modified:** `scripts/generate-resume.ts`, `tests/generate.test.ts`
**Tests added:** ~8 (target: 210 total)
**Tag:** `refactor/phase-1-complete`

---

## Phase 2: Backlog Bug Fixes

**Goal:** Clear open backlog items that touch the pipeline. Zero risk, immediate value.

### 2.1. Add `github` to CareerDataSchema

In `scripts/ingest-linkedin.ts` (the Zod schema section):

- Add `github: z.string().optional()` to the profile schema
- Currently `CareerProfile` interface has `github?: string` but Zod schema doesn't validate it

### 2.2. Add enrichProfileFromKnowledge tests

In `tests/ingest.test.ts`:

- Test linkedin URL enrichment from knowledge base
- Test website enrichment
- Test email enrichment
- Test github enrichment
- Test that existing values are not overwritten

**Files modified:** `scripts/ingest-linkedin.ts`, `tests/ingest.test.ts`
**Tests added:** ~6 (target: 216 total)
**Tag:** `refactor/phase-2-complete`

---

## Phase 3: Prompt Architecture — Extract, Version, Structure

**Goal:** Prompts become first-class assets — versionable files that map 1:1 to future Anthropic Agent Skills.

### 3.1. Create prompt file format

Create `lib/prompts/` directory with markdown-based prompt files:

```
lib/prompts/
  resume-writer.system.md      ← extracted from generate-resume.ts SYSTEM_PROMPT
  resume-writer.config.json    ← prompt-specific overrides only (see 3.1a)
```

**Prompt file format** (`resume-writer.system.md`):

- YAML frontmatter with metadata: `id`, `version`, `description`, `tags`
- Body is the raw system prompt text (no code, no TypeScript)
- This maps directly to how Anthropic Agent Skills package instructions

**YAML dependency decision (Sarah Kim feedback):** Use `gray-matter` (309B gzipped, zero dependencies, already widely used in Next.js ecosystems) for frontmatter parsing. The alternative — putting metadata in `.config.json` — loses co-location with the prompt text and makes the format non-standard.

**Config inheritance (Raj Patel feedback):** The prompt config file contains **only overrides**, not duplicates of `lib/config.ts` CLAUDE values:

```json
{
  "cacheSystemPrompt": true,
  "includeFewShot": true
}
```

The loader merges: `{ ...CLAUDE_DEFAULTS, ...promptConfig }`. Global model/maxTokens/thinking/effort stay in `lib/config.ts` as the single source of truth. Prompt-specific configs only override when they need different values.

### 3.2. Create prompt loader utility

Create `lib/prompts/loader.ts`:

- `loadPrompt(id: string)` → returns `{ systemPrompt: string, config: PromptConfig, metadata: PromptMetadata }`
- Parses YAML frontmatter from `.system.md` files via `gray-matter`
- Loads corresponding `.config.json` (optional — uses defaults if missing)
- Merges prompt config with global `CLAUDE` config from `lib/config.ts`
- Add `PromptConfig` and `PromptMetadata` types to `lib/types.ts`
- Validates config with Zod (fail fast on invalid settings)

### 3.3. Refactor generate-resume.ts

- Remove embedded `SYSTEM_PROMPT` constant (118 lines)
- Replace with `loadPrompt("resume-writer")` call
- Add `promptVersion` field to `GenerationResult` type (tracks which prompt version produced each output)
- Embed prompt version in the HTML comment header of generated resume files
- Keep `buildUserMessage()` in the script (it's data-specific, not a prompt)

### 3.4. Update tests

**Import migration (Maya Chen + Lisa Wang feedback):**

| Old import                                                 | New import                                 |
| ---------------------------------------------------------- | ------------------------------------------ |
| `_testExports.SYSTEM_PROMPT` (8 tests in generate.test.ts) | `loadPrompt("resume-writer").systemPrompt` |

- `tests/generate.test.ts`: Update the 8 system prompt quality tests to use `loadPrompt()`
- Add `tests/prompts.test.ts` with comprehensive edge cases:
  - Happy path: load valid prompt with frontmatter + config
  - Missing file: throws descriptive error
  - Malformed YAML frontmatter: throws parse error
  - Empty prompt body: throws validation error
  - Missing config file: falls back to global defaults
  - Invalid config values: Zod rejects unknown models
  - Prompt regression: hash the system prompt content and assert stability (catches accidental edits)

**CI impact (Sarah Kim feedback):** No CI changes needed — new test files are auto-discovered by Vitest. New `lib/` files are auto-covered by existing ESLint config.

**Files created:** `lib/prompts/resume-writer.system.md`, `lib/prompts/resume-writer.config.json`, `lib/prompts/loader.ts`, `tests/prompts.test.ts`
**Files modified:** `scripts/generate-resume.ts`, `lib/types.ts`, `tests/generate.test.ts`
**New dependency:** `gray-matter` (YAML frontmatter parser)
**Tests added:** ~12 (target: 228 total)
**Net effect:** ~118 lines removed from generate-resume.ts, ~80 lines added to loader.ts + types, prompt file is ~130 lines of pure markdown
**Tag:** `refactor/phase-3-complete`

---

## Phase 4: Ingest Decomposition — Focused Modules

**Goal:** Break the 959-line monolith into composable, testable modules.

### 4.1. Extract utilities module

Create `lib/ingest/utils.ts` **(Maya Chen feedback — merge small modules):**

Consolidate small extractions that don't justify separate files:

- `MONTH_MAP`, `normalizeDate()`, `normalizeDateOrNull()` (45 lines from dates)
- `stripBOM()`, `parseLinkedInCsv<T>()`, `extractZipArchive()` (25 lines from CSV)
- `safeString()` helper
- `CareerDataSchema` Zod schema, `buildStats()` (110 lines from validation)

Total: ~180 lines. All utility/infrastructure functions in one place.

### 4.2. Extract normalizers

Create `lib/ingest/normalizers.ts`:

- Move all 16 normalize functions: `normalizePositions()`, `normalizeEducation()`, `normalizeSkills()`, `normalizeCertifications()`, `normalizeProjects()`, `normalizePublications()`, `normalizeProfile()`, `extractEmail()`, `normalizeLanguages()`, `normalizeRecommendations()`, `normalizeHonors()`, `normalizeVolunteering()`, `normalizeCourses()`
- Each takes raw LinkedIn rows → typed Career\* objects
- Import `normalizeDate` from `utils.ts`

### 4.3. Extract knowledge base loader

Create `lib/ingest/knowledge.ts`:

- Move recursive JSON discovery, `isKnowledgeEntry()`, wrapping logic, `enrichProfileFromKnowledge()`
- Replace ad-hoc `isKnowledgeEntry()` type check with Zod `.safeParse()` using `KnowledgeEntrySchema`
- Add `KnowledgeEntrySchema` to `lib/types.ts` (Zod version of the existing `KnowledgeEntry` interface)

### 4.4. Slim down ingest-linkedin.ts

- Becomes an orchestrator: import modules → call in sequence → write output
- Skip logic stays here (it's orchestration, not domain logic)
- Target: ~150-200 lines (down from 959)

### 4.5. Update tests — explicit import migration

**\_testExports migration table (Maya Chen + Lisa Wang feedback):**

The 56 tests in `ingest.test.ts` currently import from `_testExports`. Strategy: **rewrite all imports to use direct module imports** (option A). The `_testExports` pattern on `ingest-linkedin.ts` becomes minimal (only orchestration functions). Sub-modules export directly.

| Current `_testExports.*`                                                                                                                                                                                                                                                                     | New import source        | Tests affected |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------- |
| `normalizeDate`, `normalizeDateOrNull`, `safeString`, `stripBOM`                                                                                                                                                                                                                             | `lib/ingest/utils`       | 12 tests       |
| `normalizePositions`, `normalizeEducation`, `normalizeSkills`, `normalizeCertifications`, `normalizeProjects`, `normalizePublications`, `normalizeProfile`, `extractEmail`, `normalizeLanguages`, `normalizeRecommendations`, `normalizeHonors`, `normalizeVolunteering`, `normalizeCourses` | `lib/ingest/normalizers` | 11 tests       |
| `findJsonFiles`, `isKnowledgeEntry`, `wrapAsKnowledgeEntry`                                                                                                                                                                                                                                  | `lib/ingest/knowledge`   | 6 tests        |
| `CareerDataSchema`                                                                                                                                                                                                                                                                           | `lib/ingest/utils`       | 10 tests       |

Remaining `_testExports` on `ingest-linkedin.ts`: `shouldSkipIngest`, `ingest` (orchestration only).

- Add focused tests for knowledge base Zod validation
- Add barrel export: `lib/ingest/index.ts`

**CI impact (Sarah Kim feedback):** No workflow changes. Vitest auto-discovers. ESLint auto-covers new `lib/` paths.

**Files created:** `lib/ingest/utils.ts`, `lib/ingest/normalizers.ts`, `lib/ingest/knowledge.ts`, `lib/ingest/index.ts`
**Files modified:** `scripts/ingest-linkedin.ts`, `lib/types.ts`, `tests/ingest.test.ts`
**Tests added:** ~5 (target: 233 total)
**Net effect:** ingest-linkedin.ts drops from 959 to ~150-200 lines. 3 focused modules instead of 6 micro-modules.
**Tag:** `refactor/phase-4-complete`

---

## Phase 5: AI Service Layer — Thin, Typed, Observable

**Goal:** Encapsulate Anthropic SDK patterns in a reusable service. Not a framework — just clean DRY patterns.

**Depends on:** Phase 3 (prompt loader)

### 5.1. Create AI client module

Create `lib/ai/client.ts` **(Raj Patel feedback — two-tier API):**

- `createClient()` → wraps `new Anthropic()` with env validation
- **Tier 1 — Full pipeline:** `generateWithPrompt(promptId, userMessage, options?)` → loads prompt, calls API with streaming + thinking + caching, returns typed result
- **Tier 2 — Simple call:** `callModel(systemPrompt, userMessage, options?)` → direct API call without streaming/thinking/caching (for LLM judging in compare-resumes.ts and other lightweight calls)
- Both return `GenerationResponse` type with: `text`, `usage`, `durationMs`, `stopReason`
- `generateWithPrompt` additionally returns: `thinkingTokens`, `cacheStats`, `promptVersion`
- Error classification: `ApiKeyError` (401), `RateLimitError` (429), `OverloadError` (529), `GenerationError` (other)

### 5.2. Create telemetry module

Create `lib/ai/telemetry.ts`:

- `GenerationTelemetry` type: tokens, cost estimate, cache hits, duration, model, prompt version, timestamp
- `logGeneration(telemetry)` → structured JSON to `data/generated/.telemetry.jsonl` (gitignored, append-only)
- **Rotation (Sarah Kim feedback):** On write, if file exceeds 100 entries, truncate to most recent 50. Simple and prevents unbounded growth.
- `estimateCost(usage)` → calculate dollar cost from token counts and model pricing
- Console output formatter for human-readable summaries (replaces ad-hoc console.log block in generate-resume.ts)

### 5.3. Refactor generate-resume.ts to use AI service

- Replace API call + streaming + block extraction with `generateWithPrompt("resume-writer", buildUserMessage(careerData))`
- Replace telemetry logging with telemetry module calls
- Replace error handling with AI client's classified errors
- `generate()` function drops from ~210 lines to ~80 lines

### 5.4. Update compare-resumes.ts

- Refactor `judgeSection()` to use `callModel()` (Tier 2) instead of raw Anthropic SDK
- Ensure `compare:judge` benefits from the service layer

### 5.5. Tests for AI service layer

**Test strategy (Lisa Wang feedback):**

Create `tests/ai-client.test.ts`:

- **Unit tests with mocked Anthropic client:** mock `client.messages.stream()` and `client.messages.create()` to return fixture responses
- **Contract tests:** validate `GenerationResponse` shape matches expected type
- **Error classification:** mock 401/429/529 responses, verify correct error types thrown
- **Telemetry:** verify JSONL append format, rotation at 100 entries, cost estimation accuracy

Create `tests/ai-telemetry.test.ts`:

- Telemetry write/read round-trip
- Rotation behavior
- Cost estimation for known token counts

**Files created:** `lib/ai/client.ts`, `lib/ai/telemetry.ts`, `lib/ai/index.ts`, `tests/ai-client.test.ts`, `tests/ai-telemetry.test.ts`
**Files modified:** `scripts/generate-resume.ts`, `scripts/compare-resumes.ts`
**Tests added:** ~15 (target: 248 total)
**Net effect:** generate-resume.ts drops from ~390 (post Phase 3) to ~270 lines. AI patterns reusable for Phase 2 chat.
**Tag:** `refactor/phase-5-complete`

---

## Phase 6: Context Engineering — Optimize Token Usage

**Goal:** Reduce input tokens, improve context quality, prepare for selective RAG retrieval.

**Depends on:** Phase 5 (AI client for token logging)

### 6.1. Optimize career data serialization

Current `buildUserMessage()` dumps the entire CareerData as `JSON.stringify(coreData, null, 2)` — verbose indented JSON including empty strings, null values, and irrelevant fields.

Refactor `buildUserMessage()`:

- Strip empty/null/empty-array fields before serialization
- Use compact JSON (`JSON.stringify(data)` without indentation) — saves ~20% tokens
- Omit rarely-useful fields for resume generation (e.g., `licenseNumber`, `activities`, `cause`)

### 6.2. Structured context sections (with empirical validation)

**(Raj Patel feedback — test before committing):** This is a high-risk change. Before replacing the JSON format:

1. Capture current `buildUserMessage()` output as a baseline
2. Build the new structured format
3. Run both formats through `generateWithPrompt()` on identical career data
4. Compare outputs via `compare-resumes.ts --judge`
5. **Only adopt the new format if LLM judge scores are equal or better**

Proposed structured format:

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
```

If the structured format degrades quality, fall back to compact JSON (step 6.1) which still saves ~20% tokens with no quality risk.

### 6.3. Token budget awareness

**(Sarah Kim feedback — actionable, not just warnings):**

Add to `lib/ai/telemetry.ts` (not client.ts — it's observability, not flow control):

- `estimateTokens(text)` — use `text.length / 4` as rough heuristic (acknowledge it's approximate in the JSDoc)
- Log estimated vs actual tokens after API call (the response includes actual counts)
- **No build-time warnings or failures** — just telemetry data. The actual token count from the API response is what matters; estimation is for pre-flight logging only.

### 6.4. Snapshot test for context format

**(Lisa Wang feedback):** Add a snapshot test that captures the current `buildUserMessage()` output structure:

- Before refactoring: snapshot the output with sample career data
- After refactoring: verify the new format contains all the same entities (every position title, every skill name, every knowledge entry title)
- This is a **data completeness** test, not an exact-match test

**Files modified:** `scripts/generate-resume.ts` (buildUserMessage), `lib/ai/telemetry.ts`
**Tests added:** ~6 (target: 254 total)
**Net effect:** ~20-30% reduction in input tokens. Quality validated empirically before adoption.
**Tag:** `refactor/phase-6-complete`

---

## Deferred to Phase 2 (Intentionally)

### Knowledge Base Schema Standardization (was Phase D)

**(David Torres feedback):** The `KnowledgeDocument` type is designed for pgvector, which is Phase 2. The current knowledge loading works correctly. Spending hours on a schema that won't be used until Phase 2 actually begins is speculative engineering.

**When to do it:** First task of Phase 2, immediately before pgvector integration. By then, the ingest decomposition (Phase 4) will have isolated `lib/ingest/knowledge.ts`, making the schema change straightforward.

### Skills Architecture Documentation (was Phase H)

**(David Torres feedback):** A README mapping local prompts to hypothetical future skills is a roadmap in a README. CLAUDE.md already documents the Phase 2/3 vision. The `lib/prompts/README.md` created in Phase 3 should document the **current** prompt format convention, not speculative future skills.

**When to do it:** When the second prompt file is actually created (Phase 2 chat skill).

---

## Implementation Order

Execute phases in this order, optimized for business value first, then infrastructure:

```
Phase 1 (2 hrs)   → Prompt quality — direct resume improvement, highest business value
Phase 2 (1 hr)    → Bug fixes — clear backlog, zero risk
Phase 3 (3-4 hrs) → Prompt extraction — highest architectural visibility
Phase 4 (4-6 hrs) → Ingest decomposition — largest file, test import rewiring
Phase 5 (3-4 hrs) → AI service layer — depends on Phase 3 prompts
Phase 6 (2-3 hrs) → Context engineering — depends on Phase 5 client, requires empirical testing
```

Total estimated effort: ~16-20 hours across multiple sessions.

**After each phase:**

1. Run `npm test` — all existing tests pass + new tests added
2. Run `npm run check:quick` — data files valid
3. Create tagged commit: `refactor/phase-N-complete`
4. If pipeline uses API: run `npm run pipeline` to verify end-to-end

---

## What This Enables (Phase 2)

After this refactoring, the codebase is positioned for:

1. **Chat interface** — `lib/ai/client.ts` handles streaming; `lib/prompts/` provides skills
2. **Dynamic resume generation** — `generateWithPrompt("resume-writer", jobSpecificContext)` with different user messages per job
3. **pgvector migration** — knowledge loader is isolated in `lib/ingest/knowledge.ts`, ready for `KnowledgeDocument` schema
4. **Anthropic Agent Skills** — each `lib/prompts/*.system.md` file is a deployable skill
5. **job-finding-assistant convergence** — prompt loader designed for multi-source resolution
6. **Vercel AI SDK integration** — AI service layer can wrap either Anthropic SDK (batch) or Vercel AI SDK (streaming UI)
7. **Cost tracking** — telemetry JSONL enables cost trend analysis and prompt optimization

---

## What We're NOT Doing (Intentionally)

- **No database** — pgvector/Supabase is Phase 2
- **No API routes** — static export stays for Phase 1
- **No Vercel AI SDK yet** — wait for Phase 2 chat interface
- **No LangChain** — too heavy for this use case; Anthropic SDK is sufficient
- **No knowledge base file rewrites** — loader transforms at runtime
- **No knowledge base schema standardization** — deferred to Phase 2 (when pgvector needs it)
- **No skills architecture documentation** — deferred until second prompt file exists
- **No CLI framework** — current arg parsing is adequate
- **No multi-agent orchestration** — single-agent pipeline is correct for Phase 1
- **No token estimation library** — heuristic is sufficient for telemetry; actual counts come from API response

---

## Verification Plan

After all phases complete:

1. **Tests pass:** `npm test` — all existing tests pass + ~52 new tests (target: 254+)
2. **Pipeline works:** `npm run pipeline` — full ingest → generate → export succeeds
3. **Build works:** `npm run build` — static site builds correctly
4. **Release check:** `npm run check` — full pre-push validation passes
5. **Resume quality:** Run `npm run compare -- --judge` on pre-refactoring vs post-refactoring output. Scores must be equal or better.
6. **Code reduction:** `scripts/generate-resume.ts` drops from 507 to ~270 lines; `scripts/ingest-linkedin.ts` drops from 959 to ~200 lines
7. **New test count:** ~254+ tests (up from 202)

### Test count targets per phase (Lisa Wang feedback):

| Phase                         | New tests | Running total |
| ----------------------------- | --------- | ------------- |
| Phase 1: Prompt quality       | +8        | 210           |
| Phase 2: Bug fixes            | +6        | 216           |
| Phase 3: Prompt architecture  | +12       | 228           |
| Phase 4: Ingest decomposition | +5        | 233           |
| Phase 5: AI service layer     | +15       | 248           |
| Phase 6: Context engineering  | +6        | 254           |

### Critical files to verify:

- `lib/prompts/resume-writer.system.md` — contains extracted system prompt
- `lib/prompts/loader.ts` — prompt loading works correctly with config inheritance
- `lib/ai/client.ts` — two-tier API: `generateWithPrompt()` + `callModel()`
- `lib/ai/telemetry.ts` — structured logging with rotation
- `lib/ingest/utils.ts` — dates, CSV, validation utilities
- `lib/ingest/normalizers.ts` — all 16 normalize functions
- `lib/ingest/knowledge.ts` — knowledge loading with Zod validation
- `lib/types.ts` — PromptConfig/PromptMetadata added, KnowledgeEntrySchema added
- `scripts/generate-resume.ts` — uses AI client + prompt loader
- `scripts/ingest-linkedin.ts` — uses extracted modules, slim orchestrator
