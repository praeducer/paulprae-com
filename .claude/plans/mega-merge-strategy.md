# UAT Mega-Merge Implementation Plan v2

> **For agentic workers:** Execute with Claude Opus on max effort. This plan requires complex merge conflict resolution, data pipeline regeneration, and comprehensive verification. Use subagent-driven-development or executing-plans skill. Steps use `- [ ]` checkboxes for tracking.

**Goal:** Merge all 7 non-main branches into a single UAT branch, regenerate the full pipeline, run comprehensive QA, create a single PR to main, and verify no work was lost — all before Paul starts at Autonomize AI on Monday April 13, 2026.

**Architecture:** Fresh `uat/mega-merge-apr-2026` branch from `main`. Merge in dependency order: 4 safe branches → autonomize career transition → custom-resume pipeline → cherry-pick copilot review artifact. Regenerate all pipeline outputs on the final merged state. Phase A SSOT refactor is deferred to a post-merge follow-up PR.

**Tech Stack:** Git (ORT strategy), WSL Ubuntu (`~/dev/paulprae-com`), SSH remote (`git@github.com:praeducer/paulprae-com.git`), Node.js, Next.js 16, Vitest, Pandoc + Typst, Claude API (Opus 4.6), GitHub CLI (`gh` — must be in PATH)

---

## Branch Inventory (7 branches + main)

| #   | Branch                                    | Commits | Files | PR   | CI       | Risk                               |
| --- | ----------------------------------------- | ------- | ----- | ---- | -------- | ---------------------------------- |
| 1   | `docs/backlog-apr4-lighthouse-ux`         | 1       | 1     | none | —        | Zero                               |
| 2   | `docs/autonomize-intro-deliverable`       | 2       | 1     | #36  | PASS     | Zero                               |
| 3   | `chore/audit-fix-and-regen`               | 1       | 1     | #34  | PASS     | Zero                               |
| 4   | `chore/add-project-settings`              | 2       | 2     | #35  | PASS     | Zero (depends on #3)               |
| 5   | `feat/autonomize-ai-career-update`        | 10      | 26    | #38  | FAIL\*   | Medium (9 files overlap with #6)   |
| 6   | `feat/custom-resume-gen`                  | 33      | 43    | #37  | PASS\*\* | High (largest branch, fraud fixes) |
| 7   | `copilot/featautonomize-ai-career-update` | 10      | 26    | none | —        | Zero (artifact, 1 useful file)     |

\*PR #38 CI fails on "stale public/ MD hash mismatch" — expected; pipeline regen fixes it.
\*\*PR #37 CI "fails" on cosmetic "Post Setup Node.js" cache-saving error only; all substantive steps (validate, lint, format, test, build, check:quick) pass.

**Dependency graph:**

```
main (HEAD)
├── docs/backlog-apr4-lighthouse-ux [1 commit] — no PR
├── docs/autonomize-intro-deliverable [2 commits] — PR #36
├── chore/audit-fix-and-regen [1 commit] — PR #34
│   └── chore/add-project-settings [+1 commit] — PR #35
├── feat/autonomize-ai-career-update [10 commits] — PR #38
│   └── copilot/featautonomize-ai-career-update [+1 commit, diverged] — no PR
└── feat/custom-resume-gen [33 commits] — PR #37
```

---

## Copilot Branch — Mystery Solved

`copilot/featautonomize-ai-career-update` was created by **GitHub Copilot's SWE Agent** (`copilot-swe-agent[bot]`) on April 11, 2026. It is an automated review branch, not human-created work.

**How it was created:** Someone invoked GitHub Copilot Workspace to audit the mega-merge-strategy.md plan. The Copilot agent automatically forked `feat/autonomize-ai-career-update` at commit `e9b5a7d` and committed its review work to a `copilot/` prefixed branch. A session URL is embedded in the commit: `github.com/praeducer/paulprae-com/sessions/3d91b87f-...`

**What it contains:** One unique commit (`1b6d2da`) adding:

- `.claude/plans/mega-merge-review-prompt.md` — 906-line comprehensive review document cataloging 30 issues across 4 severity tiers
- Minor update to `mega-merge-strategy.md` adding a caution callout linking to the review prompt

**Resolution in this plan:** Cherry-pick the review prompt file into UAT (Phase 4). Delete the copilot branch during cleanup (Phase 10). The review prompt's 30 issues have already been incorporated into this plan.

---

## Conflict Matrix (9 files between the two major branches)

These files are modified by BOTH `feat/autonomize-ai-career-update` and `feat/custom-resume-gen`:

| File                         | autonomize branch                       | custom-resume branch                                                                               | Resolution                                                                                                                                            |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                  | +Autonomize AI to brand voice (line 72) | +plans README redirect (top of file)                                                               | **Auto-merge expected** (different hunks). Review post-merge: the plans README redirect references custom-resume working state and may need updating. |
| `positions.json`             | +Autonomize, end-date Arine (Sep 2025)  | +Autonomize, end-date Arine, end-date Hyperbloom, remove Modular Earth, fix NeuroLex/Decooda dates | **Accept custom-resume** (has fraud fixes) + verify Autonomize entry                                                                                  |
| `companies.json`             | +Autonomize entry (12 lines)            | +Autonomize entry (9 lines)                                                                        | **Accept custom-resume** + verify Autonomize fields                                                                                                   |
| `resume-writer.system.md`    | +1 line (Autonomize in differentiators) | -54/+3 (grounding rules → external reference)                                                      | **Accept custom-resume** + manually add Autonomize to differentiators                                                                                 |
| `resume-quality.ts`          | +Autonomize AI to MAJOR_COMPANIES       | -Modular Earth from MAJOR_COMPANIES                                                                | **Manual merge**: apply BOTH changes                                                                                                                  |
| `career-data.json`           | Regenerated                             | Regenerated                                                                                        | **Regenerate fresh** (Phase 5)                                                                                                                        |
| `system-prompts.ts`          | Regenerated                             | Regenerated                                                                                        | **Regenerate fresh** (Phase 5)                                                                                                                        |
| `Paul-Prae-Resume.md`        | Regenerated                             | Minor edits                                                                                        | **Regenerate fresh** (Phase 5)                                                                                                                        |
| `public/Paul-Prae-Resume.md` | Regenerated                             | Minor edits                                                                                        | **Regenerate fresh** (Phase 5)                                                                                                                        |

