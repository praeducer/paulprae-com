# UAT Mega-Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> [!CAUTION]
> **This plan was reviewed by GitHub Copilot (April 11, 2026) and found 30 issues across 4 severity tiers.**
> Critical and High issues have been fixed inline below. Read the full review prompt at:
> `.claude/plans/mega-merge-review-prompt.md` (on `copilot/featautonomize-ai-career-update` branch).
>
> **Critical issues fixed:** C1 shallow clone, C2 branch alias, C3 PR #36 contradiction, C4 no CI gate, C5 tag collision, C6 test gate before AI call
> **High issues fixed:** H1 approve fragility, H2 hardcoded gh path, H3 branch exists guard, H4 no rollback, H5 non-draft PR, H6 subjective precondition, H7 deploy workflow, H8 stale backlog, H9 no SSOT issue, H10 hotfix not tracked

**Goal:** Merge all 6 non-main branches into a single UAT branch, QA holistically, then deploy to production before Paul starts at Autonomize AI on Monday April 13, 2026.

**Architecture:** Fresh `uat/mega-merge-apr-2026` branch from `main`. Merge 4 safe branches first, then `feat/autonomize-ai-career-update` (career tooling), then `feat/custom-resume-gen` (tailored pipeline + data corrections). Regenerate all pipeline outputs on the final merged state. Phase A SSOT refactor is deferred to a follow-up PR per the parallel agent's recommendation.

**Tech Stack:** Git (ORT strategy), WSL Ubuntu (~/dev/paulprae-com), SSH remote (`git@github.com:praeducer/paulprae-com.git`), Node.js, Next.js 16, Vitest, Pandoc + Typst, Claude API (Opus 4.6), GitHub CLI (`gh` — must be in PATH)

---

## State Recovery (start here on resume)

If picking up a partially-complete merge, determine current state before doing anything:

```bash
git log --oneline uat/mega-merge-apr-2026 2>/dev/null \
  || echo "Branch not created yet — start at Task 1"
git log --oneline uat/mega-merge-apr-2026 \
  | grep -E "pre-merge|feat:|chore:|docs:" | head -20
git tag | grep pre-merge
```

Compare output against the task checklist to determine the resume point.

---

## Pre-Conditions

Before executing this plan, verify:

1. **Unshallow clone + full fetch:**

```bash
git fetch --unshallow origin 2>/dev/null || echo "Already full clone, continuing..."
git fetch --all --prune
```

2. **`gh` CLI available and authenticated:**

```bash
which gh || { echo "ERROR: gh CLI not found in PATH. Install from https://cli.github.com/"; exit 1; }
gh auth status || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }
```

3. **PR #37 is CI-clean** (programmatic check — do NOT rely on PR body text):

```bash
gh pr checks 37
# Expected: all substantive steps pass (validate, lint, format, test, build, check:quick)
# NOTE: "Post Setup Node.js" cache-saving error is a known cosmetic CI issue — safe to ignore.
# If any of validate/lint/format/test/build steps FAIL: stop and fix before proceeding.
```

4. **feat/custom-resume-gen has sufficient commits:**

```bash
git log --oneline origin/main..origin/feat/custom-resume-gen | wc -l
# Expected: >= 26
```

5. **Stale tags from previous attempts:**

```bash
git tag | grep pre-merge
# If any exist, note them — the plan uses `git tag -f` throughout (idempotent)
```

6. **Check `.gitignore` for cross-branch conflicts:**

```bash
git diff origin/main...origin/feat/custom-resume-gen -- .gitignore | head -30
git diff origin/main...origin/feat/autonomize-ai-career-update -- .gitignore | head -30
# If both show changes, verify they don't conflict before merging
```

7. **Hotfix status check:**

```bash
# Verify whether the multi-resume bug (hotfix-multi-resume-bug.md) has been fixed
# on either feat/custom-resume-gen or main. If unfixed, it stays as a post-merge GitHub issue.
grep -r "multi.*resume\|resume.*multi" tests/ --include="*.ts" -l 2>/dev/null
# Do NOT mix any hotfix into the UAT branch
```

8. **All commands run in WSL Ubuntu** (`wsl -d Ubuntu -- bash -lc '...'` or native terminal)

9. **Ground-truth career dates** (from `~/.claude/projects/.../memory/user_career_timeline.md`):
   - Hyperbloom: Jan 2020 → Feb 2025 (NOT Aug 2025 — that was a fraud-fix overcorrection)
   - Arine: Mar 2025 → Mar 2026 (NOT Sep 2025)
   - Autonomize AI: Apr 2026 → Present
   - Booz Allen: Jul 2024 → Mar 2025 (concurrent with Hyperbloom wind-down)

**IMPORTANT:** The parallel agent discovered and fixed **two fraud incidents** during their session — fabricated date ranges for Hyperbloom, NeuroLex, and Decooda. Their corrections are pinned in `tests/data-consistency.test.ts`. Do NOT override these dates during the merge. If in doubt, the test file is authoritative.

---

## Actual Conflict Zones (8 files, updated April 11)

These are the files modified by BOTH `feat/autonomize-ai-career-update` and `feat/custom-resume-gen`:

| File                         | autonomize branch                       | custom-resume branch                                                                                          | Resolution                                                                      |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `positions.json`             | +Autonomize, end-date Arine (Sep 2025)  | +Autonomize, end-date Arine (Mar 2025), end-date Hyperbloom, remove Modular Earth, fix NeuroLex/Decooda dates | **Accept custom-resume** (correct dates, fraud fixes) + verify Autonomize entry |
| `companies.json`             | +Autonomize entry (12 lines)            | +Autonomize entry (9 lines)                                                                                   | **Accept custom-resume** + merge any missing fields from autonomize             |
| `resume-writer.system.md`    | +1 line (Autonomize in differentiators) | -54/+3 (grounding rules → external reference)                                                                 | **Accept custom-resume** + manually add Autonomize to differentiators line      |
| `resume-quality.ts`          | +1 line (Autonomize AI)                 | -1 line (Modular Earth)                                                                                       | **Manual merge**: apply BOTH — add Autonomize AI AND remove Modular Earth       |
| `career-data.json`           | Regenerated                             | Regenerated                                                                                                   | **Regenerate fresh** after merge                                                |
| `system-prompts.ts`          | Regenerated                             | Regenerated                                                                                                   | **Regenerate fresh** after merge                                                |
| `Paul-Prae-Resume.md`        | Regenerated                             | Minor edits                                                                                                   | **Regenerate fresh** after merge                                                |
| `public/Paul-Prae-Resume.md` | Regenerated                             | Minor edits                                                                                                   | **Regenerate fresh** after merge                                                |

**Files that do NOT conflict** (unique to each branch):

autonomize-only: `lib/career-data.ts`, `lib/generated/current-role.ts`, `lib/constants.ts`, `scripts/build-prompts.ts`, `lib/agent/context.ts`, `career-chat.few-shot.md`, `QuickActions.tsx`, `uat-checklist.md`, `resume-writer.few-shot.md`, `.claude/plans/autonomize-*`

custom-resume-only: `lib/tailored.ts`, `lib/resume-validator.ts`, `scripts/generate-tailored-*.ts`, `scripts/grade-content.ts`, `lib/prompts/cover-letter-writer.*`, `writing-rules.json`, `data/prompts/tailored/nvidia.json`, `data/generated/tailored/*`, `tests/data-consistency.test.ts`, `profile.json`, `skills.json`, `position-metrics.json`, `projects.json`, `.claude/plans/remaining-phases-ssot.md`, `.claude/plans/content-quality-system-design.md`

---

## Files created or modified by this plan

**Created on UAT branch:**

- `.claude/plans/merge-strategy-framework.md` (from Appendix A of previous plan)
- `.claude/plans/merge-strategy-analysis.md` (from Appendix B of previous plan)

**Modified during merge conflict resolution:**

- `data/sources/knowledge/career/positions.json` (accept custom-resume version)
- `data/sources/knowledge/career/companies.json` (accept custom-resume + verify)
- `lib/prompts/resume-writer.system.md` (accept custom-resume + add Autonomize)
- `lib/resume-quality.ts` (manual: +Autonomize AI, -Modular Earth)
- `data/sources/linkedin/Positions.csv` (local only, fix Arine start to Mar 2025)

**Regenerated after merge:**

- `data/generated/career-data.json`
- `lib/generated/system-prompts.ts`
- `lib/generated/current-role.ts`
- `data/generated/Paul-Prae-Resume.md` + `.pdf` + `.docx`
- `public/Paul-Prae-Resume.md` + `.pdf` + `.docx`

---

### Task 1: Create UAT branch + companion docs

**Files:**

- Create: `.claude/plans/merge-strategy-framework.md`
- Create: `.claude/plans/merge-strategy-analysis.md`

- [ ] **Step 1: Fetch, unshallow, and create branch**

```bash
cd ~/dev/paulprae-com

# C1: Unshallow if needed (handles CI/Codespace shallow clones)
git fetch --unshallow origin 2>/dev/null || echo "Already full clone, continuing..."
git fetch --all --prune

# C2: Ensure feat/autonomize-ai-career-update resolves (has a copilot/ alias)
git fetch origin feat/autonomize-ai-career-update:refs/remotes/origin/feat/autonomize-ai-career-update 2>/dev/null || true
git log --oneline origin/feat/autonomize-ai-career-update -3 \
  || { echo "ERROR: branch not found — fetch failed"; exit 1; }

# H2: Verify gh CLI
which gh || { echo "ERROR: gh not in PATH"; exit 1; }
gh auth status || { echo "ERROR: gh not authenticated"; exit 1; }

git checkout main
git pull --ff-only

# H3: Idempotent branch creation
git checkout uat/mega-merge-apr-2026 2>/dev/null \
  || git checkout -b uat/mega-merge-apr-2026

# If branch already exists remotely, sync:
git pull origin uat/mega-merge-apr-2026 --ff-only 2>/dev/null || true
```

Expected: on `uat/mega-merge-apr-2026`, no errors.

- [ ] **Step 2: Verify preconditions**

```bash
git log --oneline origin/main..origin/feat/custom-resume-gen | wc -l
# Expected: >= 26
git log --oneline origin/main..origin/feat/autonomize-ai-career-update | wc -l
# Expected: >= 7 (6 commits + 1 plan doc commit)

# M5: Check .gitignore conflicts between branches
git diff origin/main...origin/feat/custom-resume-gen -- .gitignore | head -30
git diff origin/main...origin/feat/autonomize-ai-career-update -- .gitignore | head -30
```

