# Remaining Phases — Writing Rules SSOT Consolidation

> **Branch:** `feat/custom-resume-gen` (PR #37)
> **Author:** Claude Opus 4.6 (1M context), 2026-04-11 session
> **Companion:** `.claude/plans/mega-merge-strategy.md` (incoming on `feat/autonomize-ai-career-update`)
> **Full plan:** `C:\Users\paulp\.claude\plans\majestic-gathering-wolf.md` (user-home path, full 55-step plan with verbatim task breakdowns)

## Context

This document captures the remaining work for the Writing Rules SSOT refactor and the NVIDIA cover letter polish, after a long autopilot session that completed Phase 0 (data corrections) and Phase B (NVIDIA content iteration to 95%/92%) plus the highest-value Phase A2 item (validator extraction). The rest of Phase A — schema v2, prompt hydration, prompt cutovers, duplication removal — is planned but not yet implemented.

**Why this file exists in the repo:** a parallel agent is running `mega-merge-strategy.md` which merges this branch into a UAT branch. That agent needs a machine-readable plan for what's pending on this branch so they can either (a) wait for these phases to land before merging or (b) merge as-is and schedule Phase A completion as a follow-up PR on main. This file is the handoff.

---

## Lessons learned 2026-04-11 — why this plan is getting expanded

The 2026-04-11 sessions surfaced three systemic failures that the original plan did not anticipate. Each one generated hours of churn and risked shipping fabricated content to a recruiter. The added phases below (Phase 0.5, A6, A7, A8, A9) exist specifically to make fact correction trivial, grounding robust, and context poisoning impossible in future sessions.

### Failure mode 1: multi-copy fact storage

A single career fact ("Hyperbloom Jun 2021 – Aug 2025") lives in **~11 physical locations** in this repo:

1. `data/sources/knowledge/career/positions.json` (intended source of truth for positions)
2. `data/sources/knowledge/career/projects.json` (also has Hyperbloom as a project entry)
3. `data/sources/knowledge/career/position-metrics.json` (narrative describing duration)
4. `data/generated/career-data.json` top-level `positions[]` array
5. `data/generated/career-data.json` top-level `projects[]` array
6. `data/generated/career-data.json` `knowledge[23].content` — embedded JSON string copy of positions.json from last ingest
7. `data/generated/career-data.json` `knowledge[25].content` — embedded JSON string copy of projects.json from last ingest
8. `data/generated/Paul-Prae-Resume.md` (generated resume)
9. `public/Paul-Prae-Resume.md` (deployed copy served by Vercel)
10. `data/generated/tailored/Paul-Prae-Resume-NVIDIA.md` (tailored generation)
11. `data/prompts/tailored/nvidia.json` `additionalContext` prose

Plus the pinned assertions in `tests/data-consistency.test.ts` and the memory file in `~/.claude/projects/.../memory/user_career_timeline.md`. So ~13 places total per fact.

Correcting one date during the 2026-04-11 sessions required ~40 individual edits across these files. A Python script helped with the surgical JSON-string replacements in `career-data.json` `knowledge[].content`, but the script was one-off and ad-hoc.

**Root cause:** the `loadKnowledgeBase()` ingest function wraps every JSON file in the knowledge directory as an embedded content string and stores it inside `career-data.json.knowledge[]`. This creates a snapshot that drifts from the source once `positions.json` / `projects.json` / etc. are edited without re-running ingest.

**Phase 0.5 (new)** solves this with an atomic facts canonical store: one file holds each fact exactly once, and every derived view is regenerated from it.

### Failure mode 2: context poisoning via memory files

During the 2026-04-11 sessions, I wrote a memory file `user_career_timeline.md` early in session 1 containing initial-guess dates. Later in the same session I learned the actual dates from LinkedIn CSV and updated the code — but I did not update the memory file. It stayed stale.

Session 2 loaded memory into a fresh context, read the stale dates, and "corrected" the correct career-data.json back to the wrong values (commit `ea3e074`, reverted by `dd342a1`). Paul caught it within minutes, but it could easily have shipped.

**Root cause:** memory files are treated as authoritative by fresh sessions because they have no explicit freshness stamp, no provenance chain, and no test that compares their claims against the current source state.

**Phase 0.5** includes a memory hygiene rule: memory files with fact claims must include a `last_verified_against_source` date and a note directing future readers to verify before acting. A CI check flags any memory file with stale facts.

### Failure mode 3: LLM grader self-consistent with fabrications

The content grader (`scripts/grade-content.ts`) uses an LLM-as-judge pattern: inject the resume + `writing-rules.json` + grounded sources (`companies.json` + `position-metrics.json`), ask Claude to find rule violations. After Phase B4 enhancements, it scored the NVIDIA resume at 95% with zero critical violations.

But the grader **never caught** that Hyperbloom was listed as starting Jan 2020 while Paul was employed at AWS. Or that NeuroLex was listed as Jan 2018 – May 2020 overlapping both Slalom and AWS. Why? Because all the grounded sources had the same wrong data. The grader's grounding check is "does this claim exist in the grounded sources". If a fabrication exists in the grounded sources, the grader certifies it as verified.

This is a fundamental limitation of LLM-as-judge for fraud detection. **You cannot detect a fabrication by cross-checking against grounded sources if the grounded sources are also fabricated.**

**Root cause:** the grader has no invariant-level checks. It only has structural (regex) and semantic (LLM judgment) layers. There's no "cannot happen in physical reality" layer.

**Phase A6 (expanded)** adds a deterministic invariant checker as a third quality layer: position overlaps, temporal consistency, required fields, referential integrity. These run before the validator and grader.

**What's already done (see PR #37 commit history):**

- Phase 0A: Career timeline corrections (Arine Sep 2025→Mar 2026, Hyperbloom Jan 2020→Aug 2025, Autonomize entry). **Note:** these are the AUTHORITATIVE dates confirmed by Paul 2026-04-11 after a regression-and-revert cycle. See `tests/data-consistency.test.ts` for pinned assertions that block any future session from silently regressing them.
- Phase 0B: `tests/data-consistency.test.ts` catching date drift and suppressed-skill leakage
- Phase B1: Grader persists reports to `*.grade.json` alongside source
- Phase B4: Grader injects `companies.json` + `position-metrics.json` as grounded sources (eliminates verification-flag noise)
- Phase B2: NVIDIA resume 32/40 → 38/40 (95%), zero critical violations
- Phase B3: NVIDIA cover letter 41/50 → 46/50 (92%), zero critical violations
- Phase A2 partial: `lib/resume-validator.ts` extracted from `scripts/generate-resume.ts`, wired into `scripts/generate-tailored-resume.ts` in warn-only mode
- Pre-existing Windows compatibility bugs fixed (`validate-docs.ts` path separators, `release-check.ts` npx spawn)

---

## Residual quality items to address

### CL5 parallel-structure warning on cover letter

The current NVIDIA cover letter grade (47/50, 94% after the NeuroLex fix) has one remaining warning: the body paragraphs use an "At [Company], I did X" / "Through [Company], I..." pattern across multiple paragraphs. The grader flagged this as mechanical rhythm that signals AI generation (rule CL5: Human-written feel).

**This is purely a rhythm issue, not a factual or grounding issue.** The content is correct; the cadence is slightly formulaic.

**Resolution options, ordered by cost-effectiveness:**

1. **Hand-rewrite (Paul, ~10 minutes, free, highest quality).** A human editor varies paragraph openings — start one with an accomplishment, another with a year, another with a project name, compose a sentence spanning two companies in one arc. This is the preferred path when Paul is available. Track the edited version in `data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md` and add a comment marker at the top: `<!-- HAND-EDITED 2026-04-xx for CL5 rhythm; do not regenerate without re-applying these edits -->`.

2. **Add a negative directive to `nvidia.json.additionalContext` and regenerate (~$2.30, 60 seconds, good quality).** Directive text: `"Do NOT start every body paragraph with 'At [Company]'. Vary paragraph openings: start one with an accomplishment phrase, another with a year or project name, at least one with a compound sentence spanning two companies. The three employer sides of the GSI story (AWS co-sell, Slalom/Booz Allen/Hyperbloom consulting, Arine/healthcare depth) should not all open the same way."` Use only if Paul cannot hand-edit.

3. **Add a deterministic CL5 check to `lib/resume-validator.ts`** (Phase A4 or standalone). Pseudo-code:

   ```typescript
   const coverLetterParagraphs = markdown.split(/\n\n+/);
   const bodyParas = coverLetterParagraphs.filter((p) => /^[A-Z]/.test(p) && p.length > 100);
   const openingPhrases = bodyParas.map(
     (p) => p.match(/^(At|Through|Running) ([A-Z][a-zA-Z ]+)/)?.[0],
   );
   const duplicateOpeners = openingPhrases.filter(
     (o) => o && openingPhrases.filter((x) => x?.startsWith(o.split(" ")[0])).length > 2,
   );
   if (duplicateOpeners.length > 0)
     warnings.push(
       "CL5 rhythm: 3+ paragraphs share the same opening pattern. Vary paragraph openings.",
     );
   ```

   This runs deterministically on every generation and blocks submission if the pattern exceeds threshold. Zero cost, zero LLM calls.

4. **Retune the CL5 rule in `writing-rules.json` v2 to be less strict for cover letters under ~500 words.** Short cover letters naturally have less room for rhythm variation. If the current rule fires too often on good content, tune the threshold.

**Recommendation:** Option 1 for the current NVIDIA submission (Paul's hand edit), Option 3 as a Phase A4 addition so future generations don't regress. Options 2 and 4 are fallbacks.

---

## Grader + Validator: separation of concerns

There are currently **two content-quality systems** with overlapping rule sources that must stay in sync. Today they both load `writing-rules.json` directly, each via their own inline loader. That's duplication; it drifts.

### Current state (after Phase A2 partial)

| System        | File                       | Type                              | Speed   | Cost | When it runs            | Output                                               |
| ------------- | -------------------------- | --------------------------------- | ------- | ---- | ----------------------- | ---------------------------------------------------- |
| **Validator** | `lib/resume-validator.ts`  | Deterministic regex/string checks | ~5ms    | $0   | Every resume generation | `string[]` warnings, non-blocking                    |
| **Grader**    | `scripts/grade-content.ts` | LLM-as-judge (Claude Opus 4.6)    | ~60-90s | $2-3 | On-demand, explicit CLI | JSON report with severity levels, blocks on critical |

These are **fundamentally different kinds of checks** and should stay separate:

- The validator catches **structural** issues: missing sections, passive voice, cliches, first-person leakage, suppressed-skill mentions, numeric date formats, malformed markdown, recency-tier bullet minimums, action-verb coverage, cross-entity conflation patterns. Fast, cheap, runs always.
- The grader catches **semantic** issues: compound claims across companies, editorial commentary, tense mismatches the regex can't catch, grounded-source verification against company metrics, stylistic rhythm (CL5), rule interpretation that requires judgment.

**Decision: keep them separate but unify their data source.**

### Target state (Phase A1 + Phase A2 completion)

```
┌──────────────────────────────────────────────┐
│      data/sources/knowledge/content/         │
│           writing-rules.json v2               │  <-- single source of truth
│  (rules + data + format + prose per rule)   │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│         lib/writing-rules.ts                  │
│  Typed loader (Zod-validated)                 │
│  - loadWritingRules()                         │
│  - getRulesFor(context)                       │
│  - getBlocklist(kind)                         │
│  - getFormat(context)                         │
│  - getSuppressedSkills()                      │
│  - getAcronymExpansions()                     │
│  - getRulesForGrading()  // excludes data/format for grader payload│
└──────┬───────────────────┬───────────────────┘
       │                   │
       ▼                   ▼
┌──────────────────┐  ┌─────────────────────────┐
│ lib/resume-      │  │ scripts/grade-content.ts │
│   validator.ts    │  │                         │
│                  │  │  Uses:                   │
│  Uses:           │  │   - getRulesForGrading  │
│   - getBlocklist │  │     (narrative rules)    │
│   - getFormat    │  │   - Grounded sources     │
│   - getSuppressed│  │     (companies, metrics) │
│     Skills       │  │                         │
│                  │  │  (still reads full JSON  │
│  (deterministic  │  │   as a string for the    │
│   regex checks)  │  │   judge prompt)          │
└────────┬─────────┘  └────────────┬────────────┘
         │                         │
         ▼                         ▼
  validateResume()          gradeContent()
  - pre-commit              - pre-submission
  - generation pipeline     - iteration gate
  - warn-only               - blocking on critical
```

**Rationale for the split:**

- **Pipeline ergonomics:** you want the validator running on every generation (cheap, fast) but only the grader on submission iterations (expensive, thoughtful). A single merged tool would either be too slow for pipelines or too shallow for submission review.
- **Error class separation:** a regex validator will never catch "this bullet fuses two companies' metrics semantically" and an LLM grader will over-flag "30M members" as unverified every time unless grounded. Each tool is optimal for its layer.
- **Diffable reports:** grader results persist to `*.grade.json`; validator results are ephemeral warnings in stdout. They serve different review cadences.
- **AI pipeline conventions:** this mirrors the standard LLM app pattern of fast-path sanity + slow-path judgment (e.g., linter + type-checker + integration test layering). Merging them would be a regression.

### Where the systems currently interface poorly

Today both tools are coupled to the raw JSON file shape, not to a typed loader:

- `lib/resume-validator.ts:loadSuppressedSkills` — inline `require('fs').readFileSync` on `writing-rules.json`, supports both `suppress_from_output.skills` and `data.suppress_from_output.skills`
- `scripts/grade-content.ts:loadWritingRules` — inline `fs.readFileSync` + `JSON.parse`
- `scripts/grade-content.ts:loadGroundedSources` — inline loaders for `companies.json` + `position-metrics.json`
- `lib/tailored.ts:loadWritingRules` — yet another inline loader (legacy, marked for removal in Phase A5)

**Four independent loaders for the same JSON file.** This is the drift surface the Phase A1 `lib/writing-rules.ts` eliminates.

---

## Remaining phases (ordered)

### Phase 0.5 — Atomic facts canonical store (NEW, highest priority)

Goal: one file per fact class, each fact existing in exactly one place, all derived views regenerated from the canonical source. Eliminates the multi-copy fact storage problem that caused both 2026-04-11 fraud incidents.

Target structure:

```
data/facts/
├── career.yaml              # the ONLY place human-authored career facts live
├── companies.yaml           # company-level metrics with metricsAsOf + provenance
├── content-rules.yaml       # writing rules (migrated from writing-rules.json v2)
└── README.md                # instructions: "edit this directory; everything else is derived"
```

**Canonical fact record schema** (applied to every position, company, project, metric):

```yaml
- id: hyperbloom # stable slug, referenced everywhere downstream
  type: position
  title: "Chief AI Officer, Founder"
  company_id: hyperbloom # foreign key into companies.yaml
  start: 2021-06 # ISO YYYY-MM, inclusive
  end: 2025-08 # ISO YYYY-MM, inclusive; null if is_current
  is_current: false
  employment_type: self-employed # one of: full-time, part-time, self-employed, contract, internship
  provenance:
    source: self-attested
    witness: Paul Prae
    recorded_at: 2026-04-11
    last_verified_at: 2026-04-11
    notes: "Corrected from stale LinkedIn CSV data that showed Jan 2020. Paul founded Hyperbloom the month after leaving AWS."
  description: "Own IT services and consulting business..."
  highlights:
    - id: hb-ft-growth
      text: "Grew the business to $1.4M ARR from a $40K initial investment."
      metric_refs: [hyperbloom.metrics.arr, hyperbloom.metrics.initial_investment]
      provenance: self-attested
    - id: hb-florence-dr
      text: "Architected disaster recovery for Florence Healthcare's clinical-trial platform."
      scope_boundary: "Florence's 10,000+ sites / 5.5M monthly activities describe Florence's platform scale, NOT Paul's personal scope. Paul's contribution was DR architecture design."
      metric_refs: [] # no Paul-owned metrics
```

**Derived views** (all generated from the canonical store, never hand-edited):

- `data/generated/career-data.json` — legacy shape for consumers that still read it. Regenerated by `npm run ingest` from `data/facts/`. Marked with a header: `GENERATED_FROM: data/facts/career.yaml at commit <sha>`. A pre-commit hook rejects direct edits.
- `data/sources/knowledge/career/positions.json` — **deprecated**. Migration path: read-only shim that projects `data/facts/career.yaml` into the v1 shape, for any external consumer still relying on it. Long-term: deleted.
- `data/sources/knowledge/career/projects.json`, `position-metrics.json` — same treatment.
- `data/generated/Paul-Prae-Resume.md`, `public/Paul-Prae-Resume.md`, tailored resumes — regenerated from facts via the generation pipeline.

**Steps:**

1. Create `data/facts/career.yaml` by consolidating every current career fact in the repo. This is a one-time manual migration with Paul's direct review — every date, title, employer, metric must be signed off. Every fact gets a provenance block.
2. Create `data/facts/companies.yaml` similarly for company-level facts and metrics.
3. Write `lib/facts-loader.ts` — typed Zod-validated loader, zero side effects, read-only.
4. Write `scripts/derive-career-data.ts` — reads `data/facts/*.yaml`, emits `data/generated/career-data.json` in the legacy shape. Runs on `npm run ingest` (replacing the LinkedIn CSV parser for the structured-data path) and on `npm run build:prompts`.
5. Add pre-commit hook that rejects hand-edits to derived files. The hook checks a sha hash of the canonical source at the top of each derived file and fails the commit if the derivation is stale.
6. Add `tests/facts-consistency.test.ts` — every company_id reference in career.yaml resolves to a company in companies.yaml; every metric_ref resolves; no orphans.
7. Delete or deprecate the old source files (`positions.json`, `projects.json`, `position-metrics.json`, `companies.json`) once all consumers migrate.

**Risk:** existing consumers read from the old paths. Migration must be gradual with deprecation warnings, not a flag day.

**Payoff:** a fact correction becomes one edit to `data/facts/career.yaml` + one `npm run ingest`. No more 40-edit multi-file surgeries.

### Phase A1 — Extend `writing-rules.json` to v2 schema

Goal: single loader, typed, consumed by validator + grader + prompt hydration. Backward-compatible with v1 so existing consumers keep working during the transition.

Steps (commit per step):

1. Create `lib/writing-rules-schema.ts` with Zod schema for v2 structure. Support v1 and v2 in the parser so old files still load.
2. Create `lib/writing-rules.ts` with the typed loader API described above. Add unit tests `tests/writing-rules.test.ts` (loader parses v1 and v2, `getRulesFor("resume")` vs `getRulesFor("chat")` return different sets, `applies_to` filter works, `getRulesForGrading()` excludes `data.*`/`format.*`).
3. Extend `writing-rules.json` in place: bump version to `2.0`, **add** `data`/`format` sections without removing v1 fields. Existing consumers (`grade-content.ts`, `lib/tailored.ts`) still work because their inline readers see the v1 fields they already read.
4. Populate `data.action_verbs.preferred` as the unified 26+ verb list (resolves the 20 vs 26 drift bug between `resume-writer.system.md:38` and the old `generate-resume.ts:261`).
5. Populate `data.phrase_blocklist` with cliches, invented compounds, passive markers, violence verbs (move from the hardcoded arrays in `lib/resume-validator.ts`).
6. Populate `data.acronyms.safe` and `data.acronyms.spell_out_first_use` (AI, ML, AWS, API on the safe list; SBIR, ETL, CDC, CDISC, SDTM, ADaM, DBHDD on spell-out).
7. Move `suppress_from_output.skills` under `data.suppress_from_output.skills`. Keep a v1-compat shim so the root-level field still resolves.
8. Populate `format.resume`, `format.cover_letter`, `format.chat`, `format.job_tools` with the numeric/enum parameters currently in prompts or code.
9. Add `prose` field to each rule object containing the hand-crafted paragraph from the current system prompts (single most important risk mitigation — see Phase A4).
10. Add `applies_to` field to each rule (`["resume"]`, `["cover_letter"]`, `["chat", "job_tools", "resume", "cover_letter"]`, etc.).
11. Refactor `lib/resume-validator.ts` internals to call `lib/writing-rules.ts` helpers instead of its own `loadSuppressedSkills` + hardcoded arrays.
12. Refactor `scripts/grade-content.ts:loadWritingRules` to use the typed loader, and switch its injected payload to `getRulesForGrading()` so the grader sees only narrative rules (not regex arrays or format enums).
13. Run full test suite + `npm run check`. Gate: all green.

**Risk:** Phase A1 is additive; no consumer breaks during the transition. The v1 shim lets the old inline loaders keep reading even after the schema bump.

### Phase A3 — Prompt hydration helpers

14. Create `lib/prompts/hydrate-rules.ts` with rendering functions: `renderRulesAsProse(context)`, `renderActionVerbList()`, `renderFormatBlock(context)`, `renderPhraseBlocklistProse()`, `renderSuppressedSkillsNote()`. These concatenate the `prose` fields from v2 rules filtered by `applies_to`, so the output is identical to what's currently inline in the `.system.md` files.
15. Add placeholder substitution to `lib/agent/context.ts:buildSystemPrompt` for `{{WRITING_RULES_PROSE}}`, `{{ACTION_VERBS}}`, `{{FORMAT_RULES_PROSE}}`, `{{SUPPRESSED_SKILLS}}`, `{{PHRASE_BLOCKLIST_PROSE}}`. Each mode (chat, tools, resume-generator) gets only the placeholders that apply.
16. Add `tests/hydrate-rules.test.ts`: every rule ID appears in the rendered output for its applicable contexts; no unsubstituted `{{...}}` placeholders remain; emoji-forbidden modes mention emojis in the rendered prose.
17. Add `tests/system-prompts-snapshot.test.ts` as the **cache-key canary**: snapshot `lib/generated/system-prompts.ts` output. If future changes to `writing-rules.json` or `hydrate-rules.ts` change the rendered prompt, this test fails loudly so you don't silently bust the Anthropic prompt cache and double your API bill.
18. Run `npm run build:prompts` to regenerate `lib/generated/system-prompts.ts`. With placeholders added but `.system.md` files not yet cut over, the output should be byte-identical to the previous state. If it's not, step 15 has a bug.

### Phase A4 — Cutover system prompts (lowest-risk-first)

Each cutover is a single commit with a regenerate + grade gate. Order matters: start with the prompts where regressions are most visible and cheapest to fix, save `resume-writer.system.md` for last.

19. **Cutover `lib/prompts/career-chat.system.md`** — replace inline G1-G10 + no-emoji rule + formatting block with `{{WRITING_RULES_PROSE}}` + `{{FORMAT_RULES_PROSE}}`. Smoke-test in dev: `npm run dev`, send 3 representative chat queries, verify no emoji / third-person / scope violations.
20. **Cutover `lib/prompts/job-tools.system.md`** — replace voice rules and format constraints. Leave the STAR/AIDA/PAS content-type instructions inline — those are prompt-shape, not universal rules. Test by generating one cover letter via `/tools`.
21. **Cutover `lib/prompts/cover-letter-writer.system.md`** — replace voice/grounding blocks with placeholders. Regenerate NVIDIA cover letter with `--force`, re-grade. **Gate:** score must not drop more than 1 point from the current 46/50.
22. **Cutover `lib/prompts/resume-writer.system.md`** — highest risk, biggest payoff. Replace `<brand_voice>` DO/DONT lists (lines 31-47), `<quality_rules>` Rules 1-10 (lines 138-217), `<acceptance_criteria>` (lines 231-244) with `{{ACTION_VERBS}}` + `{{PHRASE_BLOCKLIST_PROSE}}` + `{{FORMAT_RULES_PROSE}}` + `{{WRITING_RULES_PROSE}}`. Keep structural sections inline (`<resume_format>`, `<tailoring_strategy>`, `<knowledge_base_strategy>`, `<security_rules>`, `<output_instructions>`). Regenerate main resume AND NVIDIA resume. Diff both outputs against pre-cutover. Run grader. **Gate:** grader score drop ≤1 point, validator warning count ≤ previous count + 1.

### Phase A6 — Career invariant checker (fraud prevention, HIGH PRIORITY)

**Motivation:** During the 2026-04-11 sessions, Paul caught two fraud-detection issues (Hyperbloom Jan 2020→Jun 2021, NeuroLex/Decooda Jan-May 2020→Feb-Jul 2018). Both were pre-existing drift from stale LinkedIn CSV data. The existing validator and grader did not catch them because no check looked at "can this happen in physical reality". Paul had to spot them by manual review. The second round took only minutes to find but required ~40 hand-edits to fix because of the multi-copy fact storage problem (see Phase 0.5).

**Phase A6 adds a third quality layer below the validator and grader: invariant checks.** These run **before** generation, not just after. They catch impossible data states, not just stylistic issues. They are fast (milliseconds), deterministic (no LLM calls), and run on every pipeline step.

New file: `lib/career-invariants.ts` with a `checkCareerInvariants(careerData) → Violation[]` entry point. All invariants:

**Temporal invariants:**

1. **Full-time roles at different companies cannot overlap.** If `posA.employment_type === "full-time"` and `posB.employment_type === "full-time"` and `posA.company_id !== posB.company_id` and the date ranges intersect, flag critical.
2. **Self-employed can overlap anything.** Own-business roles legitimately coexist with employment.
3. **Part-time can overlap full-time.** Moonlighting is legitimate (see NeuroLex moonlighting at Decooda).
4. **Contract and internship can overlap** other roles and each other.
5. **`is_current: true` implies `end: null`.** Any position with both is stale.
6. **`end` must be >= `start` for every position.**
7. **Consecutive positions have a gap or touch.** If two positions at different employers are "back-to-back" without a gap, flag info (could be legitimate but worth reviewing).

**Referential integrity:**

8. **Every `company_id` resolves** to an entry in `companies.yaml`.
9. **Every `metric_ref`** in a highlight resolves to a metric field in `companies.yaml` or a self-owned metric declared in the position itself.
10. **Every `position_id`** in a project resolves to a position.

**Metric freshness:**

11. **Company metrics with `metricsAsOf` older than 24 months** flag as stale (informational, not blocking).

**Scope boundaries:**

12. **Every highlight with scope-boundary language** (e.g., "client platform serves X") must have a `scope_boundary` field documenting that the metrics belong to the client, not to Paul personally. Detected by regex patterns like `\b(client|customer|platform)\s+serves\b` applied to highlight text.

**Suppressed skills:**

13. **No suppressed skill appears in any `highlights[].text`** — already handled in `tests/data-consistency.test.ts`, but lifted into the invariant checker so it blocks generation instead of only failing tests.

**Proposed integration:**

```typescript
// Integrates into BOTH pipelines before generation:

// scripts/generate-resume.ts
import { checkCareerInvariants } from "../lib/career-invariants.js";

const violations = checkCareerInvariants(careerData);
const criticals = violations.filter((v) => v.severity === "critical");
if (criticals.length > 0) {
  console.error("❌ Career data invariant violations — aborting generation:");
  for (const v of criticals) console.error(`   ${v.message}`);
  process.exit(1);
}
```

**Test coverage:**

- `tests/career-invariants.test.ts` — synthesized fixtures for each rule
- Two regression fixtures specifically for the 2026-04-11 incidents: "Hyperbloom starts during AWS" and "NeuroLex spans Slalom+Decooda+AWS". Both must trigger critical violations.

**Priority:** HIGH (upgraded from Medium). Both historical issues are pinned by hardcoded tests in `tests/data-consistency.test.ts`, but those tests only catch the specific regressions. A general invariant checker catches future fraud that hasn't happened yet — e.g., if Paul takes a new role that overlaps another, or if an ingest from LinkedIn imports stale data, the invariants fail before the resume is generated. This is the single highest-leverage piece of fraud prevention.

---

### Phase A7 — RAG-style fact injection for generation (token efficiency + grounding)

**Motivation:** The current tailored resume generation injects the entire `career-data.json` (~20KB) + `companies.json` (~5KB) + `writing-rules.json` (~10KB) + knowledge entries (~15KB — which are duplicate snapshots of positions.json/projects.json/etc.) + writing rules again (~2KB via CRITICAL REMINDERS) into every user message. That's ~50KB of user-message content per generation. The system prompt adds another ~30KB. Most of the content injected is **not relevant** to the specific target role — e.g., NVIDIA's Healthcare GSI Lead doesn't need Paul's music engineering history.

More importantly, the current injection pattern is **unstructured**. The LLM sees a blob of JSON and prose. It has no explicit signal about which facts are authoritative vs. supplementary, which metrics are verified vs. estimated, or which highlights belong to which scope boundary. This contributes to both fraud (no per-fact provenance) and token waste (same fact injected 3-4 times via different files).

**Target: RAG-style retrieval over the atomic facts store, with explicit fact IDs and provenance in the prompt.**

Implementation sketch:

1. **Add `lib/facts-retriever.ts`** — takes a job description + emphasis areas + target role, retrieves relevant facts from the atomic store. Retrieval strategies:
   - **Exact match by tags:** emphasis areas list tags like "healthcare-ai", "gsi-partnerships", "gpu-compute"; facts tagged with matching values rank higher
   - **Semantic similarity:** optional, with a small local embedding model (Ollama `nomic-embed-text` or `@huggingface/transformers`). If not available, fall back to tag-based only
   - **Recency weighting:** facts within the last 5 years rank higher than older facts
   - **Always-include rules:** certain facts (profile.name, profile.location, degree) are always included regardless of retrieval score
2. **Emit a `FactBundle` to the prompt:**

   ```xml
   <facts>
     <position id="arine" start="2025-09" end="2026-03" type="full-time">
       <company ref="arine" verified="true">
         <metric field="healthPlans">45+</metric>
         <metric field="clientMembersTouched">&gt;30 million</metric>
       </company>
       <highlight id="arine-ft-platform">Managed enterprise data platform on Snowflake and AWS, processing petabytes of healthcare data from hundreds of sources.</highlight>
       <highlight id="arine-ft-agents">Built HIPAA-compliant AI coding assistants including a Data Engineering Agent for autonomous ETL pipelines.</highlight>
     </position>
     <position id="hyperbloom" start="2021-06" end="2025-08" type="self-employed">
       <!-- only included if retrieval ranked it relevant -->
     </position>
   </facts>
   ```

3. **Prompt the model to cite fact IDs in generation.** The system prompt adds: "For every bullet you write, end with a comment `<!-- @facts: id1, id2 -->` listing the fact IDs that back this bullet. These comments will be stripped before display but are used for provenance verification."
4. **Strip the `@facts:` comments at post-processing time** but keep a parallel provenance manifest (see Phase A9).
5. **Estimated token savings:** ~60% reduction in user-message tokens. The structured XML is more parseable and grounded than the JSON blob dump.

**Dependencies:** Phase 0.5 (atomic facts store) is a hard prerequisite. Without atomic facts with stable IDs, RAG retrieval has nothing to retrieve against.

**Risk:** retrieval bugs can exclude relevant facts, producing incomplete resumes. Mitigation: the always-include list + a fallback mode that injects everything if the retrieved bundle is < N facts (the old behavior).

**Priority:** Medium-high. Big token efficiency win + big grounding improvement, but depends on Phase 0.5.

---

### Phase A8 — `fix-fact` CLI for atomic fact updates (process efficiency)

**Motivation:** The 2026-04-11 sessions required ~40 hand edits to correct two facts (Hyperbloom start date, NeuroLex/Decooda window). Each correction touched 8-11 files. Python scripts helped but were one-off. A future agent or human making the same kind of correction will repeat the churn.

**Target: one command updates a fact in the atomic store, invalidates caches, regenerates derived views, runs invariants, and commits with a provenance trail.**

```bash
npm run fix-fact -- \
  --fact=position.hyperbloom.start \
  --new-value=2021-06 \
  --provenance="Paul confirmed 2026-04-11: 'I did not start a business while working at AWS.'" \
  --witness=paul
```

Internal behavior:

1. Parse the fact ID (`position.hyperbloom.start`) and locate it in `data/facts/career.yaml`.
2. Record the old value.
3. Update the field. Update `provenance.last_verified_at` to today. Append a line to `provenance.notes`.
4. Run `scripts/derive-career-data.ts` to regenerate `data/generated/career-data.json`.
5. Run `npm run build:prompts` to regenerate `lib/generated/system-prompts.ts` (in case any prompt hydration depends on the fact).
6. Run `npx tsx lib/career-invariants.ts --check` to verify the new state passes invariants. If not, **reject the edit** and restore the old value.
7. Run `tests/facts-consistency.test.ts` and `tests/data-consistency.test.ts`. Reject if either fails.
8. Stage the changed files and generate a commit message:

   ```
   fix(fact): position.hyperbloom.start 2020-01 → 2021-06

   Provenance: Paul confirmed 2026-04-11: "I did not start a business
   while working at AWS. I quit my job at AWS then started Hyperbloom
   June 2021."
   Witness: paul
   Files regenerated: data/generated/career-data.json,
   lib/generated/system-prompts.ts
   Invariants: 17/17 passing
   ```

9. Do NOT auto-commit. Show the diff, print the commit message, wait for Paul's confirmation.

**Test coverage:** `tests/fix-fact.test.ts` — run a round-trip (apply a fact correction, verify derived files updated, verify invariants pass). Roundtrip a couple of regression examples (the Hyperbloom and NeuroLex incidents).

**Priority:** Medium. The atomic facts store (Phase 0.5) makes manual edits easier already; the CLI is a polish on top for process ergonomics and consistent provenance trails.

---

### Phase A8.5 — Memory hygiene rules (context poisoning prevention)

**Motivation:** Session 2 loaded a stale memory file and regressed correct code to wrong values. The failure took Paul only minutes to catch, but it shipped a wrong commit to the remote branch and required a revert. A similar regression in a different class of fact could have shipped to NVIDIA before anyone noticed.

**Target: memory files become hints, not authoritative facts. Every fact-bearing memory file carries a freshness stamp and a verification instruction.**

Rules:

1. **Memory files with fact claims must include a `last_verified_against_source: YYYY-MM-DD` frontmatter field.** If missing, treat the file as untrusted.
2. **Memory files with facts older than 14 days** (configurable) are flagged as "possibly stale" when loaded into a new session. The agent sees a warning and is instructed to cross-check against the current source before acting.
3. **Memory files with facts older than 60 days** are flagged as "stale" and cannot be used as the basis for edits. The agent must refresh them against current source before the edit is allowed.
4. **Every memory file with fact claims includes a mandatory "⚠️ Verify before acting" section** pointing at the authoritative source files.
5. **Memory files cannot override source files** when the two disagree. If a memory file says X and `data/facts/career.yaml` says Y, Y wins and the memory file gets a correction entry with date and session ID.
6. **Agents are forbidden from writing memory files without a `source_of_truth:` pointer.** Every fact claim must name the source file that ultimately verified it.

**Implementation:** a new `scripts/check-memory-hygiene.ts` tool that scans `~/.claude/projects/*/memory/*.md` files, parses their frontmatter, and:

- Reports any missing `last_verified_against_source` fields
- Reports stale files (older than threshold)
- Optionally cross-checks specific fact claims against `data/facts/career.yaml` and reports discrepancies

This runs manually as a session-start ritual or as part of CI if memory files were tracked (they're not currently).

**Priority:** Medium. The specific 2026-04-11 regression is now blocked by the pinned test assertions in `tests/data-consistency.test.ts`. The general memory hygiene rules prevent future regressions from a different class of stale memory.

---

### Phase A9 — Provenance manifests (fact-citation grading)

**Motivation:** The LLM grader (`scripts/grade-content.ts`) currently applies semantic judgment: "does this claim violate rule Gn". It cannot verify whether a claim is grounded in a specific fact vs. plausibly fabricated. During the 2026-04-11 sessions, the grader scored a resume containing two fraudulent date ranges at 95% because the fabrications were consistent with the grounded sources (which were also wrong).

**Target: every generated resume or cover letter emits a `*.provenance.json` manifest alongside the markdown, listing the fact IDs cited by each section. A separate mechanical grader verifies that every claim traces to a real fact.**

How it works:

1. **Generator emits fact citations inline.** Phase A7's prompt instruction tells the LLM to end each bullet with `<!-- @facts: id1, id2 -->`. Post-processing extracts these into a manifest:

   ```json
   {
     "source": "Paul-Prae-Resume-NVIDIA.md",
     "generatedAt": "2026-04-11T10:30:00Z",
     "rulesVersion": "2.0",
     "bullets": [
       {
         "section": "Professional Experience > Arine",
         "text": "Managed enterprise data platform on Snowflake and AWS, processing petabytes of healthcare data from hundreds of heterogeneous sources in support of Arine's medication management and clinical decision support products (Arine serves 45+ health plans and over 30 million members).",
         "fact_refs": [
           "position.arine.highlight.platform",
           "company.arine.metrics.healthPlans",
           "company.arine.metrics.clientMembersTouched"
         ]
       }
     ],
     "orphan_claims": []
   }
   ```

2. **Mechanical citation grader** (`scripts/grade-citations.ts`, new): walks the manifest, resolves every `fact_refs` entry against `data/facts/career.yaml`, and reports:
   - **Orphan claims** — bullets without any `fact_refs` (potentially fabricated)
   - **Broken references** — `fact_refs` that don't resolve to a fact
   - **Paraphrase drift** — bullet text differs significantly from the referenced fact's authoritative value (string distance > threshold). For metric citations: the bullet must mention the exact value from the fact (or a valid rounded form).
3. **LLM grader runs second,** only on the semantic/stylistic dimensions where citation checking doesn't apply (voice, rhythm, tone, compound claims, rule interpretation). Its scope narrows and its false-positive rate drops because the mechanical grader already eliminated the "is this grounded" class of concerns.

**Changes to generation pipeline:**

- `lib/tailored.ts` — when writing output, also write `<basename>.provenance.json`
- `scripts/grade-content.ts` — check for a provenance file, call `grade-citations.ts` first, then run the LLM grader with "grounding is already verified mechanically, focus on voice/style/rule interpretation" directive

**Test coverage:**

- `tests/grade-citations.test.ts` — fixture with known orphans and drifts
- `tests/provenance-roundtrip.test.ts` — generate a small fixture, verify manifest is produced, verify citations resolve

**Priority:** Medium-high. This is the missing fraud-detection layer. Combined with Phase A6 invariants, it makes the grader nearly unable to certify fabricated content.

---

### Phase A5 — Remove duplications

23. Delete the `CRITICAL REMINDERS` block from `lib/tailored.ts:144-154`. Rules are now in the system prompt via hydration. Regenerate NVIDIA → re-grade. Gate: no score drop.
24. Delete the `writing-rules.json` user-message `<document index="4">` injection from `lib/tailored.ts:219-229`. Rules are in the system prompt; duplicating them in the user message wastes tokens and breaks prompt cache stability. Regenerate → re-grade. Gate: no drop.
25. Delete the hardcoded "Pay special attention to:" block from `scripts/grade-content.ts`. The full rules are already injected via `getRulesForGrading()`.
26. Delete `MAJOR_COMPANIES` from `lib/resume-quality.ts`. Migrate the list to `companies.json` (add `is_major: true` to existing entries) or derive from career data. The mega-merge plan's `feat/autonomize-ai-career-update` branch also touches this — coordinate.
27. Update `CLAUDE.md:64-79`. Replace the Brand Voice Guidelines block with a single pointer sentence: "Writing rules are the single source of truth at `data/sources/knowledge/content/writing-rules.json`, loaded via `lib/writing-rules.ts`. Do not duplicate rules inline in prompts, code, or documentation."
28. Final test pass: `npm test`, `npm run check`, regenerate main + NVIDIA resumes, run both graders. Gate: all green, scores unchanged or improved.

---

## Coordination with the mega-merge

The parallel agent on `feat/autonomize-ai-career-update` has written a mega-merge plan (see `.claude/plans/mega-merge-strategy.md` on that branch) that expected my branch to finish Phase A1-A5 before the merge. **I did not finish Phase A1-A5.** The mega-merge plan's conflict matrix assumes my branch refactored several files that I did not touch.

### What will actually be on my branch at merge time

| File                                                            | Mega-merge plan expected       | Actual state on `feat/custom-resume-gen`                                                                                                                |
| --------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `writing-rules.json`                                            | v2 schema                      | **v1 unchanged** (pending Phase A1)                                                                                                                     |
| `lib/writing-rules.ts`                                          | New typed loader               | **Not created** (pending Phase A1)                                                                                                                      |
| `lib/prompts/hydrate-rules.ts`                                  | New renderer                   | **Not created** (pending Phase A3)                                                                                                                      |
| `lib/resume-validator.ts`                                       | New + reads from loader        | ✅ **Created** (Phase A2 partial — reads `writing-rules.json` directly, not through typed loader)                                                       |
| `lib/prompts/resume-writer.system.md`                           | Heavy refactor to placeholders | **Unchanged** (pending Phase A4)                                                                                                                        |
| `lib/prompts/career-chat.system.md`                             | Heavy refactor                 | **Unchanged** (pending Phase A4)                                                                                                                        |
| `lib/prompts/job-tools.system.md`                               | Heavy refactor                 | **Unchanged** (pending Phase A4)                                                                                                                        |
| `lib/prompts/cover-letter-writer.system.md`                     | Heavy refactor                 | **Unchanged** (pending Phase A4)                                                                                                                        |
| `lib/resume-quality.ts` MAJOR_COMPANIES                         | Removed                        | **Present** (pending Phase A5)                                                                                                                          |
| `CLAUDE.md` Brand Voice block                                   | Replaced with pointer          | **Present** (pending Phase A5)                                                                                                                          |
| `lib/tailored.ts` CRITICAL REMINDERS                            | Removed                        | **Present** (pending Phase A5)                                                                                                                          |
| `lib/tailored.ts` rules.json document injection                 | Removed                        | **Present** (pending Phase A5)                                                                                                                          |
| `skills.json` Neo4j removal                                     | Removed                        | **Not removed** (user should confirm whether Neo4j should join the suppress list — it's in Paul's profile summary as "my current open-source AI stack") |
| Arine dates                                                     | Sep 2025 → Mar 2026            | ✅ **Correct** (confirmed by Paul 2026-04-11 after a regression-and-revert cycle)                                                                       |
| Hyperbloom dates                                                | Jan 2020 → Aug 2025            | ✅ **Correct** (confirmed by Paul 2026-04-11)                                                                                                           |
| Autonomize AI position entry                                    | Added                          | ✅ **Added** with `exclude_from_tailored: ["nvidia"]`                                                                                                   |
| `tests/data-consistency.test.ts`                                | N/A (not in mega-merge plan)   | ✅ **New** — this file didn't exist when the mega-merge plan was written                                                                                |
| Grader enhancements (`loadGroundedSources`, persistent reports) | N/A                            | ✅ **New**                                                                                                                                              |

### What the mega-merge agent should do

Two paths, user's choice:

**Option A — merge my branch as-is, ship Phase A1-A5 as a follow-up PR on `main`.** Simpler. Phase A is a pure refactor; ship it after the Autonomize transition is live. The mega-merge agent's conflict resolution simplifies because my branch is smaller than expected: most of the "Accept theirs" rows in their conflict matrix flip to "Accept ours" or "Clean merge" because I didn't modify those files. Risk: technical debt stays on the books for a few days.

**Option B — finish Phase A1-A5 on this branch before the mega-merge, which delays the Autonomize transition.** Phase A1-A5 is ~15-20 more commits and ~4-8 hours of focused work. The original plan estimated this as "land before merge". Risk: Paul starts at Autonomize on April 13 and the production site could go stale if the merge is delayed past then.

**Recommendation: Option A.** The merge has real deadline pressure (Paul starts Autonomize Monday April 13). Phase A is a quality-of-life refactor with no user-facing impact. Ship the submission-ready NVIDIA content + the Autonomize transition to production now; land the refactor on main next week.

---

## Verification commands

Run after each phase:

```bash
cd C:/dev/paulprae-com-resume
npm test                                  # Vitest, all tests
npm run check -- --skip-build             # Release checklist (8 checks)
npm run build                             # Next.js production build
npx tsx .validator-check.ts               # (ad-hoc) Run validator on current NVIDIA resume
npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Resume-NVIDIA.md
npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md
```

Gates for Phase A1-A5 cumulative:

- All tests pass (should be 499+ from my session + new `tests/writing-rules.test.ts` + `tests/hydrate-rules.test.ts` + `tests/system-prompts-snapshot.test.ts`)
- Resume grader ≥95% (current 38/40)
- Cover letter grader ≥92% (current 46/50)
- Zero critical grader violations
- Zero suppressed-skill leakage (grep for dbt, LangChain, n8n, Rust in `data/generated/tailored/Paul-Prae-*-NVIDIA.md` returns nothing)
- Next.js build succeeds
- `lib/generated/system-prompts.ts` snapshot test passes (cache key is stable)
- `npm run check` all 8 checks pass

---

## Open questions for Paul

**Existing questions from session 1:**

1. **CL5 cover letter rhythm:** cover letter is now at 47/50 (94%) after the NeuroLex date fix improved grounding. The 1 remaining CL5 warning is a rhythm issue, not factual. Hand-edit recommended (see "Residual quality items" section above for options).
2. **Neo4j suppression:** the mega-merge plan lists Neo4j removal from `skills.json` as expected work. Should Neo4j join the `suppress_from_output.skills` list (current: dbt, LangChain, n8n, Rust), or stay as a legitimate skill? It's listed in Paul's current open-source AI stack in his profile summary.
3. **Phase A timing:** ship as follow-up on main (Option A), or finish on this branch before mega-merge (Option B)?
4. **Modular Earth transformation:** the mega-merge plan says "transform Modular Earth from position to project" per recruiter feedback. My branch did not do this. Should I do it before the merge, or let the mega-merge agent handle it?
5. **LinkedIn Positions.csv verification (UPDATED 2026-04-11):** Paul confirmed that the correct dates are Sep 2025 / Aug 2025 (Arine / Hyperbloom), and later confirmed Feb 2018 / Jul 2018 (Decooda / NeuroLex) and Jun 2021 (Hyperbloom start). The CSV in WSL needs all these corrections before the next `npm run ingest` or the fabrications will re-appear. **The mega-merge plan's Python one-liner is wrong and should not be run.**

**New questions from session 2 (about the expanded plan):**

6. **Phase 0.5 prioritization — atomic facts store:** should this block the mega-merge? It's a large migration (data/facts/\*.yaml + derive pipeline + consumer updates) but it's the single highest-leverage fix for the multi-copy fact storage problem. Two paths:
   - **Do Phase 0.5 first on a new branch, merge after mega-merge lands.** Lowest risk. Mega-merge ships with existing layout; atomic facts migration is its own PR with its own review.
   - **Do Phase 0.5 as part of mega-merge.** Highest ROI per week but adds 2-3 days to the mega-merge timeline and risks blocking the Autonomize transition.

7. **Phase A6 invariant checker priority bump:** Phase A6 is now HIGH priority (upgraded from Medium) because of the two fraud incidents. Should it block the mega-merge or ship as a follow-up? Recommendation: ship as a follow-up PR, because `tests/data-consistency.test.ts` already pins the specific historical regressions, so the general detector is "fraud prevention for future edits" rather than "fraud cleanup for existing edits".

8. **Provenance manifest scope (Phase A9):** should the mechanical citation grader be mandatory for every generation, or only for tailored submissions? Making it mandatory catches more fraud but adds latency to development iterations.

9. **Memory file lifetime:** adopt a rule that `~/.claude/projects/*/memory/*.md` files with fact claims must include a `last_verified_against_source: YYYY-MM-DD` frontmatter field, and a CI check (or pre-commit hook) flags any memory file with stale facts older than N days. Should N be 7, 14, 30?

10. **Fix-fact CLI ergonomics (Phase A8):** should the CLI auto-commit after all checks pass, or always wait for Paul's manual `git commit`? Auto-commit is faster; manual commit is safer.

**Prevention rules adopted during session 2 (applied retroactively):**

- Memory files with fact claims have FRAUD-DETECTION WARNING sections. Future agents read the warnings before acting.
- `tests/data-consistency.test.ts` has hardcoded pins for every date Paul verified (Arine, Hyperbloom, NeuroLex, Decooda, Booz Allen, AWS endpoints + no-overlap invariants between them).
- Plan docs in `.claude/plans/` are version-controlled with the code so there's a single canonical view of what's pending and why.
- Every fraud fix is committed with a distinct `fix(fraud): ...` prefix so the history is searchable.

---

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