**Non-conflicting files unique to each branch:**

- **autonomize-only (16):** `lib/career-data.ts`, `lib/generated/current-role.ts`, `lib/constants.ts`, `scripts/build-prompts.ts`, `lib/agent/context.ts`, `career-chat.few-shot.md`, `QuickActions.tsx`, `uat-checklist.md`, `resume-writer.few-shot.md`, `VERSIONS.md`, `target-market.json`, `.claude/plans/autonomize-transition-*`, `.claude/plans/mega-merge-strategy.md`, `.claude/plans/backlog.md`, `public/Paul-Prae-Resume.{pdf,docx}`
- **custom-resume-only (30):** `lib/tailored.ts`, `lib/resume-validator.ts`, `scripts/generate-tailored-*.ts`, `scripts/grade-content.ts`, `scripts/generate-resume.ts`, `scripts/release-check.ts`, `scripts/validate-docs.ts`, `lib/prompts/cover-letter-writer.*`, `lib/prompts/career-chat.system.md`, `writing-rules.json`, `data/prompts/tailored/nvidia.json`, `data/generated/tailored/*`, `tests/data-consistency.test.ts`, `tests/fixtures/sample-data.ts`, `tests/generate.test.ts`, `tests/resume-parser.test.ts`, `profile.json`, `skills.json`, `position-metrics.json`, `projects.json`, `.claude/plans/remaining-phases-ssot.md`, `.claude/plans/content-quality-system-design.md`, `.claude/plans/README.md`, `.gitignore`, `.npmrc`, `package.json`, `package-lock.json`

---

## Ground-Truth Career Dates (CORRECTED — Paul-verified April 11, 2026)

> [!CAUTION]
> **The v1 plan had WRONG ground-truth dates** sourced from a memory file (`user_career_timeline.md`) that no longer exists and contradicted the actual test assertions and LinkedIn data. The dates below are from `tests/data-consistency.test.ts` on `feat/custom-resume-gen`, which were explicitly verified by Paul on 2026-04-11 and contain fraud-detection comments explaining the reasoning.

| Role                                     | Company             | Start        | End          | Notes                                                                                                              |
| ---------------------------------------- | ------------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Solutions Architect                      | **Autonomize AI**   | Apr 2026     | Present      | Current role (starts Mon Apr 13)                                                                                   |
| Staff AI DataOps Engineer                | **Arine**           | **Sep 2025** | Mar 2026     | OLD PLAN SAID Mar 2025 — WRONG                                                                                     |
| Chief AI Architect, Senior Manager       | Booz Allen Hamilton | Jul 2024     | Mar 2025     | Concurrent with Hyperbloom                                                                                         |
| Chief AI Officer, Founder                | **Hyperbloom**      | **Jun 2021** | **Aug 2025** | OLD PLAN SAID Jan 2020–Feb 2025 — WRONG. Jan 2020 is LinkedIn fabrication (implies running business while at AWS). |
| Senior AI Engineer                       | **NeuroLex Labs**   | **Feb 2018** | **Jul 2018** | Part-time moonlight. LinkedIn said Jan 2018–May 2020 — WRONG (fabrication).                                        |
| Senior AI Solutions Architect            | **Decooda**         | **Feb 2018** | **Jul 2018** | LinkedIn said Jan 2018–Aug 2018.                                                                                   |
| Enterprise AI and ML Solutions Architect | Amazon Web Services | Aug 2018     | May 2021     |                                                                                                                    |
| Advanced Analytics Consultant            | Slalom Consulting   | Jul 2015     | Jan 2018     |                                                                                                                    |

**Why the old dates were wrong:** The v1 plan cited `~/.claude/projects/.../memory/user_career_timeline.md` as the source of truth. That file no longer exists and contained dates that:

1. Used the fraudulent LinkedIn "Jan 2020" Hyperbloom start (implies overlap with AWS employment)
2. Used "Mar 2025" for Arine start (contradicts LinkedIn CSV which says Sep 2025)
3. Used "Feb 2025" for Hyperbloom end (off by 6 months from Paul-verified Aug 2025)

**The test file is authoritative.** `tests/data-consistency.test.ts` was written specifically to prevent date drift and contains inline comments explaining each fraud-detection assertion.

### LinkedIn CSV Patches Required (4 positions, 8 field changes)

The LinkedIn CSV (`data/sources/linkedin/Positions.csv`) is gitignored but used as input to `npm run ingest`. The local WSL copy has dates that don't match Paul's verified timeline. ALL of these must be patched BEFORE running ingest:

| Company       | Field       | CSV Value (wrong) | Correct Value | Why                                                              |
| ------------- | ----------- | ----------------- | ------------- | ---------------------------------------------------------------- |
| Hyperbloom    | Started On  | Jan 2020          | Jun 2021      | Fraud: implies running business while employed at AWS            |
| Hyperbloom    | Finished On | Sep 2025          | Aug 2025      | One month before Arine start (back-to-back)                      |
| NeuroLex Labs | Started On  | Jan 2018          | Feb 2018      | Fraud: overlaps with Slalom end (Jan 2018)                       |
| NeuroLex Labs | Finished On | May 2020          | Jul 2018      | Fraud: 2-year fabrication (was part-time moonlight with Decooda) |
| Decooda       | Started On  | Jan 2018          | Feb 2018      | Overlaps with Slalom end (Jan 2018)                              |
| Decooda       | Finished On | Aug 2018          | Jul 2018      | Minor correction                                                 |
| Arine         | Started On  | Sep 2025          | _(no change)_ | CSV is CORRECT. Old plan would have changed to Mar 2025 — WRONG. |
| Arine         | Finished On | Mar 2026          | _(no change)_ | CSV is correct.                                                  |

> [!WARNING]
> **The v1 plan's CSV patch script only changed Arine start to "Mar 2025" — this was WRONG and would have broken 7 data-consistency tests.** The corrected script in Phase 5 patches all 4 companies to match Paul-verified dates.

---