- [ ] **Step 3: Create merge-strategy-framework.md**

Use Python for reliable extraction (avoids `grep -A 500` truncation):

```bash
git show origin/feat/autonomize-ai-career-update:.claude/plans/mega-merge-strategy.md \
  | python3 -c "
import sys
content = sys.stdin.read()
sections = content.split('## Appendix ')
if len(sections) < 2:
    print('ERROR: No Appendix sections found — create merge-strategy-framework.md manually')
    sys.exit(1)
with open('.claude/plans/merge-strategy-framework.md', 'w') as f:
    f.write('## Appendix ' + sections[1].split('## Appendix')[0].strip())
print('Created merge-strategy-framework.md')
"
```

If the extraction produces an empty file, create manually with the framework content (branch classification, merge order algorithm, conflict resolution protocol, validation gates, rollback protocol).

- [ ] **Step 4: Create merge-strategy-analysis.md**

```bash
git show origin/feat/autonomize-ai-career-update:.claude/plans/mega-merge-strategy.md \
  | python3 -c "
import sys
content = sys.stdin.read()
sections = content.split('## Appendix ')
if len(sections) >= 3:
    with open('.claude/plans/merge-strategy-analysis.md', 'w') as f:
        f.write('## Appendix ' + sections[2].strip())
    print('Created merge-strategy-analysis.md')
else:
    print('WARNING: Appendix B not found — create merge-strategy-analysis.md manually')
"
```

If empty, create manually with the Mermaid diagrams (branch topology, merge sequence flowchart, conflict resolution matrix, branch statistics table).

- [ ] **Step 5: Push initial UAT branch**

```bash
git add .claude/plans/merge-strategy-framework.md .claude/plans/merge-strategy-analysis.md
git commit -m "docs: add merge strategy framework + analysis for UAT mega-merge

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin uat/mega-merge-apr-2026
```

Expected: branch pushed, no errors.

---

### Task 2: Phase 1 merges — safe branches (zero conflicts)

**Files:** `.claude/plans/backlog.md`, `data/generated/deliverables/*`, `.claude/settings.json`, `package-lock.json`

- [ ] **Step 1: Tag + merge docs/backlog-apr4-lighthouse-ux**

```bash
git tag -f pre-merge-backlog   # -f: idempotent on re-run (C5)
git merge origin/docs/backlog-apr4-lighthouse-ux --no-edit
git push
```

Expected: clean merge, 1 file changed.

- [ ] **Step 2: Tag + merge docs/autonomize-intro-deliverable**

> **Decision (C3):** `docs/autonomize-intro-deliverable` IS included in this mega-merge.
> The handoff doc's "out of scope" was specific to the `feat/autonomize-ai-career-update` branch work, not to this mega-merge initiative which covers ALL open branches.
> **After the UAT PR merges to main, PR #36 will auto-close** (or close it manually in Task 9).

```bash
git tag -f pre-merge-intro     # -f: idempotent on re-run (C5)
git merge origin/docs/autonomize-intro-deliverable --no-edit
git push
```

Expected: clean merge, 1 file changed.

- [ ] **Step 3: Tag + merge chore/audit-fix-and-regen**

```bash
git tag -f pre-merge-audit     # -f: idempotent on re-run (C5)
git merge origin/chore/audit-fix-and-regen --no-edit
git push
```

Expected: clean merge. If package-lock.json conflicts, run `npm install` to regenerate.

- [ ] **Step 4: Tag + merge chore/add-project-settings**

```bash
git tag -f pre-merge-settings  # -f: idempotent on re-run (C5)
git merge origin/chore/add-project-settings --no-edit
git push
```

Expected: possible package-lock.json conflict (same base commit as audit-fix). If conflict:

```bash
git checkout --theirs package-lock.json
npm install
git add package-lock.json
git commit --no-edit
git push
```

- [ ] **Step 5: Phase 1 validation gate**

```bash
npm install
npm test
npm run build
```

Expected: all tests pass, build succeeds. Commit any regenerated files if needed.

---

### Task 3: Phase 2 merge — feat/autonomize-ai-career-update

**Files:** 24 files (career-data, prompts, constants, generated outputs, handoff docs)

- [ ] **Step 1: Tag + merge**

```bash
git tag -f pre-merge-autonomize   # -f: idempotent on re-run (C5)
git merge origin/feat/autonomize-ai-career-update --no-edit
git push
```

Expected: clean merge — no overlap with Phase 1 branches.

- [ ] **Step 2: Verify current-role derivation**

```bash
grep "Autonomize AI" lib/generated/current-role.ts
# Expected: CURRENT_EMPLOYER = "Autonomize AI"
```

- [ ] **Step 3: Validation gate**

```bash
npm test
npm run build
```

Expected: all tests pass, build clean.

---

### Task 4: Phase 3 merge — feat/custom-resume-gen (THE HARD ONE)

**Files:** 41 files, 3363 additions, 669 deletions. 8 conflict zones.

#### Task 4 Recovery Protocol

If any step in Task 4 goes wrong (H4):

1. **Abort the merge:** `git merge --abort`
2. **Verify clean state:** `git status` — should show "nothing to commit"
3. **Clean up the tag:** `git tag -d pre-merge-custom-resume`
4. **Start Task 4 fresh:** Re-run from Step 1

If you committed a bad merge and need to revert:

```bash
# Creates a new commit that undoes the merge — does NOT rewrite history
git revert -m 1 HEAD
git push
```

Never use `git reset --hard` or `git push --force` — prohibited per the guardrails.

---

- [ ] **Step 1: Tag + merge with --no-commit**

```bash
git tag -f pre-merge-custom-resume   # -f: idempotent on re-run (C5)
git merge origin/feat/custom-resume-gen --no-commit
```

Expected: merge stops with conflicts. `git status` will show conflicted files.

- [ ] **Step 2: List conflicts**

```bash
git diff --name-only --diff-filter=U
```

Expected: some subset of the 8 files listed in the conflict matrix above.

- [ ] **Step 3: Resolve positions.json — accept custom-resume version**

```bash
git checkout --theirs data/sources/knowledge/career/positions.json
# M8: Validate JSON immediately after accepting
python3 -m json.tool data/sources/knowledge/career/positions.json > /dev/null \
  && echo "positions.json is valid JSON" \
  || { echo "INVALID JSON — fix before proceeding"; exit 1; }
git add data/sources/knowledge/career/positions.json
```

Then verify: `grep -c "autonomize" data/sources/knowledge/career/positions.json` should return ≥ 1 (Autonomize AI entry exists). `grep -c "Modular Earth" data/sources/knowledge/career/positions.json` should return 0 (removed).

- [ ] **Step 4: Resolve companies.json — accept custom-resume, verify Autonomize**

```bash
git checkout --theirs data/sources/knowledge/career/companies.json
# M8: Validate JSON immediately
python3 -m json.tool data/sources/knowledge/career/companies.json > /dev/null \
  && echo "companies.json is valid JSON" \
  || { echo "INVALID JSON — fix before proceeding"; exit 1; }
git add data/sources/knowledge/career/companies.json
```

Verify: `grep "autonomize-ai" data/sources/knowledge/career/companies.json` returns a match.

- [ ] **Step 5: Resolve resume-writer.system.md — accept custom-resume + add Autonomize**

```bash
git checkout --theirs lib/prompts/resume-writer.system.md
```

Then check if "Autonomize AI" appears in the key differentiators line:

```bash
grep -n "Autonomize" lib/prompts/resume-writer.system.md
```

If NOT found, manually edit the differentiators line (around line 28) to include "Autonomize AI, Arine, BCBS, Humana ecosystem". Then:

```bash
git add lib/prompts/resume-writer.system.md
```

- [ ] **Step 6: Resolve resume-quality.ts — manual merge (add + remove)**

Read the file to see which lines are conflicted. The goal: the MAJOR_COMPANIES array should have "Autonomize AI" added (from autonomize branch) AND "Modular Earth" removed (from custom-resume branch). Both changes at different array positions.

```bash
# View the conflict markers
head -50 lib/resume-quality.ts
```

Edit to resolve: ensure the array contains "Autonomize AI" and does NOT contain "Modular Earth". Then:

```bash
git add lib/resume-quality.ts
```

- [ ] **Step 7: Resolve auto-generated files**

These will be regenerated in Task 5, so just accept either side:

```bash
git checkout --theirs data/generated/career-data.json data/generated/Paul-Prae-Resume.md public/Paul-Prae-Resume.md lib/generated/system-prompts.ts 2>/dev/null
git checkout --ours lib/generated/current-role.ts 2>/dev/null
git add data/generated/career-data.json data/generated/Paul-Prae-Resume.md public/Paul-Prae-Resume.md lib/generated/system-prompts.ts lib/generated/current-role.ts 2>/dev/null
```

- [ ] **Step 8: Resolve package-lock.json (if conflicted)**

```bash
git checkout --theirs package-lock.json 2>/dev/null
npm install
git add package-lock.json
```

- [ ] **Step 9: Check for remaining conflicts**

```bash
git diff --name-only --diff-filter=U
```

Expected: empty (all resolved). If files remain, resolve them case-by-case using the conflict matrix above.

- [ ] **Step 10: Verify Modular Earth transformation (human review required if missing)**

```bash
echo "positions.json Modular Earth count (should be 0):"
grep -c "Modular Earth" data/sources/knowledge/career/positions.json

echo "projects.json Modular Earth count (should be >= 1):"
grep -c "Modular Earth" data/sources/knowledge/career/projects.json 2>/dev/null || echo "0"
```

> **M3 — Do NOT auto-add career content.** If Modular Earth is NOT in `projects.json`, do NOT auto-insert it. Instead, flag it in the PR description:
> _"ACTION REQUIRED (Paul): Modular Earth was removed from positions.json but is not in projects.json. Add it manually if you want it to appear as a project."_

- [ ] **Step 11: Commit the merge**

