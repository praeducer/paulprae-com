# UAT Mega-Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge all 6 non-main branches into a single UAT branch, QA holistically, then deploy to production before Paul starts at Autonomize AI on Monday April 13, 2026.

**Architecture:** Fresh `uat/mega-merge-apr-2026` branch from `main`. Merge 4 safe branches first, then `feat/autonomize-ai-career-update` (career tooling), then `feat/custom-resume-gen` (tailored pipeline + data corrections). Regenerate all pipeline outputs on the final merged state. Phase A SSOT refactor is deferred to a follow-up PR per the parallel agent's recommendation.

**Tech Stack:** Git (ORT strategy), WSL Ubuntu (~/dev/paulprae-com), SSH remote (`git@github.com:praeducer/paulprae-com.git`), Node.js, Next.js 16, Vitest, Pandoc + Typst, Claude API (Opus 4.6), GitHub CLI (`/home/praeducer/.local/bin/gh`)

---

## Pre-Conditions

Before executing this plan, verify:

1. **Parallel agent is done:** `git fetch --all && git log --oneline origin/main..origin/feat/custom-resume-gen | wc -l` returns ≥ 26
2. **PR #37 body says "ready to merge"** (check via `gh pr view 37`)
3. **All commands run in WSL Ubuntu** (`wsl -d Ubuntu -- bash -lc '...'` or native terminal)
4. **Ground-truth career dates** (from `~/.claude/projects/.../memory/user_career_timeline.md`):
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

- [ ] **Step 1: Fetch and create branch**

```bash
cd ~/dev/paulprae-com
git fetch --all --prune
git checkout main
git pull --ff-only
git checkout -b uat/mega-merge-apr-2026
```

- [ ] **Step 2: Verify preconditions**

```bash
git log --oneline origin/main..origin/feat/custom-resume-gen | wc -l
# Expected: >= 26
git log --oneline origin/main..origin/feat/autonomize-ai-career-update | wc -l
# Expected: 7 (6 commits + 1 plan doc commit)
```

- [ ] **Step 3: Create merge-strategy-framework.md**

Read the Appendix A content from `.claude/plans/mega-merge-strategy.md` on origin/feat/autonomize-ai-career-update:

```bash
git show origin/feat/autonomize-ai-career-update:.claude/plans/mega-merge-strategy.md | grep -A 500 "## Appendix A" | grep -B 500 "## Appendix B" | head -n -1 > .claude/plans/merge-strategy-framework.md
```

If that extraction is messy, just create the file manually with the framework content (branch classification, merge order algorithm, conflict resolution protocol, validation gates, rollback protocol).

- [ ] **Step 4: Create merge-strategy-analysis.md**

Similarly extract Appendix B, or create manually with the Mermaid diagrams (branch topology, merge sequence flowchart, conflict resolution matrix, branch statistics table).

- [ ] **Step 5: Push initial UAT branch**

```bash
git add .claude/plans/merge-strategy-framework.md .claude/plans/merge-strategy-analysis.md
git commit -m "docs: add merge strategy framework + analysis for UAT mega-merge

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push -u origin uat/mega-merge-apr-2026
```

Expected: branch pushed, no errors.

---

### Task 2: Phase 1 merges — safe branches (zero conflicts)

**Files:** `.claude/plans/backlog.md`, `data/generated/deliverables/*`, `.claude/settings.json`, `package-lock.json`

- [ ] **Step 1: Tag + merge docs/backlog-apr4-lighthouse-ux**

```bash
git tag pre-merge-backlog
git merge origin/docs/backlog-apr4-lighthouse-ux --no-edit
git push
```

Expected: clean merge, 1 file changed.

- [ ] **Step 2: Tag + merge docs/autonomize-intro-deliverable**

```bash
git tag pre-merge-intro
git merge origin/docs/autonomize-intro-deliverable --no-edit
git push
```

Expected: clean merge, 1 file changed.

- [ ] **Step 3: Tag + merge chore/audit-fix-and-regen**

```bash
git tag pre-merge-audit
git merge origin/chore/audit-fix-and-regen --no-edit
git push
```

Expected: clean merge. If package-lock.json conflicts, run `npm install` to regenerate.

- [ ] **Step 4: Tag + merge chore/add-project-settings**

```bash
git tag pre-merge-settings
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
git tag pre-merge-autonomize
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

- [ ] **Step 1: Tag + merge with --no-commit**

```bash
git tag pre-merge-custom-resume
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
git add data/sources/knowledge/career/positions.json
```

Then verify: `grep -c "autonomize" data/sources/knowledge/career/positions.json` should return ≥ 1 (Autonomize AI entry exists). `grep -c "Modular Earth" data/sources/knowledge/career/positions.json` should return 0 (removed).

- [ ] **Step 4: Resolve companies.json — accept custom-resume, verify Autonomize**

```bash
git checkout --theirs data/sources/knowledge/career/companies.json
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
cat lib/resume-quality.ts | head -50
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

- [ ] **Step 10: Verify Modular Earth is in projects.json**

The custom-resume branch may have moved Modular Earth to projects. If not:

```bash
grep "Modular Earth" data/sources/knowledge/career/projects.json
```

