# Remaining Phases — Writing Rules SSOT Consolidation

> **Branch:** `feat/custom-resume-gen` (PR #37)
> **Author:** Claude Opus 4.6 (1M context), 2026-04-11 session
> **Companion:** `.claude/plans/mega-merge-strategy.md` (incoming on `feat/autonomize-ai-career-update`)
> **Full plan:** `C:\Users\paulp\.claude\plans\majestic-gathering-wolf.md` (user-home path, full 55-step plan with verbatim task breakdowns)

## Context

This document captures the remaining work for the Writing Rules SSOT refactor and the NVIDIA cover letter polish, after a long autopilot session that completed Phase 0 (data corrections) and Phase B (NVIDIA content iteration to 95%/92%) plus the highest-value Phase A2 item (validator extraction). The rest of Phase A — schema v2, prompt hydration, prompt cutovers, duplication removal — is planned but not yet implemented.

**Why this file exists in the repo:** a parallel agent is running `mega-merge-strategy.md` which merges this branch into a UAT branch. That agent needs a machine-readable plan for what's pending on this branch so they can either (a) wait for these phases to land before merging or (b) merge as-is and schedule Phase A completion as a follow-up PR on main. This file is the handoff.

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

The final NVIDIA cover letter grade (46/50, 92%) has one remaining warning: the body paragraphs hammer an "At [Company], I did X" / "Through [Company], I..." pattern across three consecutive paragraphs. The grader flagged this as mechanical rhythm that signals AI generation (rule CL5: Human-written feel).

This is a minor rhythm issue, not a factual or grounding issue. Two paths to resolve:

1. **Hand-rewrite iteration 4 (recommended when Paul is available).** A human editor can vary paragraph openings — start one with an accomplishment, another with a year or project name, compose a sentence spanning two companies in one arc — in ~10 minutes. This is cheaper and higher-quality than another LLM regeneration.
2. **Add a pre-generation directive to `nvidia.json` `additionalContext`.** Tell the LLM: "Do NOT start every body paragraph with 'At [Company]'. Vary paragraph openings with accomplishment-first, year-first, or project-first constructions." Then regenerate with `--force`. Cost: one more ~$2.30 Claude call.
3. **Sensitivity tune the CL5 rule in writing-rules.json v2** (Phase A1 below). If the rule is too strict for cover letters of this length, relax it.

**Preferred:** option 1. This is the kind of polish that costs a human five minutes and an LLM half a dollar to get wrong. Defer until Paul has a waking window.

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

1. **CL5 cover letter rhythm:** accept the single remaining warning at 92%, or invest in iteration 4 to push to 94%+?
2. **Neo4j suppression:** the mega-merge plan lists Neo4j removal from `skills.json` as expected work. Should Neo4j join the `suppress_from_output.skills` list (current: dbt, LangChain, n8n, Rust), or stay as a legitimate skill? It's listed in Paul's current open-source AI stack in his profile summary.
3. **Phase A timing:** ship as follow-up on main (Option A), or finish on this branch before mega-merge (Option B)?
4. **Modular Earth transformation:** the mega-merge plan says "transform Modular Earth from position to project" per recruiter feedback. My branch did not do this. Should I do it before the merge, or let the mega-merge agent handle it?
5. **LinkedIn Positions.csv verification:** the mega-merge plan includes a Python one-liner to "fix" Arine's start date to Mar 2025. **That fix is wrong — the ground-truth dates are Sep 2025 / Aug 2025.** The mega-merge agent should NOT run that Python snippet. Instead, leave the CSV as-is (Sep 2025 is already correct in LinkedIn) or verify in WSL.

6. **Memory file gotcha for future agents:** `C:\Users\paulp\.claude\projects\C--dev-paulprae-com\memory\user_career_timeline.md` had stale dates that caused a regression in this session. The file has been rewritten with the authoritative dates and a prominent warning. If you're a future agent reading memory files for career data, **always cross-check against `data/generated/career-data.json` and Paul's direct confirmation.** Memory files decay; source files are ground truth.

---

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