```bash
git add -A
git status  # Verify: no unexpected files, all conflicts resolved
git commit -m "feat: merge custom-resume-gen — tailored pipeline + data corrections + fraud fixes

Conflicts resolved:
- positions.json: accept custom-resume (correct Arine Mar 2025, Hyperbloom
  fraud fixes, Autonomize AI entry)
- companies.json: accept custom-resume (Autonomize AI entry present)
- resume-writer.system.md: accept custom-resume refactor + verify Autonomize
  in differentiators
- resume-quality.ts: +Autonomize AI, -Modular Earth (both changes applied)
- Auto-generated files: accepted, will regenerate in next step

Preserves from autonomize branch:
- getCurrentRole() derivation (lib/career-data.ts)
- lib/generated/current-role.ts
- {{CURRENT_ROLE_SENTENCE}} placeholder
- HERO_DESCRIPTION derivation (lib/constants.ts)

Preserves from custom-resume branch:
- Tailored pipeline (lib/tailored.ts)
- LLM-as-judge grader (scripts/grade-content.ts)
- Resume validator (lib/resume-validator.ts)
- Writing rules SSOT (writing-rules.json)
- NVIDIA submission-ready content (95%/92%)
- Data consistency tests
- Fraud-fix date corrections

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

### Task 5: Post-merge regeneration

**Files:** `career-data.json`, `system-prompts.ts`, `current-role.ts`, resume outputs

- [ ] **Step 1: Fix Positions.csv dates (local, gitignored)**

```python
# M1: Added error guard — file is gitignored, may not exist on fresh clone
import csv, os, sys

csv_path = 'data/sources/linkedin/Positions.csv'
if not os.path.exists(csv_path):
    print(f'WARNING: {csv_path} not found. This file is gitignored.')
    print('Manual action required: create/update Positions.csv with correct Arine start date (Mar 2025).')
    sys.exit(1)  # Stop here — do not proceed to ingest with wrong data

rows = []
with open(csv_path, newline='') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        if row['Company Name'] == 'Arine':
            row['Started On'] = 'Mar 2025'
        rows.append(row)
with open(csv_path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
print('Fixed Arine start date to Mar 2025 in Positions.csv')
```

Run with: `python3 -c "$(cat <<'PYEOF'
... paste script above ...
PYEOF
)"`

- [ ] **Step 2: Run ingest**

```bash
npm run ingest -- --force
```

Expected: 17 positions ingested, Autonomize AI first.

- [ ] **Step 3: Run build:prompts**

```bash
npm run build:prompts
```

Expected: 3 prompts written + current-role.ts shows `CURRENT_EMPLOYER = "Autonomize AI"`.

- [ ] **Step 4: Validate data**

```bash
npm run check:quick
```

Expected: all data checks pass (WSL path warning is pre-existing, ignore).

- [ ] **Step 5: Run full test suite (mandatory gate)**

```bash
npm test
```

Expected: 499+ tests pass (includes new data-consistency tests from custom-resume branch). Pay special attention to `tests/data-consistency.test.ts` — these are the fraud-fix date assertions. **STOP if any tests fail.**

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: zero TypeScript errors, all pages compiled.

- [ ] **Step 7: Commit regenerated intermediates**

```bash
git add data/generated/career-data.json lib/generated/system-prompts.ts lib/generated/current-role.ts
git commit -m "chore: regenerate career-data + prompts + current-role after mega-merge

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

### Task 6: Resume regeneration (~$2.90–$3.70 — do once on final state)

**Files:** `Paul-Prae-Resume.md`, `.pdf`, `.docx`, `public/` copies

> **Cost note (M4):** ~$2.90–$3.70 per run (Claude Opus 4.6, max effort). First run after a data change may be higher due to cache miss. Run ONCE on the final merged state.

- [ ] **Step 0: Final test gate before expensive AI call (C6)**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
# Pay special attention to: tests/data-consistency.test.ts
# If ANY test fails: STOP. Do not run generate. Fix the data first.
```

- [ ] **Step 1: Generate resume via Claude API**

```bash
npm run generate -- --force
```

Expected: ~10 min, produces staging.md. Quality score should be ≥ 400.

- [ ] **Step 2: Approve staging resume (H1)**

```bash
# Use --force flag (built-in to approve-resume.ts) — avoids piped stdin fragility
npm run approve -- --force
```

Expected: staging → approved.

- [ ] **Step 3: Export to PDF/DOCX**

```bash
npm run export -- --force
```

Expected: PDF + DOCX generated, public/ copies synced.

- [ ] **Step 4: Spot-check resume content**

```bash
head -40 data/generated/Paul-Prae-Resume.md
```

Verify:

- Autonomize AI is first position with "Apr 2026 – Present"
- Arine has "Mar 2025 – Mar 2026" (NOT Sep 2025)
- Professional summary says "13+ years" (not 15)
- Modular Earth in Projects (not Professional Experience)

- [ ] **Step 5: Check for suppressed skills (L2)**

```bash
# Derive suppressed list from writing-rules.json if available
SUPPRESSED=$(python3 -c "
import json, sys
try:
    with open('data/generated/writing-rules.json') as f:
        rules = json.load(f)
    skills = rules.get('suppressed_skills', [])
    if skills:
        print('|'.join(r'\b' + s + r'\b' for s in skills))
except Exception:
    pass
" 2>/dev/null)
if [ -n "$SUPPRESSED" ]; then
  grep -iE "$SUPPRESSED" data/generated/Paul-Prae-Resume.md \
    && echo "WARNING: Suppressed skills found!" || echo "No suppressed skills"
else
  # Fallback to known list if writing-rules.json not available
  grep -iE "\b(dbt|langchain|n8n|rust)\b" data/generated/Paul-Prae-Resume.md \
    && echo "WARNING: Suppressed skills found!" || echo "No suppressed skills (fallback list)"
fi
```

Expected: no matches.

- [ ] **Step 6: Commit resume outputs**