If not found, add it as a project entry. Check the existing projects.json format and add:

```json
{
  "title": "Modular Earth",
  "description": "Not-for-profit organization building free, open-source AI agents to help working-class entrepreneurs generate wealth. Active projects include a career assistant and financial planning assistant.",
  "url": "https://github.com/Modular-Earth-LLC",
  "startDate": "2022-12"
}
```

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

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 5: Post-merge regeneration

**Files:** `career-data.json`, `system-prompts.ts`, `current-role.ts`, resume outputs

- [ ] **Step 1: Fix Positions.csv dates (local, gitignored)**

```bash
python3 -c "
import csv
rows = []
with open('data/sources/linkedin/Positions.csv', newline='') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        if row['Company Name'] == 'Arine':
            row['Started On'] = 'Mar 2025'
        rows.append(row)
with open('data/sources/linkedin/Positions.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
print('Fixed Arine start date to Mar 2025 in Positions.csv')
"
```

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

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: 499+ tests pass (includes new data-consistency tests from custom-resume branch).

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: zero TypeScript errors, all pages compiled.

- [ ] **Step 7: Commit regenerated intermediates**

```bash
git add data/generated/career-data.json lib/generated/system-prompts.ts lib/generated/current-role.ts
git commit -m "chore: regenerate career-data + prompts + current-role after mega-merge

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 6: Resume regeneration ($3.70 — do once on final state)

**Files:** `Paul-Prae-Resume.md`, `.pdf`, `.docx`, `public/` copies

- [ ] **Step 1: Generate resume via Claude API**

```bash
npm run generate -- --force
```

Expected: ~10 min, produces staging.md. Quality score should be ≥ 400.

- [ ] **Step 2: Approve staging resume**

```bash
echo "y" | npm run approve
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

- [ ] **Step 5: Check for suppressed skills**

```bash
grep -iE "\b(dbt|langchain|n8n|rust)\b" data/generated/Paul-Prae-Resume.md
```

Expected: no matches.

- [ ] **Step 6: Commit resume outputs**

```bash
git add data/generated/Paul-Prae-Resume.md data/generated/VERSIONS.md public/Paul-Prae-Resume.md public/Paul-Prae-Resume.pdf public/Paul-Prae-Resume.docx
git commit -m "feat: regenerate resume on final mega-merged state

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 7: Cleanup pass

**Files:** `.npmrc` (delete), positions.json (verify), resume-quality.ts (verify)

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

- [ ] **Step 2: Create PR for Vercel preview**

```bash
/home/praeducer/.local/bin/gh pr create --base main --head uat/mega-merge-apr-2026 \
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
- [ ] Vercel preview: all pages render
- [ ] Chat works on preview URL
- [ ] PDF downloads work on preview

## Post-merge follow-up (Phase A SSOT refactor)
See .claude/plans/remaining-phases-ssot.md for planned work:
- writing-rules.json v2 schema
- Prompt hydration system
- Duplication removal

Generated with Claude Code"
```

- [ ] **Step 3: Verify Vercel preview**

Wait for Vercel deployment (check PR comments for preview URL). Test:

- Pages load
- Chat works
- Resume downloads work

- [ ] **Step 4: Merge to main (Sunday April 12 or later)**

```bash
/home/praeducer/.local/bin/gh pr merge <PR_NUMBER> --merge
```

---

### Task 9: Post-deploy verification + cleanup

- [ ] **Step 1: Verify production**

Open `https://paulprae.com` and run through `docs/uat-checklist.md`.

- [ ] **Step 2: Delete merged branches**

Only after verified production deployment:

```bash
for branch in docs/backlog-apr4-lighthouse-ux docs/autonomize-intro-deliverable \
  chore/audit-fix-and-regen chore/add-project-settings \
  feat/autonomize-ai-career-update feat/custom-resume-gen; do
  git push origin --delete "$branch" 2>/dev/null
  git branch -d "$branch" 2>/dev/null
done
```

- [ ] **Step 3: Close stale PRs**

```bash
for pr in 34 35 36 37 38; do
  /home/praeducer/.local/bin/gh pr close $pr 2>/dev/null
done
```

(Most will auto-close when branches are deleted.)

---

## Guardrails

1. **Commit and push after EVERY task.** If the machine crashes, GitHub has everything.
2. **Never `git push --force` or `git reset --hard`.** No history rewriting.
3. **Tag before every merge:** `git tag pre-merge-BRANCHNAME`.
4. **Run `npm test` after every merge.** Stop if tests fail.
5. **Do NOT run `npm run generate` until Task 6.** $3.70/run — only on final state.
6. **SSH remote only.** HTTPS credential helper fails in WSL.
7. **Positions.csv is gitignored.** Fix dates locally before ingest.
8. **Ground-truth dates are in `tests/data-consistency.test.ts`** (pinned assertions). If any position dates conflict during merge, the test file is authoritative.
9. **Plan docs from custom-resume branch** (remaining-phases-ssot.md, content-quality-system-design.md) will be brought in automatically during Task 4 merge. Verify they exist on UAT branch after merge.
10. **Phase A SSOT refactor is OUT OF SCOPE for this merge.** Ship as follow-up PR on main.

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
