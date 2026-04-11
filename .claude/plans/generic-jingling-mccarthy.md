# Mega-Merge Execution Plan

> Execute `.claude/plans/mega-merge-strategy.md` (v2, 999 lines, 10 phases) with corrections discovered during pre-flight analysis.

## Context

Paul starts at Autonomize AI on Monday April 13, 2026. Today is April 11. This merge combines 7 branches into `uat/mega-merge-apr-2026`, regenerates the full pipeline, and opens a single PR to main. The system gets: Autonomize career transition + tailored resume/cover-letter pipeline + data fraud fixes + quality infrastructure.

**Primary source plan:** `.claude/plans/mega-merge-strategy.md` (v2, 999 lines, 10 phases)
**Executing model:** Claude Opus 4.6 (1M context) on max effort
**End state:** UAT PR ready for Paul to squash-merge to main

## Corrections to the Written Plan

| #   | Issue                                                  | Fix                                                                         |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1   | `Co-Authored-By: Claude Sonnet 4.6` (7 occurrences)    | Change to `Claude Opus 4.6 <noreply@anthropic.com>`                         |
| 2   | .npmrc removal deferred to Phase 8.5                   | Move to immediately after Phase 3 merge (Windows cache path breaks WSL npm) |
| 3   | Appendix extraction in Phase 1.1 (lines 232-247)       | Skip — no appendix sections exist in the file                               |
| 4   | resume-quality.ts: "Manual merge" via conflict markers | Simpler: accept --theirs, then add "Autonomize AI" as first entry           |
| 5   | package-lock.json: conditional regeneration            | Unconditionally run `npm install` after Phase 3 merge                       |
| 6   | custom-resume-gen commit count: "33 commits" in plan   | Actually 27 commits ahead of main (minor doc inaccuracy)                    |

## Execution Blocks (6 blocks, 4 human gates)

### Block A — Merge Operations (Phases 1-4)

1. Create `uat/mega-merge-apr-2026` from main
2. Merge 4 safe branches: backlog → intro-deliverable → audit-fix → add-project-settings
3. Run `npm install && npm test && npm run build` (Phase 1 gate)
4. Merge feat/autonomize-ai-career-update → test + build (Phase 2 gate)
5. Merge feat/custom-resume-gen with manual conflict resolution for 9 files
   - positions.json: accept --theirs (has fraud fixes + Autonomize)
   - companies.json: accept --theirs (verify Autonomize entry)
   - resume-writer.system.md: accept --theirs + manually add "Autonomize AI" to differentiators
   - resume-quality.ts: accept --theirs + manually add "Autonomize AI" to MAJOR_COMPANIES
   - CLAUDE.md: should auto-merge (different hunks)
   - 4 generated files: accept either side (will be regenerated)
6. Remove .npmrc immediately (Windows cache path)
7. Run `npm install` to regenerate clean package-lock
8. Verify all Autonomize mentions (5-grep gate)
9. Test + build (Phase 3 gate)
10. Extract copilot review prompt file via `git show` (Phase 4)

### Block B — Data Pipeline (Phase 5)

1. Patch LinkedIn CSV (4 positions: Hyperbloom, NeuroLex, Decooda dates)
2. `npm run ingest --force` → `npm run build:prompts`
3. `npm run check:quick`
4. `npm test` — MANDATORY gate (data-consistency tests validate fraud fixes)
5. `npm run build`
6. Commit intermediates

### Block C — Resume Generation (Phase 6, quality-maximized)

1. Final test gate
2. `npm run generate --force` (~10 min, Claude Opus 4.6)
3. Quality check — if score < 420, retry (iterative until maximized)
4. `npm run approve --force`
5. `npm run export --force`
6. Spot-check: Autonomize first, correct dates, suppressed skills, ~2 pages, NVIDIA-ready positioning
7. Commit resume outputs

### Block D — Verification + QA (Phases 7-8)