```bash
git add data/generated/Paul-Prae-Resume.md data/generated/VERSIONS.md public/Paul-Prae-Resume.md public/Paul-Prae-Resume.pdf public/Paul-Prae-Resume.docx
git commit -m "feat: regenerate resume on final mega-merged state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

---

### Task 7: Cleanup pass

**Files:** `.npmrc` (delete), positions.json (verify), resume-quality.ts (verify), backlog.md (update), uat-checklist.md (review)

- [ ] **Step 1: Remove Windows-specific .npmrc**

```bash
test -f .npmrc && git rm .npmrc && git commit -m "chore: remove Windows-specific .npmrc" && git push
```

- [ ] **Step 2: Verify Modular Earth transformation**

```bash
echo "positions.json Modular Earth count:"
grep -c "Modular Earth" data/sources/knowledge/career/positions.json
echo "projects.json Modular Earth count:"
grep -c "Modular Earth" data/sources/knowledge/career/projects.json
```

Expected: 0 in positions, ≥1 in projects.

- [ ] **Step 3: Verify Hyperbloom end-date**

```bash
grep -A5 "hyperbloom" data/sources/knowledge/career/positions.json | grep end_date
```

Expected: `"end_date": "2025-02"` (NOT null, NOT Sep 2025, NOT Aug 2025).

- [ ] **Step 4: Lint check**

```bash
npx eslint . --max-warnings=0 2>&1 | tail -5
```

- [ ] **Step 5: Full release check**

```bash
npm run check
```

Expected: all checks pass (WSL path warning is acceptable).

- [ ] **Step 6: Update backlog.md (H8 — version bump already done)**

Mark the package version bump as complete in `backlog.md` — `package.json` is already at `2.0.0`:

```bash
# Change: - [ ] Bump `package.json` version to `2.0.0` after merging PR #28 to main (currently `0.1.0`)
# To:     - [x] Bump `package.json` version to `2.0.0` after merging PR #28 to main (completed — already at 2.0.0)
```

- [ ] **Step 7: Review UAT checklist for new capabilities (M6)**

```bash
git diff origin/main...HEAD -- docs/uat-checklist.md
```

Review: does the checklist cover tailored resume generation (new from custom-resume-gen)?
If not, add: `- [ ] Tailored resume: generate a tailored resume in chat, verify it renders`

---

### Task 8: QA + PR creation

- [ ] **Step 1: Local smoke test**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:

- Hero text: "Currently Solutions Architect at Autonomize AI"
- Chat: "Where do you work now?" → Autonomize AI
- Chat: "Tell me about Arine" → past tense, Mar 2025 – Mar 2026
- `/resume` page: Autonomize AI first position
- PDF download works
- `/tools` page works

- [ ] **Step 2: Verify Vercel GitHub App is installed (H7)**

```bash
# The Vercel GitHub App (not deploy.yml) creates preview URLs for PRs
# deploy.yml only runs on main — it does NOT create PR previews
gh api /repos/praeducer/paulprae-com/installations 2>/dev/null \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
vercel = [i for i in data if 'vercel' in i.get('app_slug','').lower()]
print('Vercel App installed:', bool(vercel))
"
# If not installed: previews will NOT appear in PR comments
```

- [ ] **Step 3: Create PR as DRAFT (H5)**

```bash
gh pr create --base main --head uat/mega-merge-apr-2026 --draft \
  --title "feat: mega-merge — Autonomize transition + tailored pipeline + quality infra" \
  --body "## Summary
UAT branch combining all 6 non-main branches:
- Autonomize AI career transition + derived current-role tooling
- NVIDIA tailored resume/cover letter pipeline (95%/92% grader scores)
- LLM-as-judge grader + resume validator
- Career data fraud fixes (Hyperbloom, NeuroLex, Decooda dates)
- Data consistency tests (pinned date assertions)
- Writing rules SSOT (v1, Phase A refactor deferred)
- npm audit fixes + project-scoped plugin settings

## Test plan
- [x] npm test: 499+ tests pass
- [x] npm run build: zero TypeScript errors
- [x] npm run check: all release checks pass
- [x] Resume: Autonomize AI first, Arine Mar 2025–Mar 2026
- [x] No suppressed skills in generated output
- [ ] CI: all checks green (gh pr checks <PR_NUMBER>)
- [ ] Vercel preview: all pages render
- [ ] Chat works on preview URL
- [ ] PDF downloads work on preview

## Post-merge follow-up (Phase A SSOT refactor)
See .claude/plans/remaining-phases-ssot.md and GitHub issue (created in Task 8).

Generated with Claude Code"
```

- [ ] **Step 4: Wait for CI to pass (C4)**

```bash
gh pr checks <PR_NUMBER> --watch
# Expected: all checks pass (validate / lint / format / test / build / check:quick / validate build output)
# NOTE: "Post Setup Node.js" cache-saving error is a known cosmetic issue — safe to ignore.
# Do NOT merge to main until all substantive checks are green.
```

- [ ] **Step 5: Verify Vercel preview URL**

The Vercel GitHub App automatically comments on the PR with a preview URL within 2–5 minutes:

```bash
gh pr view <PR_NUMBER> --json comments \
  --jq '.comments[].body' | grep -i "vercel.app" | head -5
