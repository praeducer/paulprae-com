# Autonomize Transition — Human Runbook

**Branch:** `feat/autonomize-ai-career-update`
**Intended merge date:** Sunday, April 12, 2026 (day before you start Monday April 13)
**PR:** open and ready to review after push (see GitHub)

## What this PR does

Two things, intentionally bundled because the second one is the test of the first:

1. **Phase 2 — Career-data refactor (tooling).** Eliminates hardcoded "Arine" strings across prompts, hero copy, quick actions, and quality checks. The current employer is now derived from `data/generated/career-data.json` at build time, so future career changes only require updating the source data — prompts and constants auto-regenerate.
2. **Phase 1 — Data update (Arine → Autonomize AI).** End-dates Arine at March 2026, adds Autonomize AI as the new primary role starting April 2026. Runs the full pipeline (ingest → build:prompts → generate → approve → export) and commits the regenerated outputs.

Two intervening roles between Arine and Autonomize are intentionally omitted per your earlier instruction.

## Before you merge

1. **Read the PR diff.** Pay attention to:
   - `data/generated/Paul-Prae-Resume.md` — the AI-regenerated resume. Spot-check:
     - Autonomize AI is the first position with "Apr 2026 – Present"
     - Arine is second with "Sep 2025 – Mar 2026" (past tense, no "Currently")
     - Professional summary opens with Autonomize, not Arine
     - No invented metrics for Autonomize (I left metrics empty pending your input)
   - `lib/generated/current-role.ts` — the new generated constants file. Should list Autonomize.
   - `data/sources/linkedin/Positions.csv` — root source of truth. Arine row has "Mar 2026" in "Finished On"; new Autonomize row at top.
2. **Run locally** (WSL Ubuntu — pandoc + typst required):
   ```bash
   cd ~/dev/paulprae-com
   git checkout feat/autonomize-ai-career-update
   npm install          # if deps changed
   npm run check        # full pre-push release check
   npm run dev          # local smoke test
   ```
3. **Smoke test on `localhost:3000`:**
   - Hero text mentions Autonomize AI (not Arine)
   - Chat: "Where do you work now?" → Autonomize AI
   - Chat: "Tell me about your time at Arine" → past tense, Sep 2025 – Mar 2026
   - `/resume` page shows Autonomize as the first position
   - Resume PDF download works and renders Autonomize first
4. **Download the new PDF** from `public/Paul-Prae-Resume.pdf` and eyeball it for formatting.

## If the AI-generated resume needs a second pass

The pipeline ran once and was auto-approved on commit. To iterate:

```bash
npm run generate:force   # regenerates Paul-Prae-Resume.staging.md
npm run compare          # interactive side-by-side review; promotes on accept
npm run approve          # if you skipped compare and want to promote
npm run export:force     # rebuild PDF + DOCX and sync to public/
git add -u && git commit -m "chore: refine AI-generated resume"
git push
```

If you want a LLM-judged comparison of versions:

```bash
npm run compare -- --judge
```

## If you need to add Autonomize metrics later

Edit `data/sources/knowledge/career/companies.json` and fill in the `metrics` object on the `autonomize-ai` entry. Then:

```bash
npm run build:prompts    # re-bakes prompts with new metrics
npm run generate:force   # resume can now cite the metrics
npm run approve
npm run export:force
```

## The "next career update is trivial" promise

This PR sets up a pattern where the next career change (new job, new cert, new project, new publication) touches as few files as possible. The refactor is minimal on purpose — I didn't build the full `npm run career:*` CLI suggested in the plan file because time was short. The _foundations_ are in place:

- `lib/career-data.ts` exports `getCurrentRole()`, `getCurrentEmployer()`, `formatCurrentRoleSentence()`, `formatCurrentRoleHero()`
- `scripts/build-prompts.ts` emits `lib/generated/current-role.ts` alongside `lib/generated/system-prompts.ts`
- `lib/constants.ts` imports from the generated file (no more hardcoded employer)
- `lib/agent/context.ts` substitutes `{{CURRENT_ROLE_SENTENCE}}` in prompt templates
- `lib/prompts/career-chat.few-shot.md` uses the placeholder

To trivialize the **next** change:

1. Update `data/sources/linkedin/Positions.csv` (end old role, add new row).
2. Update `data/sources/knowledge/career/companies.json` if it's a new employer.
3. Run `npm run pipeline` — ingest, build:prompts, generate, export all run in sequence.
4. Review the staging resume with `npm run compare`, promote with `npm run approve`.
5. Commit and push.

The CLI wrapper (`npm run career:add-job`, etc.) is tracked as backlog in `docs/career-updates.md` (to be written after Phase 1 ships).

## Known deferred items

- **`positions.json` ↔ `Positions.csv` sync drift** — the knowledge-base JSON is wrapped as Claude context but does NOT drive structured position data. I updated it for consistency, but the cleaner fix is to make JSON the canonical source and deprecate CSV for positions. That's a larger refactor, not in this PR.
- **`tests/resume-parser.test.ts`** — I kept Arine in the MAJOR_COMPANIES list so the assertion still passes (Arine is still in the resume, just past tense).
- **`docs/examples/tailored-resume-*.md`** — 3 historical artifacts that still reference Arine as current. Per your earlier decision, leave them alone.
- **PR #36 (Autonomize team intro deliverable)** — separate, already-open PR. Not touched by this work.

## If you're blocked or want to start over

All my edits are in the git history of this branch. To drop the tooling refactor and do a minimal data-only update:

```bash
git checkout main
git checkout -b feat/autonomize-minimal
# Edit data/sources/linkedin/Positions.csv only
# Edit lib/constants.ts HERO_DESCRIPTION only
npm run pipeline
git add -u && git commit -m "feat: swap Arine for Autonomize AI (minimal)"
git push -u origin feat/autonomize-minimal
```

But you'll be stuck with the same hardcoded-employer problem next time.

## Continuation context for future Claude Code sessions

See `.claude/plans/autonomize-transition-agent-handoff.md`.