## Files created or modified by this plan

**Created on UAT branch:**

- `.claude/plans/merge-strategy-framework.md` (from Appendix A extraction)
- `.claude/plans/merge-strategy-analysis.md` (from Appendix B extraction)

**Modified during merge conflict resolution:**

- `data/sources/knowledge/career/positions.json` (accept custom-resume)
- `data/sources/knowledge/career/companies.json` (accept custom-resume + verify)
- `lib/prompts/resume-writer.system.md` (accept custom-resume + add Autonomize)
- `lib/resume-quality.ts` (manual: +Autonomize AI, -Modular Earth)
- `data/sources/linkedin/Positions.csv` (local only, patch 4 positions)

**Regenerated after merge:**

- `data/generated/career-data.json`, `lib/generated/system-prompts.ts`, `lib/generated/current-role.ts`
- `data/generated/Paul-Prae-Resume.md` + `.pdf` + `.docx`
- `public/Paul-Prae-Resume.md` + `.pdf` + `.docx`

---

## State Recovery (start here if resuming a partial run)

```bash
git log --oneline uat/mega-merge-apr-2026 2>/dev/null \
  || echo "Branch not created yet — start at Phase 1"
git log --oneline uat/mega-merge-apr-2026 \
  | grep -E "pre-merge|feat:|chore:|docs:" | head -20
git tag | grep pre-merge
# Compare output against the phase checklist below to determine resume point
```

---

## Pre-Conditions

- [ ] **1. Full clone + fetch:**

```bash
cd ~/dev/paulprae-com
git fetch --unshallow origin 2>/dev/null || echo "Already full clone"
git fetch --all --prune
```

- [ ] **2. `gh` CLI available and authenticated:**

```bash
which gh || { echo "ERROR: gh not in PATH"; exit 1; }
gh auth status || { echo "ERROR: not authenticated"; exit 1; }
```

- [ ] **3. Verify all 7 branches exist on remote:**

```bash
for b in docs/backlog-apr4-lighthouse-ux docs/autonomize-intro-deliverable \
  chore/audit-fix-and-regen chore/add-project-settings \
  feat/autonomize-ai-career-update feat/custom-resume-gen \
  copilot/featautonomize-ai-career-update; do
  git rev-parse --verify "origin/$b" >/dev/null 2>&1 \
    && echo "OK: $b" || echo "MISSING: $b"
done
```

- [ ] **4. PR #37 substantive CI is clean:**

```bash
gh pr checks 37
# All steps EXCEPT "Post Setup Node.js" must pass.
# "Post Setup Node.js" cache error is cosmetic — safe to ignore.
```

- [ ] **5. LinkedIn CSV exists locally (gitignored):**

```bash
test -f data/sources/linkedin/Positions.csv \
  && echo "CSV found" \
  || { echo "MISSING: Positions.csv — copy from LinkedIn export before proceeding"; exit 1; }
```

- [ ] **6. System dependencies:**

```bash
which pandoc && which typst || echo "WARNING: pandoc/typst missing — export step will fail"
node --version  # Expected: v24.x
npm --version
```

---

## Phase 1: Create UAT branch + merge safe branches

### Task 1.1: Create UAT branch

- [ ] **Create branch from main:**

```bash
git checkout main && git pull --ff-only
git checkout uat/mega-merge-apr-2026 2>/dev/null \
  || git checkout -b uat/mega-merge-apr-2026
git pull origin uat/mega-merge-apr-2026 --ff-only 2>/dev/null || true
```

- [ ] **Extract appendix docs (if they exist on the plan file):**

```bash
# These are supplementary docs; create empty placeholders if extraction fails
git show origin/feat/autonomize-ai-career-update:.claude/plans/mega-merge-strategy.md 2>/dev/null \
  | python3 -c "
import sys
content = sys.stdin.read()
sections = content.split('## Appendix ')
if len(sections) >= 2:
    with open('.claude/plans/merge-strategy-framework.md', 'w') as f:
        f.write('## Appendix ' + sections[1].split('## Appendix')[0].strip())
    print('Created merge-strategy-framework.md')
if len(sections) >= 3:
    with open('.claude/plans/merge-strategy-analysis.md', 'w') as f:
        f.write('## Appendix ' + sections[2].strip())
    print('Created merge-strategy-analysis.md')
" 2>/dev/null || echo "No appendix sections found — skipping"
```

- [ ] **Commit and push:**

```bash
git add .claude/plans/merge-strategy-*.md 2>/dev/null
git diff --cached --quiet || git commit -m "docs: add merge strategy framework + analysis for UAT mega-merge

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin uat/mega-merge-apr-2026
```

### Task 1.2: Merge 4 safe branches (zero conflicts expected)

Each merge follows: tag → merge → verify → push. Tags use `-f` for idempotent re-runs.

- [ ] **Merge docs/backlog-apr4-lighthouse-ux:**

```bash
git tag -f pre-merge-backlog
git merge origin/docs/backlog-apr4-lighthouse-ux --no-edit
```

Expected: 1 file changed (`.claude/plans/backlog.md` — rate-limiting UX bug + Lighthouse backlog items).

- [ ] **Merge docs/autonomize-intro-deliverable:**

> **Note:** The autonomize handoff doc said PR #36 is "out of scope." That applied to the `feat/autonomize-ai-career-update` branch work — this mega-merge covers all branches. PR #36 will auto-close when its branch is deleted.

```bash
git tag -f pre-merge-intro
git merge origin/docs/autonomize-intro-deliverable --no-edit
```

Expected: 1 file changed (`data/generated/deliverables/2026-04-08-autonomize-team-intro.md`).

- [ ] **Merge chore/audit-fix-and-regen:**

```bash
git tag -f pre-merge-audit
git merge origin/chore/audit-fix-and-regen --no-edit
```

Expected: 1 file changed (`package-lock.json` — npm audit fixes).

- [ ] **Merge chore/add-project-settings:**

```bash
git tag -f pre-merge-settings
git merge origin/chore/add-project-settings --no-edit
```

Expected: 2 files (`.claude/settings.json`, `package-lock.json`). If `package-lock.json` conflicts:

