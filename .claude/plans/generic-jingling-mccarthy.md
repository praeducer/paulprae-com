# UAT Branch Finalization Plan

> Consolidate plans, verify Autonomize content, execute safe SSOT work on `uat/mega-merge-apr-2026` before merge to main.

## Context

PR #39 is open with all 7 branches merged, 511 tests passing, CI green, resume score 415. Paul starts at Autonomize AI Monday April 13 (2 days). Before merging to main, we need to clean up plan files, verify all Autonomize content is correct, and execute the safe SSOT phases that improve code quality without risking regressions.

## Part 1: Plan Consolidation & Cleanup

### Problem

15 plan-related files across `.claude/plans/` — some complete, some executing, some obsolete. Need a clean state for main.

### Action: Archive obsolete, update active, consolidate

**Archive (mark as historical reference, move to a `completed/` section in README):**

- `mega-merge-strategy.md` — fully executed, historical reference only
- `mega-merge-review-prompt.md` — Copilot review artifact, all 30 issues addressed
- `autonomize-transition-agent-handoff.md` — complete, PR #38 work absorbed into UAT
- `autonomize-transition-human-runbook.md` — complete, reference for future career changes
- `generic-jingling-mccarthy.md` — this session's execution plan, superseded by this plan

**Update:**

- `README.md` — rewrite as canonical entry point for UAT/post-merge state (not stale custom-resume-gen state)
- `backlog.md` — reconcile against current UAT state (last reconciled Apr 3)

**Keep as-is (still active):**

- `remaining-phases-ssot.md` — roadmap for SSOT work (phases we'll execute below)
- `content-quality-system-design.md` — architecture reference (locked)
- `human-tasks.md` — Paul's manual tasks
- `hotfix-multi-resume-bug.md` — tracked as issue #41
- `production-monitoring.md` — reference for post-deploy
- `production-qa-plan.md` — reference for pre-merge QA
- `data-model-and-knowledge-base.md` — Phase 3 deferred

**Files modified:** `README.md`, `backlog.md`
**Estimated:** ~20 min

## Part 2: Autonomize Content Verification

### Status: VERIFIED COMPLETE

All content correctly references Autonomize AI as current employer:

| Category              | Files Checked                                                                             | Status |
| --------------------- | ----------------------------------------------------------------------------------------- | ------ |
| Source data (5 files) | positions.json, companies.json, profile.json, target-market.json, position-metrics.json   | PASS   |
| Generated (4 files)   | career-data.json, current-role.ts, system-prompts.ts, Paul-Prae-Resume.md                 | PASS   |
| UI/Frontend (2 files) | constants.ts (uses generated import), QuickActions.tsx (generic phrasing)                 | PASS   |
| Prompts (3 files)     | career-chat.few-shot.md ({{CURRENT_ROLE_SENTENCE}}), resume-writer.system.md, few-shot.md | PASS   |
| Docs (3 files)        | CLAUDE.md, uat-checklist.md, README.md                                                    | PASS   |
| Tests (1 file)        | data-consistency.test.ts (Autonomize assertion at lines 100-107)                          | PASS   |
| Stale refs            | Zero "at Arine" hardcoded strings in app/components                                       | PASS   |

**No action needed.** All Autonomize content is correct.

## Part 3: SSOT Work on UAT Branch

### What's already done (from `feat/custom-resume-gen`)

- `writing-rules.json` created with G1-G8, E1-E6, V1-V8, Q1-Q6, CL1-CL5, suppress list
- `lib/resume-validator.ts` reads writing-rules.json (direct JSON import, not typed loader)
- `scripts/grade-content.ts` reads writing-rules.json for full rules payload
- `tests/data-consistency.test.ts` pins all fraud-prevention dates
- NVIDIA tailored resume (95%) + cover letter (92%) generated

### What's actionable now (safe, won't regress quality)

**Phase A1 — Typed writing-rules loader** (MEDIUM, ~4 commits)

- Create `lib/writing-rules-schema.ts` — Zod schema with v1/v2 compat
- Create `lib/writing-rules.ts` — typed loader with `getRulesFor()`, `getBlocklist()`, `getSuppressedSkills()`
- Unit tests: `tests/writing-rules.test.ts`
- Refactor `resume-validator.ts` + `grade-content.ts` to use typed loader (instead of raw JSON.parse)
- **Risk:** Low (additive, existing behavior preserved via v1 compat)
- **Why now:** Foundation for all other SSOT phases; clean code on main

**Phase A3 — Prompt hydration helpers** (SMALL, ~2 commits)

- Create `lib/prompts/hydrate-rules.ts` — `renderRulesAsProse()`, `renderActionVerbList()`, `renderSuppressedSkills()`
- Add placeholders to `lib/agent/context.ts`: `{{WRITING_RULES}}`, `{{ACTION_VERBS}}`, `{{SUPPRESSED_SKILLS}}`
- Tests: `tests/hydrate-rules.test.ts`
- **Risk:** Low (new code, no existing behavior changed yet)
- **Depends on:** Phase A1

**Phase A5 partial — Safe deduplication** (SMALL, ~2 commits)

- Remove duplicated MAJOR_COMPANIES list from `resume-quality.ts` (derive from writing-rules or career-data)
- Remove duplicated suppress list from anywhere using raw strings (use typed loader)
- **Risk:** Low (just wiring existing data through the typed loader)
- **Depends on:** Phase A1

### Deferred to post-merge (separate PR on main)

- A4 (prompt cutovers) — risky, could regress resume quality 415
- Phase 0.5 (atomic facts) — large structural migration
- A6 (invariant checker) — medium, partially covered by data-consistency tests
- A7-A9 (RAG, fix-fact, provenance) — depend on Phase 0.5

### Sequence

```
Plan cleanup (Part 1)
      ↓
Phase A1 (typed loader) → tests pass
      ↓
Phase A3 (hydration helpers) → tests pass
      ↓
Phase A5 partial (safe dedup) → tests pass
      ↓
Final commit + push → CI green
```

## Part 4: Final Pre-Merge Verification

After all SSOT work:

1. `npm test` — 511+ tests pass
2. `npm run check` — full release checklist
3. `npm run build` — clean build
4. Push all commits
5. Verify CI passes on PR #39
6. Update PR description with SSOT work summary

## Critical Files

- `lib/writing-rules-schema.ts` — NEW (Zod schema)
- `lib/writing-rules.ts` — NEW (typed loader)
- `lib/prompts/hydrate-rules.ts` — NEW (prompt helpers)
- `lib/agent/context.ts` — MODIFY (add placeholder substitution)
- `lib/resume-validator.ts` — MODIFY (use typed loader)
- `scripts/grade-content.ts` — MODIFY (use typed loader)
- `lib/resume-quality.ts` — MODIFY (derive MAJOR_COMPANIES)
- `tests/writing-rules.test.ts` — NEW
- `tests/hydrate-rules.test.ts` — NEW
- `.claude/plans/README.md` — MODIFY (consolidate)
- `.claude/plans/backlog.md` — MODIFY (reconcile)