```

Open the preview URL and run `docs/uat-checklist.md` manually.

- [ ] **Step 6: Mark PR ready after UAT passes (H5)**

```bash
gh pr ready <PR_NUMBER>
```

- [ ] **Step 7: Create SSOT tracking issue (H9)**

```bash
gh issue create \
  --title "Phase A: SSOT refactor (writing-rules, prompt hydration, duplication removal)" \
  --body "## Background
Deferred from mega-merge-apr-2026. Full plan in .claude/plans/remaining-phases-ssot.md.

## Phases
- Phase A1: writing-rules.json v2 schema
- Phase A3: Prompt hydration system
- Phase A4: Prompt cutovers
- Phase A5: Duplication removal
- Phase A6: Position-overlap invariant detector (fraud prevention — highest priority)
- Phase A7-A9: RAG grounding, fix-fact CLI, provenance manifests

## Priority Order
A6 > A1+A3+A4+A5 > A7-A9" \
  --label "enhancement" \
  --assignee "@me"
```

- [ ] **Step 8: Merge to main (Sunday April 12 or later)**

```bash
gh pr merge <PR_NUMBER> --merge
```

---

### Task 9: Post-deploy verification + cleanup

- [ ] **Step 1: Verify production**

Open `https://paulprae.com` and run through `docs/uat-checklist.md`.

- [ ] **Step 2: Audit Vercel environment variables (M7)**

Check Vercel dashboard manually to confirm these are set for production:
`ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET`

If any new env vars were added by the merged branches, set them on Vercel now.

- [ ] **Step 3: Delete merged branches (C2 — includes copilot/ alias)**

Only after verified production deployment:

```bash
for branch in docs/backlog-apr4-lighthouse-ux docs/autonomize-intro-deliverable \
  chore/audit-fix-and-regen chore/add-project-settings \
  feat/autonomize-ai-career-update copilot/featautonomize-ai-career-update \
  feat/custom-resume-gen; do
  git push origin --delete "$branch" 2>/dev/null \
    && echo "deleted $branch" || echo "skipped $branch (already gone)"
  git branch -d "$branch" 2>/dev/null || true
done
```

- [ ] **Step 4: Close stale PRs (M9 — idempotent with comment)**

PRs auto-close when head branches are deleted. This step closes any that don't:

```bash
for pr in 34 35 36 37 38; do
  gh pr close $pr \
    --comment "Absorbed into uat/mega-merge-apr-2026 and merged to main." 2>/dev/null \
    && echo "Closed PR #$pr" || echo "PR #$pr already closed (ok)"
done
```

- [ ] **Step 5: Create multi-resume hotfix issue (L4)**

```bash
gh issue create \
  --title "Bug: Second tailored resume in same chat session fails without refresh" \
  --body "$(cat .claude/plans/hotfix-multi-resume-bug.md 2>/dev/null \
    || echo 'See .claude/plans/hotfix-multi-resume-bug.md for full details.
Generating more than one tailored resume in the same chat session without refreshing fails after the first one.')" \
  --label "bug" \
  --assignee "@me"
```

---

## Guardrails

1. **Commit and push after EVERY task.** If the machine crashes, GitHub has everything.
2. **Never `git push --force` or `git reset --hard`.** No history rewriting.
3. **Tag before every merge:** `git tag -f pre-merge-BRANCHNAME` (the `-f` flag makes re-runs idempotent).
4. **Run `npm test` after every merge.** Stop if tests fail.
5. **Do NOT run `npm run generate` until Task 6.** ~$2.90–$3.70/run — only on final state.
6. **In WSL Ubuntu, use SSH remote** (`git@github.com:...`). The HTTPS credential helper may fail in WSL due to missing keychain integration. In other environments (macOS, Codespaces, CI), HTTPS with token auth works. Check your remote: `git remote -v`.
7. **Positions.csv is gitignored.** Fix dates locally before ingest. Script has an error guard — it will stop if the file is missing.
8. **Ground-truth dates are in `tests/data-consistency.test.ts`** (pinned assertions). If any position dates conflict during merge, the test file is authoritative.
9. **Plan docs from custom-resume branch** (remaining-phases-ssot.md, content-quality-system-design.md) will be brought in automatically during Task 4 merge. Verify they exist on UAT branch after merge.
10. **Phase A SSOT refactor is OUT OF SCOPE for this merge.** Ship as follow-up PR on main (tracked via GitHub issue created in Task 8).
11. **Use `gh` (not `/home/praeducer/.local/bin/gh`)** throughout — must be in PATH (verified in Pre-Conditions).

## Post-Merge Roadmap (from remaining-phases-ssot.md)

These phases ship as separate PRs AFTER the mega-merge lands on main:

1. **Phase 0.5** — Atomic facts store (`data/facts/*.yaml`), derive pipeline, eliminate 11-copy fact storage
2. **Phase A1** — writing-rules.json v2 schema + typed loader (`lib/writing-rules.ts`)
3. **Phase A3** — Prompt hydration system (`lib/prompts/hydrate-rules.ts`)
4. **Phase A4** — Prompt cutovers (4 system prompts → placeholder substitution)
5. **Phase A5** — Duplication removal (CRITICAL REMINDERS, MAJOR_COMPANIES, Brand Voice block)
6. **Phase A6** — Position-overlap invariant detector (fraud prevention)
7. **Phase A7** — RAG-style fact grounding in generation
8. **Phase A8** — `fix-fact` CLI for atomic corrections
9. **Phase A9** — Provenance manifests + citation grading