```bash
git checkout --theirs package-lock.json && npm install && git add package-lock.json && git commit --no-edit
```

### Task 1.3: Phase 1 validation gate

```bash
npm install
npm test
npm run build
```

- [ ] All tests pass, build succeeds. Commit + push:

```bash
git push
```

---

## Phase 2: Merge feat/autonomize-ai-career-update

**Scope:** 26 files — career transition tooling, current-role derivation, prompt placeholders, handoff docs, and plan files (including this mega-merge plan itself).

- [ ] **Tag + merge:**

```bash
git tag -f pre-merge-autonomize
git merge origin/feat/autonomize-ai-career-update --no-edit
```

Expected: clean merge — no file overlap with Phase 1 branches.

- [ ] **Verify key derivation:**

```bash
grep "Autonomize AI" lib/generated/current-role.ts
# Expected: CURRENT_EMPLOYER = "Autonomize AI"
```

- [ ] **Validation gate:**

```bash
npm test && npm run build
```

- [ ] **Push:**

```bash
git push
```

---

## Phase 3: Merge feat/custom-resume-gen (THE HARD ONE)

**Scope:** 43 files, 3534 additions, 669 deletions. 9 conflict zones with autonomize branch.

### Task 3.0: Recovery Protocol

If any step goes wrong during conflict resolution:

```bash
git merge --abort            # Undo the in-progress merge
git status                   # Verify clean state
git tag -d pre-merge-custom-resume  # Remove tag
# Then restart Phase 3 from the beginning
```

If you committed a bad merge:

```bash
git revert -m 1 HEAD        # Creates a new undo commit (no history rewriting)
git push
```

**Never use `git reset --hard` or `git push --force`.**

### Task 3.1: Start merge

- [ ] **Tag + merge with --no-commit:**

```bash
git tag -f pre-merge-custom-resume
git merge origin/feat/custom-resume-gen --no-commit
```

- [ ] **Inventory conflicts:**

```bash
git diff --name-only --diff-filter=U
```

### Task 3.2: Resolve conflicts

- [ ] **positions.json — accept custom-resume (has fraud fixes):**

```bash
git checkout --theirs data/sources/knowledge/career/positions.json
python3 -m json.tool data/sources/knowledge/career/positions.json > /dev/null \
  || { echo "INVALID JSON"; exit 1; }
git add data/sources/knowledge/career/positions.json
# Verify:
grep -c "autonomize" data/sources/knowledge/career/positions.json  # >= 1
grep -c "Modular Earth" data/sources/knowledge/career/positions.json  # 0
```

- [ ] **companies.json — accept custom-resume:**

```bash
git checkout --theirs data/sources/knowledge/career/companies.json
python3 -m json.tool data/sources/knowledge/career/companies.json > /dev/null \
  || { echo "INVALID JSON"; exit 1; }
git add data/sources/knowledge/career/companies.json
grep "autonomize-ai" data/sources/knowledge/career/companies.json  # match found
```

- [ ] **resume-writer.system.md — accept custom-resume + add Autonomize:**

```bash
git checkout --theirs lib/prompts/resume-writer.system.md
grep "Autonomize" lib/prompts/resume-writer.system.md || echo "MANUAL EDIT NEEDED: add Autonomize AI to differentiators line"
git add lib/prompts/resume-writer.system.md
```

If "Autonomize" is NOT found, edit the differentiators line (~line 28) to include "Autonomize AI, Arine, BCBS, Humana ecosystem".

- [ ] **resume-quality.ts — manual merge (BOTH changes):**

Read the conflict markers. Goal: `MAJOR_COMPANIES` array must contain `"Autonomize AI"` (from autonomize) and must NOT contain `"Modular Earth"` (removed by custom-resume).

```bash
# After editing:
git add lib/resume-quality.ts
```

- [ ] **Auto-generated files (will be regenerated in Phase 5):**

```bash
for f in data/generated/career-data.json data/generated/Paul-Prae-Resume.md \
  public/Paul-Prae-Resume.md lib/generated/system-prompts.ts; do
  git checkout --theirs "$f" 2>/dev/null && git add "$f"
done
git checkout --ours lib/generated/current-role.ts 2>/dev/null && git add lib/generated/current-role.ts
```

- [ ] **package-lock.json (if conflicted):**

```bash
git checkout --theirs package-lock.json 2>/dev/null && npm install && git add package-lock.json
```

- [ ] **CLAUDE.md (if conflicted — should auto-merge since different hunks):**

If git flags CLAUDE.md: both changes are in different parts (brand voice at line 72 vs plans redirect at top). Manually combine both changes.

- [ ] **Any remaining conflicts:**

```bash
git diff --name-only --diff-filter=U
# Must be empty. Resolve any remaining files case-by-case.
```

### Task 3.3: Verify Modular Earth transformation

```bash
grep -c "Modular Earth" data/sources/knowledge/career/positions.json  # 0 (removed from positions)
grep -c "Modular Earth" data/sources/knowledge/career/projects.json   # >= 1 (moved to projects)
```

If Modular Earth is NOT in projects.json, do NOT auto-add. Flag in PR description for Paul.

### Task 3.4: Commit the merge

```bash
git add -A
git status  # Review: no unexpected files
git commit -m "feat: merge custom-resume-gen — tailored pipeline + data corrections + fraud fixes

Conflicts resolved:
- positions.json: accept custom-resume (fraud-fixed dates, Autonomize entry)
- companies.json: accept custom-resume (Autonomize entry present)
- resume-writer.system.md: accept custom-resume refactor + verify Autonomize
- resume-quality.ts: +Autonomize AI, -Modular Earth (both applied)
- Auto-generated files: accepted, regenerated in next phase

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

## Phase 4: Cherry-pick Copilot Review Artifact

The `copilot/featautonomize-ai-career-update` branch has one useful file: the 906-line mega-merge review prompt document (`mega-merge-review-prompt.md`). The rest of its changes are superseded by our work.

- [ ] **Extract the review prompt file:**

```bash
git show origin/copilot/featautonomize-ai-career-update:.claude/plans/mega-merge-review-prompt.md \
  > .claude/plans/mega-merge-review-prompt.md