1. File-level verification: all 7 branches' unique files present
2. Diff-level verification: no silent deletions
3. Data integrity: Autonomize in career-data, Modular Earth in projects not positions
4. `npm run check` (full release checklist)
5. `npm test --reporter=verbose` (final full suite)
6. `npm run build` (final build)
7. Local smoke test on localhost:3000 (**human step**)

### Block E — PR Creation (Phase 9)

1. Create draft PR with comprehensive description
2. Wait for CI
3. Verify Vercel preview deployment
4. Create tracking issues (Phase A SSOT, multi-resume hotfix)
5. **Human UAT on preview URL** → mark PR ready

### Block F — Post-Merge Cleanup (Phase 10, human-triggered)

1. Merge PR to main
2. Verify production
3. Delete all 8 branches (7 source + UAT)
4. Close stale PRs (34, 35, 36, 37, 38)

## Critical Files

- `lib/resume-quality.ts` — manual merge (add Autonomize AI, keep Modular Earth removed)
- `lib/prompts/resume-writer.system.md` — manual edit (add Autonomize AI to differentiators)
- `data/sources/linkedin/Positions.csv` — 6 field patches across 3 companies
- `tests/data-consistency.test.ts` — authoritative date assertions (fraud prevention)
- `lib/generated/current-role.ts` — must show Autonomize AI after regen
- `data/generated/career-data.json` — must show correct dates after regen

## User Decisions (April 11, 2026)

1. **PR merge strategy:** Squash merge — single clean commit on main, full detail in PR description
2. **Autonomize test assertion:** Add now during merge — fraud-prevention guard for current role
3. **Execution scope:** Through Phase 9 (PR marked ready). Paul merges to main + cleanup in follow-up
4. **Resume quality:** Iterative retries until quality is maximized. Optimize for quality, accuracy, honesty. No budget concern — targeting NVIDIA job at up to $350k. Every dollar spent on resume quality is worth it.

## Verification

After each block, verify with:

- `npm test` (493+ tests)
- `npm run build` (zero TypeScript errors)
- `npm run check:quick` (data file validation)

Final verification:

- `npm run check` (full release checklist)
- All 7 branches' unique files exist on UAT
- Autonomize AI present in: career-data.json, current-role.ts, resume-quality.ts, resume-writer.system.md, CLAUDE.md
- Modular Earth: in projects.json, NOT in positions.json or MAJOR_COMPANIES
- Resume: Autonomize first position (Apr 2026 – Present), Arine Sep 2025 – Mar 2026
- NVIDIA tailored prompt (`data/prompts/tailored/nvidia.json`) survives merge intact

## Pre-Flight Status (verified April 11, 2026)

| Check                    | Status                                      |
| ------------------------ | ------------------------------------------- |
| pandoc 3.1.3             | PASS                                        |
| typst 0.14.2             | PASS                                        |
| node v24.14.0            | PASS                                        |
| npm 11.11.0              | PASS                                        |
| gh CLI (praeducer)       | PASS                                        |
| ANTHROPIC_API_KEY        | PASS                                        |
| Working tree clean       | PASS                                        |
| All 7 branches on remote | PASS                                        |
| LinkedIn CSV exists      | PASS                                        |
| CSV patches needed       | 3 positions (Hyperbloom, NeuroLex, Decooda) |

## Risks and Mitigations

| Risk                                  | Severity | Mitigation                                                             |
| ------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Phase 3 conflict resolution (9 files) | Medium   | Follow resolution matrix exactly; 5-grep Autonomize gate before commit |
| Resume quality < 400 on first gen     | Low      | Iterative retry until maximized (user authorized unlimited budget)     |
| .npmrc Windows path breaks WSL npm    | Medium   | Remove immediately after Phase 3 merge (not deferred to Phase 8)       |
| package-lock.json cascade             | Low      | Unconditional `npm install` after Phase 3 to regenerate clean lock     |

## What the User Should Do

1. Stay available for Phase 8.7 local smoke test (localhost:3000 browser check)
2. After I mark PR ready, run UAT on Vercel preview URL per `docs/uat-checklist.md`
3. Squash-merge the PR to main when satisfied
4. Phase 10 cleanup (delete branches, close PRs) will be a separate follow-up session
