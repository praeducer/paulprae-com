# `.claude/plans/` — session entry point

**If you are a fresh Claude Code agent starting in this repo, read this file first.**

This directory holds the in-repo planning docs for ongoing work on `feat/custom-resume-gen` and related branches. These docs are the source of truth for what's done, what's pending, and how to pick up the work. They are designed to survive across Claude Code sessions so you don't have to reconstruct context from git history.

## Current state (as of 2026-04-11)

**Branch:** `feat/custom-resume-gen` · **PR:** [#37](https://github.com/praeducer/paulprae-com/pull/37)

**Primary deliverable:** NVIDIA Global GSI Lead (Healthcare & Life Sciences Ecosystem) tailored resume + cover letter. Paul's top-choice role. Quality-gated and ready to submit.

- **Resume:** `data/generated/tailored/Paul-Prae-Resume-NVIDIA.md` — grader score **38/40 (95%)**, zero critical violations, one stylistic Q4 warning
- **Cover letter:** `data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md` — grader score **47/50 (94%)**, zero critical violations, one stylistic CL5 rhythm warning
- **DOCX exports:** `.docx` files in the same directory, regenerated via `pandoc`

**Authoritative career timeline** (Paul-verified 2026-04-11, pinned in `tests/data-consistency.test.ts`):

| Role                                     | Company             | Start    | End       | Employment Type         |
| ---------------------------------------- | ------------------- | -------- | --------- | ----------------------- |
| Advanced Analytics Consultant            | Slalom Consulting   | Jul 2015 | Jan 2018  | full-time               |
| Senior AI Solutions Architect            | Decooda             | Feb 2018 | Jul 2018  | full-time               |
| Senior AI Engineer                       | NeuroLex Labs       | Feb 2018 | Jul 2018  | **part-time moonlight** |
| Enterprise AI and ML Solutions Architect | Amazon Web Services | Aug 2018 | May 2021  | full-time               |
| Chief AI Officer, Founder                | Hyperbloom          | Jun 2021 | Aug 2025  | self-employed           |
| Chief AI Architect, Senior Manager       | Booz Allen Hamilton | Jul 2024 | Mar 2025  | full-time (concurrent)  |
| Staff AI DataOps Engineer                | Arine               | Sep 2025 | Mar 2026  | full-time               |
| Solutions Architect                      | Autonomize AI       | Apr 2026 | _current_ | full-time               |

**⚠️ Do NOT trust memory files for these dates without cross-checking against `data/generated/career-data.json` or `data/sources/knowledge/career/positions.json`.** See `user_career_timeline.md` in the user-home memory for the history of why — two fraud-detection regressions occurred 2026-04-11, both caused by stale memory files being treated as authoritative.

## Plan documents in this directory

- **`remaining-phases-ssot.md`** — the master plan for the writing-rules SSOT refactor (Phase A1-A9) plus the residual NVIDIA content work (CL5 rhythm). Read this to understand what's still pending and in what order to tackle it.
- **`content-quality-system-design.md`** — the architecture doc for the 5-layer content quality stack (atomic facts → invariants → generation → validator → citation grader → LLM grader). Read this to understand why validator and grader are separate and how fraud detection works at each layer.
- **`mega-merge-strategy.md`** — lives on the **sibling branch** `feat/autonomize-ai-career-update`, not here. It orchestrates merging all 6 feature branches (including this one) into a UAT branch. If you need to see it: `git show origin/feat/autonomize-ai-career-update:.claude/plans/mega-merge-strategy.md`. **Note:** that plan's "ground truth" dates were stale at the time of writing; see my PR #37 comments for corrections.
- **`backlog.md`** — general post-merge automation backlog. Unrelated to the SSOT refactor.
- **`data-model-and-knowledge-base.md`** — older design doc. Historical context; may or may not be current.
- **`hotfix-multi-resume-bug.md`** — historical hotfix log.
- **`human-tasks.md`** — tasks Paul must do by hand (can't be automated from an agent session).
- **`production-monitoring.md`** — observability/monitoring plans.
- **`production-qa-plan.md`** — QA checklist.

## How to pick up the NVIDIA iteration work

If Paul asks you to iterate on the NVIDIA resume or cover letter:

```bash
cd C:/dev/paulprae-com-resume

# 1. Verify you're on the right branch
git status
# Should show: On branch feat/custom-resume-gen

# 2. Check the current grader state
cat data/generated/tailored/Paul-Prae-Resume-NVIDIA.grade.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Overall: {d[\"overallScore\"]}/{d[\"maxScore\"]}')"
cat data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.grade.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Overall: {d[\"overallScore\"]}/{d[\"maxScore\"]}')"

# 3. Read the current content
cat data/generated/tailored/Paul-Prae-Resume-NVIDIA.md
cat data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md

# 4. If you need to regenerate from scratch (costs ~$3 per call)
npm run generate:tailored -- nvidia --force
npm run generate:cover-letter -- nvidia --force

# 5. Grade the regenerated content
npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Resume-NVIDIA.md
npx tsx scripts/grade-content.ts data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md

# 6. Re-export DOCX (pandoc is at a non-default path on Windows)
export PATH="/c/Users/paulp/AppData/Local/Pandoc:$PATH"
pandoc data/generated/tailored/Paul-Prae-Resume-NVIDIA.md -o data/generated/tailored/Paul-Prae-Resume-Nvidia.docx
pandoc data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md -o data/generated/tailored/Paul-Prae-Cover-Letter-Nvidia.docx

# 7. Run the full release check before pushing
npm run check -- --skip-build

# 8. Commit + push
git add -A data/generated/tailored/ data/sources/knowledge/career/
git commit -m "feat(nvidia): iterate tailored content"
git push
```

## How to iterate on a specific rule or add a new writing rule

1. Edit `data/sources/knowledge/content/writing-rules.json` (the current v1 single source of truth)
2. Re-run the grader on current content to see if the new rule fires
3. If needed, regenerate content with the new rule in effect
4. Update `tests/data-consistency.test.ts` if the new rule needs a hard pin
5. The grader auto-reads `writing-rules.json`, so no code changes needed for simple rule updates. For structural changes (new rule categories, new blocklists), see Phase A1 in `remaining-phases-ssot.md`.

## How to check if your fresh session has the correct facts loaded

Run this sanity check before making ANY edit to career data:

```bash
# The authoritative positions should show the correct dates
python3 -c "
import json
with open('data/generated/career-data.json','r',encoding='utf-8') as f:
    data = json.load(f)
targets = {'Arine':'2025-09→2026-03', 'Hyperbloom':'2021-06→2025-08',
           'NeuroLex Labs':'2018-02→2018-07', 'Decooda':'2018-02→2018-07'}
for p in data.get('positions', []):
    if p.get('company') in targets:
        actual = f\"{p.get('startDate')}→{p.get('endDate')}\"
        expected = targets[p.get('company')]
        status = '✅' if actual == expected else '❌'
        print(f'{status} {p.get(\"company\"):20} {actual} (expected {expected})')
"
```

If any row shows ❌, the career data has drifted. DO NOT edit the resumes or career files until you reconcile the drift with Paul.

## Fraud-detection history — read before making date edits

Two separate fraud incidents occurred 2026-04-11:

1. **Hyperbloom** was listed as starting Jan 2020 while Paul was employed at AWS. Paul founded Hyperbloom in Jun 2021, the month after leaving AWS. Fixed in commit `b71db4b`.
2. **NeuroLex + Decooda** were listed with LinkedIn dates (Jan 2018 – May 2020 and Jan 2018 – Aug 2018) that overlapped Slalom and AWS. The correct dates are both Feb 2018 – Jul 2018, with Paul moonlighting at NeuroLex part-time while full-time at Decooda. Fixed in commit `f84b9ad`.

A third near-miss: in session 2 I regressed the correct Arine/Hyperbloom dates to earlier wrong values because I trusted a stale memory file (`user_career_timeline.md`) instead of cross-checking against `data/generated/career-data.json`. Reverted in commit `dd342a1`. The memory file now has a prominent warning section at the top.

**The single most important rule for fresh agents editing career data:** every date, every metric, every claim must be verified against `data/generated/career-data.json` **and** against Paul's direct confirmation before you change anything. Memory files are hints, not authoritative. If you're about to make a "correction" that contradicts `tests/data-consistency.test.ts`, stop and re-verify with Paul — the test is probably right and your mental model is probably wrong.

## PR handoff to the mega-merge agent

PR #37 has 7 comments documenting the state of this branch for the parallel mega-merge agent on `feat/autonomize-ai-career-update`:

1. First session update (plan summary)
2. Second session update (post-recovery + plan files)
3. Mega-merge agent feedback (what to do with each file during the merge)
4. Final session update #1 (Phase A2 validator extraction)
5. Fraud-detection fix #1 (Hyperbloom, root-cause analysis)
6. Fraud-detection fix #2 (NeuroLex/Decooda)
7. Updated plan docs notification

If you are starting a fresh session to continue the mega-merge work, read these comments in order. The conflict matrix in the mega-merge agent's plan was based on expectations from before my session 1 work; several rows have flipped.

## Common gotchas

- **Windows pandoc path:** `pandoc` is not on PATH by default. Use `export PATH="/c/Users/paulp/AppData/Local/Pandoc:$PATH"` before running export commands.
- **`npm run ingest` requires LinkedIn CSVs:** the CSVs in `data/sources/linkedin/` are gitignored and live only in Paul's WSL environment. Running `npm run ingest` without them will fail. `career-data.json` is committed to the repo so you don't need to re-ingest in normal workflows.
- **Suppressed skills:** `dbt`, `LangChain`, `n8n`, `Rust` must NEVER appear in generated output. Pinned in `writing-rules.json.suppress_from_output.skills` and enforced by `tests/data-consistency.test.ts`.
- **Embedded stale snapshots in `career-data.json.knowledge[]`:** the ingest function wraps every JSON file in `data/sources/knowledge/career/` as a content string stored inside `career-data.json.knowledge[]`. If you edit `positions.json` or `projects.json` without running ingest, the embedded snapshots will drift. Currently both are correct (manually fixed via Python during the 2026-04-11 sessions).

## Release check before every push

```bash
npm run check -- --skip-build    # All 8 checks should pass
```

If any check fails, fix it before pushing. The checks are:

1. Data files present (career-data.json + resume.md)
2. Resume quality (basic structural scoring)
3. Public downloads (PDF/DOCX/MD exist + hashes match)
4. WSL path detection
5. Docs (all internal markdown links resolve)
6. ESLint (no errors)
7. Prettier (all files formatted)
8. Tests (all vitest suites pass, currently 505+ tests including the pinned date assertions)

---

_This README was written 2026-04-11 by Claude Opus 4.6 (1M context) as a session-close handoff. Last verified against source: this commit._