```

- [ ] **Commit:**

```bash
git add .claude/plans/mega-merge-review-prompt.md
git commit -m "docs: add Copilot SWE Agent review prompt (cherry-picked from copilot/ branch)

The copilot/featautonomize-ai-career-update branch was auto-created by
GitHub Copilot's SWE Agent on April 11, 2026 to review the mega-merge
plan. This 906-line review prompt catalogs 30 issues (6 Critical, 10
High, 9 Medium, 5 Low) that have been addressed in the v2 plan.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

## Phase 5: Data Pipeline Regeneration

### Task 5.1: Patch LinkedIn CSV (4 positions, all fraud-fix corrections)

```bash
python3 << 'PYEOF'
import csv, os, sys

csv_path = 'data/sources/linkedin/Positions.csv'
if not os.path.exists(csv_path):
    print(f'ERROR: {csv_path} not found. This file is gitignored.')
    print('Copy Positions.csv from LinkedIn export before proceeding.')
    sys.exit(1)

# Paul-verified date corrections (2026-04-11)
# Source: tests/data-consistency.test.ts on feat/custom-resume-gen
PATCHES = {
    'Hyperbloom':    {'Started On': 'Jun 2021', 'Finished On': 'Aug 2025'},
    'NeuroLex Labs': {'Started On': 'Feb 2018', 'Finished On': 'Jul 2018'},
    'Decooda':       {'Started On': 'Feb 2018', 'Finished On': 'Jul 2018'},
    # Arine: NO CHANGE. CSV already says Sep 2025 (correct).
    # The v1 plan would have patched Arine to Mar 2025 — that was WRONG.
}

rows = []
patched = []
with open(csv_path, newline='') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        company = row.get('Company Name', '')
        if company in PATCHES:
            for field, value in PATCHES[company].items():
                old = row[field]
                row[field] = value
                patched.append(f'  {company}: {field} {old} -> {value}')
        rows.append(row)

with open(csv_path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

if patched:
    print(f'Patched {len(patched)} fields:')
    for p in patched:
        print(p)
else:
    print('No patches needed (CSV already correct)')
PYEOF
```

### Task 5.2: Run ingest + build prompts

```bash
npm run ingest -- --force
# Expected: 17 positions ingested, Autonomize AI first

npm run build:prompts
# Expected: 3 prompts written, current-role.ts shows CURRENT_EMPLOYER = "Autonomize AI"
```

### Task 5.3: Quick validation

```bash
npm run check:quick
```

### Task 5.4: MANDATORY test gate

```bash
npm test
```

**Expected:** 499+ tests pass. **Pay special attention to `tests/data-consistency.test.ts`** — this validates all fraud-fixed dates. If ANY test fails, STOP. Fix the data before proceeding to the expensive AI generation step.

### Task 5.5: Build

```bash
npm run build
```

### Task 5.6: Commit intermediates

```bash
git add data/generated/career-data.json lib/generated/system-prompts.ts lib/generated/current-role.ts
git commit -m "chore: regenerate career-data + prompts + current-role after mega-merge

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

## Phase 6: Resume Regeneration (~$2.90–$3.70 AI cost — run once)

### Task 6.1: Final test gate before expensive AI call

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
# ALL tests must pass. If data-consistency tests fail, fix data first.
```

### Task 6.2: Generate resume

```bash
npm run generate -- --force
```

Expected: ~10 min, produces `Paul-Prae-Resume.staging.md`. Quality score should be >= 400.

### Task 6.3: Approve

```bash
npm run approve -- --force
```

### Task 6.4: Export to PDF/DOCX

```bash
npm run export -- --force
```

### Task 6.5: Spot-check resume content

```bash
head -40 data/generated/Paul-Prae-Resume.md
```

Verify:

- Autonomize AI first position with "Apr 2026 – Present"
- Arine has "Sep 2025 – Mar 2026" (NOT Mar 2025)
- Hyperbloom has "Jun 2021 – Aug 2025" (NOT Jan 2020)
- Professional summary says "13+ years" (not 15)
- Modular Earth in Projects section (not Professional Experience)
- NeuroLex and Decooda are Feb 2018 – Jul 2018

### Task 6.6: Check suppressed skills

```bash
SUPPRESSED=$(python3 -c "
import json
try:
    with open('data/sources/knowledge/content/writing-rules.json') as f:
        rules = json.load(f)
    skills = rules.get('suppress_from_output', {}).get('skills', []) or \
             rules.get('data', {}).get('suppress_from_output', {}).get('skills', [])
    if skills:
        print('|'.join(r'\b' + s + r'\b' for s in skills))
except Exception:
    pass
" 2>/dev/null)
if [ -n "$SUPPRESSED" ]; then
  grep -iE "$SUPPRESSED" data/generated/Paul-Prae-Resume.md \
    && echo "WARNING: Suppressed skills found" || echo "OK: No suppressed skills"
else
  grep -iE "\b(dbt|langchain|n8n|rust)\b" data/generated/Paul-Prae-Resume.md \
    && echo "WARNING: Suppressed skills found" || echo "OK: No suppressed skills (fallback list)"
fi
```

### Task 6.7: Commit resume outputs

```bash
git add data/generated/Paul-Prae-Resume.md data/generated/VERSIONS.md \
  public/Paul-Prae-Resume.md public/Paul-Prae-Resume.pdf public/Paul-Prae-Resume.docx
git commit -m "feat: regenerate resume on final mega-merged state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

## Phase 7: Verification — No Work Lost

This phase ensures every branch's work is fully captured in the UAT branch.

### Task 7.1: File-level verification (all branches accounted for)

For each source branch, verify that its unique files exist on the UAT branch:

```bash
echo "=== Verifying all branch work is captured ==="

# Branch 1: docs/backlog-apr4-lighthouse-ux
grep "Rate limiting blank bubble" .claude/plans/backlog.md && echo "OK: backlog" || echo "MISSING: backlog items"

# Branch 2: docs/autonomize-intro-deliverable
test -f data/generated/deliverables/2026-04-08-autonomize-team-intro.md && echo "OK: intro deliverable" || echo "MISSING: intro deliverable"

# Branch 3: chore/audit-fix-and-regen — package-lock.json changes absorbed
echo "OK: audit-fix (package-lock absorbed)"