Priority order: A6 (fraud prevention) > A1+A3+A4+A5 (SSOT) > 0.5 (atomic facts) > A7-A9 (advanced).

---

## Known Issues Fixed (April 2026)

This section documents all issues found by GitHub Copilot's review and fixed in this revision.

| ID  | Severity | Issue                                                                            | Fix Applied                                                                                         |
| --- | -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --- | -------------------- |
| C1  | Critical | Shallow clone causes merge failures in CI/Codespaces                             | Added `git fetch --unshallow origin` in Pre-Conditions + Task 1 Step 1                              |
| C2  | Critical | `feat/autonomize-ai-career-update` has `copilot/` alias — not fetched explicitly | Added explicit fetch in Task 1 Step 1; added `copilot/` to branch delete loop                       |
| C3  | Critical | PR #36 contradiction: handoff says "out of scope", plan merges it                | **Decision: Option A** — include in mega-merge (handoff's scope was branch-specific, not plan-wide) |
| C4  | Critical | No explicit CI gate before merging to main                                       | Added `gh pr checks <PR_NUMBER> --watch` in Task 8 Step 4                                           |
| C5  | Critical | `git tag` fails on re-run (tag already exists)                                   | Changed all `git tag` to `git tag -f` throughout                                                    |
| C6  | Critical | Resume generation ($3-4 AI call) runs without test gate                          | Added `npm test` gate as Task 6 Step 0                                                              |
| H1  | High     | `echo "y" \| npm run approve` may fail silently in non-TTY                       | Changed to `npm run approve -- --force` (uses built-in `hasForceFlag()`)                            |
| H2  | High     | Hardcoded `/home/praeducer/.local/bin/gh` path is machine-specific               | Replaced all with bare `gh`; added `which gh` check in Pre-Conditions                               |
| H3  | High     | `git checkout -b` fails if branch already exists on resume                       | Changed to idempotent `checkout uat/...                                                             |     | checkout -b uat/...` |
| H4  | High     | No rollback protocol for Task 4 (the hard merge)                                 | Added Task 4 Recovery Protocol block                                                                |
| H5  | High     | PR created as non-draft — premature review requests                              | Added `--draft` flag + `gh pr ready` step after UAT passes                                          |
| H6  | High     | Precondition #2 checks PR body text (subjective)                                 | Replaced with `gh pr checks 37` (programmatic CI check)                                             |
| H7  | High     | Plan implies deploy.yml creates preview URLs — it doesn't                        | Clarified that Vercel GitHub App creates previews; added verification step                          |
| H8  | High     | Backlog still shows version bump as TODO — package.json is already 2.0.0         | Added Task 7 Step 6 to mark backlog item complete                                                   |
| H9  | High     | Phase A SSOT refactor has no GitHub issue — exists only in plan files            | Added `gh issue create` in Task 8 Step 7                                                            |
| H10 | High     | Multi-resume hotfix bug not tracked post-merge                                   | Added hotfix status check in Pre-Conditions; GitHub issue in Task 9 Step 5                          |
| M1  | Medium   | Python CSV patch has no guard if Positions.csv is absent (gitignored)            | Added `os.path.exists` guard with `sys.exit(1)`                                                     |
| M2  | Medium   | `grep -A 500` appendix extraction can truncate silently                          | Replaced with Python `content.split()` extraction                                                   |
| M3  | Medium   | Task 4 Step 10 auto-inserts Modular Earth as career content                      | Changed to verification-only; flags for human review if missing                                     |
| M4  | Medium   | Cost estimate "$3.70" conflicts with backlog's "$2.90"                           | Updated to "~$2.90–$3.70 (cache miss vs hit)" range                                                 |
| M5  | Medium   | .gitignore conflicts across branches not checked                                 | Added `.gitignore` diff checks to Pre-Conditions and Task 1 Step 2                                  |
| M6  | Medium   | UAT checklist may be stale after custom-resume-gen merge                         | Added Task 7 Step 7 to review + update checklist                                                    |
| M7  | Medium   | Vercel env vars not audited post-deploy                                          | Added Task 9 Step 2 manual env var audit                                                            |
| M8  | Medium   | No JSON validation after `git checkout --theirs` for JSON files                  | Added `python3 -m json.tool ... \|\| exit 1` after Steps 3 and 4                                    |
| M9  | Medium   | `gh pr close` produces errors for already-closed PRs                             | Added `2>/dev/null` + success/skip messaging; idempotent loop                                       |
| L1  | Low      | SSH-only guardrail stated as universal — it's WSL-specific                       | Rewritten to clarify WSL context; HTTPS works on macOS/Codespaces/CI                                |
| L2  | Low      | Suppressed skills grep hardcodes list — may miss writing-rules.json additions    | Derive from `writing-rules.json` with fallback to hardcoded list                                    |
| L3  | Low      | Co-author format uses "Opus 4.6 (1M context)" (non-standard)                     | Updated to `Claude Sonnet 4.6 <noreply@anthropic.com>` (current model)                              |
| L4  | Low      | Multi-resume hotfix bug has no GitHub issue                                      | Added `gh issue create` in Task 9 Step 5                                                            |
| L5  | Low      | No state recovery procedure for partial/resumed runs                             | Added State Recovery section at top of plan                                                         |