# Branch 4: chore/add-project-settings
test -f .claude/settings.json && echo "OK: project settings" || echo "MISSING: project settings"

# Branch 5: feat/autonomize-ai-career-update
test -f lib/generated/current-role.ts && echo "OK: current-role.ts" || echo "MISSING: current-role.ts"
test -f lib/career-data.ts && grep "getCurrentRole" lib/career-data.ts > /dev/null && echo "OK: getCurrentRole()" || echo "MISSING: getCurrentRole()"
test -f scripts/build-prompts.ts && echo "OK: build-prompts.ts" || echo "MISSING: build-prompts.ts"
grep "CURRENT_ROLE_SENTENCE" lib/prompts/career-chat.few-shot.md > /dev/null && echo "OK: role placeholder" || echo "MISSING: role placeholder"
test -f .claude/plans/autonomize-transition-agent-handoff.md && echo "OK: handoff docs" || echo "MISSING: handoff docs"

# Branch 6: feat/custom-resume-gen
test -f lib/tailored.ts && echo "OK: tailored.ts" || echo "MISSING: tailored.ts"
test -f lib/resume-validator.ts && echo "OK: resume-validator.ts" || echo "MISSING: resume-validator.ts"
test -f scripts/grade-content.ts && echo "OK: grade-content.ts" || echo "MISSING: grade-content.ts"
test -f scripts/generate-tailored-resume.ts && echo "OK: tailored resume script" || echo "MISSING: tailored resume script"
test -f scripts/generate-tailored-cover-letter.ts && echo "OK: tailored cover letter script" || echo "MISSING: tailored cover letter script"
test -f tests/data-consistency.test.ts && echo "OK: data-consistency tests" || echo "MISSING: data-consistency tests"
test -f data/sources/knowledge/content/writing-rules.json && echo "OK: writing-rules.json" || echo "MISSING: writing-rules.json"
test -f data/sources/knowledge/career/projects.json && echo "OK: projects.json" || echo "MISSING: projects.json"
test -f data/prompts/tailored/nvidia.json && echo "OK: NVIDIA prompt" || echo "MISSING: NVIDIA prompt"
test -f .claude/plans/remaining-phases-ssot.md && echo "OK: SSOT roadmap" || echo "MISSING: SSOT roadmap"
test -f .claude/plans/content-quality-system-design.md && echo "OK: quality system design" || echo "MISSING: quality system design"

# Branch 7: copilot/featautonomize-ai-career-update
test -f .claude/plans/mega-merge-review-prompt.md && echo "OK: review prompt" || echo "MISSING: review prompt"

echo ""
echo "=== DONE — all lines should say OK ==="
```

### Task 7.2: Diff-level verification (no silent regressions)

```bash
# Compare UAT against each source branch — look for unexpected deletions
for branch in docs/backlog-apr4-lighthouse-ux docs/autonomize-intro-deliverable \
  chore/audit-fix-and-regen chore/add-project-settings \
  feat/autonomize-ai-career-update feat/custom-resume-gen; do
  echo "=== Files on origin/$branch NOT on UAT (potential lost work) ==="
  # Files that exist on the source branch but not on UAT
  git diff "origin/$branch"..HEAD --name-only --diff-filter=D 2>/dev/null | grep -v "\.staging\." | head -10
done
```

Any files listed (except `.staging.md` files) need investigation.

### Task 7.3: Data integrity checks

```bash
# Verify key data points survive the merge
echo "=== Data integrity ==="
grep "Autonomize AI" data/generated/career-data.json > /dev/null && echo "OK: Autonomize in career-data" || echo "FAIL"
grep "Autonomize AI" lib/generated/current-role.ts > /dev/null && echo "OK: Autonomize in current-role" || echo "FAIL"
grep -c "Modular Earth" data/sources/knowledge/career/positions.json | grep -q "^0$" && echo "OK: Modular Earth removed from positions" || echo "FAIL"
grep "Modular Earth" data/sources/knowledge/career/projects.json > /dev/null && echo "OK: Modular Earth in projects" || echo "FAIL"
grep "Autonomize AI" lib/resume-quality.ts > /dev/null && echo "OK: Autonomize in MAJOR_COMPANIES" || echo "FAIL"
grep -c "Modular Earth" lib/resume-quality.ts | grep -q "^0$" && echo "OK: Modular Earth removed from MAJOR_COMPANIES" || echo "FAIL"
```

### Task 7.4: Verify package.json scripts from custom-resume

```bash
# These scripts were added by feat/custom-resume-gen
node -e "const p=require('./package.json'); ['generate:cover-letter','grade'].forEach(s => console.log(s + ':', p.scripts[s] ? 'OK' : 'MISSING'))"
```

---

## Phase 8: Automated QA + Local UAT

### Task 8.1: Full release check

```bash
npm run check
```

Expected: ALL checks pass. WSL path warning is acceptable.

### Task 8.2: Full test suite (final run)

```bash
npm test -- --reporter=verbose
```

Expected: 499+ tests pass, 0 failures.

### Task 8.3: Lint + format

```bash
npx eslint . --max-warnings=0
npm run format:check
```

### Task 8.4: Build verification

```bash
npm run build
test -d .next && test -f .next/BUILD_ID && echo "Build OK" || echo "Build FAILED"
```

### Task 8.5: Cleanup stale files

```bash
# Remove Windows .npmrc if present
test -f .npmrc && git rm .npmrc && git commit -m "chore: remove Windows-specific .npmrc

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" && git push
```

### Task 8.6: Update backlog

Mark the version bump as done in `backlog.md` (package.json is already at 2.0.0):
Change `- [ ] Bump package.json version to 2.0.0...` to `- [x] Bump package.json version to 2.0.0... (completed — already at 2.0.0)`.

### Task 8.7: Local smoke test

```bash
npm run dev
```

Open `http://localhost:3000` and verify:

- Hero text: "Currently Solutions Architect at Autonomize AI"
- Chat: "Where do you work now?" → Autonomize AI
- Chat: "Tell me about Arine" → past tense, Sep 2025 – Mar 2026
- `/resume` page: Autonomize AI first position
- PDF download works
- `/tools` page works

---

## Phase 9: Create UAT PR (the only PR)

### Task 9.1: Verify Vercel GitHub App

```bash
gh api /repos/praeducer/paulprae-com/installations 2>/dev/null \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
vercel = [i for i in data if 'vercel' in i.get('app_slug','').lower()]
print('Vercel App installed:', bool(vercel))
" || echo "Could not verify — check Vercel dashboard manually"
```

### Task 9.2: Create draft PR

```bash
gh pr create --base main --head uat/mega-merge-apr-2026 --draft \
  --title "feat: mega-merge — Autonomize transition + tailored pipeline + quality infra" \
  --body "$(cat <<'PRBODY'
## Summary

UAT branch combining **all 7 non-main branches** into a single, pipeline-regenerated, fully-tested merge.

### Branches merged (in order)

1. **docs/backlog-apr4-lighthouse-ux** (PR n/a) — Rate-limiting UX bug report + Lighthouse performance backlog items
2. **docs/autonomize-intro-deliverable** (PR #36) — Autonomize AI team intro deliverable for Paul's first week
3. **chore/audit-fix-and-regen** (PR #34) — npm audit vulnerability fixes + system prompt regeneration
4. **chore/add-project-settings** (PR #35) — Project-scoped Claude Code plugin settings
5. **feat/autonomize-ai-career-update** (PR #38) — Autonomize AI career transition + derived current-role tooling (getCurrentRole(), current-role.ts, {{CURRENT_ROLE_SENTENCE}} placeholder, HERO_DESCRIPTION derivation)
6. **feat/custom-resume-gen** (PR #37) — NVIDIA tailored resume/cover letter pipeline (95%/92% grader scores), LLM-as-judge grader, resume validator, writing rules SSOT, data consistency tests, career data fraud fixes (Hyperbloom, NeuroLex, Decooda dates)
7. **copilot/featautonomize-ai-career-update** (no PR) — Cherry-picked Copilot SWE Agent review prompt (906-line review document, 30 issues cataloged)

### Merge process

- Phase 1: 4 safe branches merged cleanly (zero conflicts)
- Phase 2: feat/autonomize-ai-career-update merged cleanly
- Phase 3: feat/custom-resume-gen merged with manual conflict resolution for 9 overlapping files (positions.json, companies.json, resume-writer.system.md, resume-quality.ts, CLAUDE.md, and 4 auto-generated files)
- Phase 4: Copilot review prompt cherry-picked
- Phase 5: Full pipeline regeneration with LinkedIn CSV fraud-fix patches for 4 positions (Hyperbloom, NeuroLex, Decooda dates — Paul-verified 2026-04-11)
- Phase 6: Resume regenerated on final merged state via Claude Opus 4.6
- Phase 7: Comprehensive verification — all branch work accounted for, zero regressions
- Phase 8: Full automated QA suite passed

### Key data decisions

- **Arine:** Sep 2025 – Mar 2026 (LinkedIn-sourced, matching career-data.json)
- **Hyperbloom:** Jun 2021 – Aug 2025 (fraud-fixed — LinkedIn had Jan 2020 which implied overlap with AWS)
- **NeuroLex Labs:** Feb 2018 – Jul 2018 (fraud-fixed — LinkedIn had Jan 2018–May 2020)
- **Decooda:** Feb 2018 – Jul 2018 (fraud-fixed — LinkedIn had Jan 2018–Aug 2018)
- **Modular Earth:** Moved from positions to projects (not-for-profit, not employment)

### Next steps before merging to main

- [ ] **CI passes** — `gh pr checks <PR_NUMBER> --watch`
- [ ] **Vercel preview deployed** — check PR comments for preview URL
- [ ] **UAT on preview** — run docs/uat-checklist.md against preview URL
  - [ ] All pages load (/, /resume, /tools)
  - [ ] Chat works: current role → Autonomize AI
  - [ ] Chat works: past role → Arine (past tense, Sep 2025–Mar 2026)
  - [ ] PDF download renders correctly
  - [ ] Resume shows Autonomize AI first
- [ ] **Mark PR ready** — `gh pr ready <PR_NUMBER>`
- [ ] **Paul approves** — human review of resume content + data decisions

### Post-merge follow-up

- **Phase A SSOT refactor** — See .claude/plans/remaining-phases-ssot.md (GitHub issue to be created)
- **Multi-resume hotfix** — See .claude/plans/hotfix-multi-resume-bug.md (GitHub issue to be created)

Generated with Claude Code
PRBODY
)"
```

### Task 9.3: Wait for CI

```bash
gh pr checks <PR_NUMBER> --watch
# ALL substantive checks must pass.
# "Post Setup Node.js" cache error is cosmetic — safe to ignore.
```

### Task 9.4: Verify Vercel preview

```bash
gh pr view <PR_NUMBER> --json comments --jq '.comments[].body' | grep -i "vercel.app" | head -5
```

Open the preview URL. Run `docs/uat-checklist.md`.

### Task 9.5: Create tracking issues

```bash
# Phase A SSOT refactor
gh issue create \
  --title "Phase A: SSOT refactor (writing-rules, prompt hydration, duplication removal)" \
  --body "Deferred from mega-merge-apr-2026. Full plan: .claude/plans/remaining-phases-ssot.md.
Priority: A6 (fraud prevention) > A1+A3+A4+A5 (SSOT) > A7-A9 (advanced)." \
  --label "enhancement" --assignee "@me"

# Multi-resume hotfix
gh issue create \
  --title "Bug: Second tailored resume in same chat session fails without refresh" \
  --body "See .claude/plans/hotfix-multi-resume-bug.md for details." \
  --label "bug" --assignee "@me"
```

### Task 9.6: Mark PR ready (after UAT passes)

```bash
gh pr ready <PR_NUMBER>
```

---

## Phase 10: Post-Merge Cleanup (after Paul merges PR to main)

### Task 10.1: Merge PR

```bash
gh pr merge <PR_NUMBER> --merge
```

### Task 10.2: Verify production

Open `https://paulprae.com` and run through `docs/uat-checklist.md`.

Check Vercel dashboard for environment variables: `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET`.

### Task 10.3: Delete ALL merged branches (remote + local)

```bash
for branch in docs/backlog-apr4-lighthouse-ux docs/autonomize-intro-deliverable \
  chore/audit-fix-and-regen chore/add-project-settings \
  feat/autonomize-ai-career-update copilot/featautonomize-ai-career-update \
  feat/custom-resume-gen uat/mega-merge-apr-2026; do
  git push origin --delete "$branch" 2>/dev/null \
    && echo "Deleted remote: $branch" || echo "Skipped (already gone): $branch"
  git branch -d "$branch" 2>/dev/null || true
done
```

### Task 10.4: Close stale PRs

```bash
for pr in 34 35 36 37 38; do
  gh pr close $pr \
    --comment "Absorbed into uat/mega-merge-apr-2026 and merged to main." 2>/dev/null \
    && echo "Closed PR #$pr" || echo "PR #$pr already closed"
done
```

### Task 10.5: Sync local main

```bash
git checkout main
git pull --ff-only
git branch  # Should show only: main
git branch -r  # Should show only: origin/HEAD -> origin/main, origin/main
```

**End state:** One branch (`main`), no stale PRs, no stale remote branches, production verified.

---

## Guardrails

1. **Commit and push after EVERY phase.** If the machine crashes, GitHub has everything.
2. **Never `git push --force` or `git reset --hard`.** No history rewriting.
3. **Tag before every merge:** `git tag -f pre-merge-BRANCHNAME` (the `-f` makes re-runs idempotent).
4. **Run `npm test` after every merge.** Stop if tests fail.
5. **Do NOT run `npm run generate` until Phase 6.** ~$2.90–$3.70/run — only on final merged state.
6. **In WSL Ubuntu, use SSH remote** (`git@github.com:...`). HTTPS credential helper may fail in WSL. In other environments, HTTPS works.
7. **Positions.csv is gitignored.** Patch dates locally before ingest. The Phase 5 script has an error guard.
8. **`tests/data-consistency.test.ts` is the source of truth for career dates** (Paul-verified April 11, 2026). If dates conflict, the test file is authoritative.
9. **Phase A SSOT refactor is OUT OF SCOPE.** Ship as follow-up PR on main (tracked via GitHub issue).
10. **Use bare `gh`** (not hardcoded paths). Must be in PATH (verified in Pre-Conditions).
11. **Do NOT auto-insert career content.** Modular Earth, career descriptions, etc. are human decisions. Flag for Paul instead.

---

## Known Issues Fixed (v2 vs v1)

### Critical Corrections

| Issue              | v1 Plan (WRONG)                       | v2 Plan (CORRECT)                                                          | Impact if unfixed                        |
| ------------------ | ------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| Arine start date   | "Mar 2025" (from deleted memory file) | **Sep 2025** (LinkedIn CSV + Paul-verified test)                           | 7 test failures, wrong resume dates      |
| Hyperbloom dates   | "Jan 2020 → Feb 2025"                 | **Jun 2021 → Aug 2025** (Paul-verified fraud fix)                          | Fraud: implies business overlap with AWS |
| CSV patches needed | Only patched Arine (incorrectly)      | **4 positions patched** (Hyperbloom, NeuroLex, Decooda + Arine left alone) | 7 data-consistency test failures         |
| Conflict files     | 8 files listed                        | **9 files** (CLAUDE.md was missing)                                        | Unexpected merge conflict                |
| copilot/ branch    | Not explained                         | **Solved** — Copilot SWE Agent artifact, cherry-pick useful file           | Orphan branch forever                    |

### Copilot Review Issues Applied (30 total)

| ID  | Severity | Issue                             | Fix                                       |
| --- | -------- | --------------------------------- | ----------------------------------------- |
| C1  | Critical | Shallow clone                     | `git fetch --unshallow` in Pre-Conditions |
| C2  | Critical | `copilot/` branch alias           | Explicit fetch + delete in cleanup        |
| C3  | Critical | PR #36 contradiction              | Decision: include in mega-merge           |
| C4  | Critical | No CI gate                        | `gh pr checks --watch` before merge       |
| C5  | Critical | Tag collision on re-run           | `git tag -f` throughout                   |
| C6  | Critical | No test gate before AI call       | `npm test` gate in Phase 6                |
| H1  | High     | `echo "y" \| approve` fragility   | `npm run approve -- --force`              |
| H2  | High     | Hardcoded `gh` path               | Bare `gh` + PATH check                    |
| H3  | High     | Branch exists guard               | Idempotent `checkout \|\| checkout -b`    |
| H4  | High     | No Task 4 rollback                | Recovery Protocol added                   |
| H5  | High     | Non-draft PR                      | `--draft` + `gh pr ready`                 |
| H6  | High     | Subjective precondition           | `gh pr checks 37`                         |
| H7  | High     | Deploy vs preview confusion       | Vercel App clarification                  |
| H8  | High     | Stale backlog version             | Mark version bump complete                |
| H9  | High     | No SSOT tracking issue            | `gh issue create`                         |
| H10 | High     | Hotfix not tracked                | Bug issue created                         |
| M1  | Medium   | CSV missing-file guard            | `os.path.exists` check                    |
| M2  | Medium   | `grep -A 500` fragility           | Python extraction                         |
| M3  | Medium   | Auto-insert career data           | Verification-only                         |
| M4  | Medium   | Stale cost estimate               | $2.90–$3.70 range                         |
| M5  | Medium   | .gitignore not checked            | Conflict check added                      |
| M6  | Medium   | UAT checklist stale               | Review step added                         |
| M7  | Medium   | Vercel env vars not audited       | Manual audit step                         |
| M8  | Medium   | No JSON validation after --theirs | `python3 -m json.tool`                    |
| M9  | Medium   | PR close errors                   | Idempotent loop                           |
| L1  | Low      | SSH-only universal                | WSL-scoped                                |
| L2  | Low      | Hardcoded suppressed skills       | Derived from writing-rules.json           |
| L3  | Low      | Co-author format                  | Standardized                              |
| L4  | Low      | No hotfix issue                   | Issue created                             |
| L5  | Low      | No state recovery                 | Recovery section added                    |
