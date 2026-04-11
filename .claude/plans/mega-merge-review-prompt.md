# Mega-Merge Strategy: Comprehensive Review Prompt for Claude Opus

> **Context:** This prompt was authored by a Claude Code agent (April 11, 2026) after a full audit of
> `.claude/plans/mega-merge-strategy.md`, all related plan files, every open PR (#34–#38), the full
> branch topology, CI/deploy workflows, and the repository's current state.
>
> **How to use:** Paste this entire document into a new Claude Opus conversation (or a Claude Code
> session on the `feat/autonomize-ai-career-update` branch) and instruct it to execute every action
> item below. Address all Critical issues before proceeding to High, Medium, and Low.

---

## Your Mission

You are a senior Staff Engineer, DevOps lead, and Git strategist reviewing and fixing the
`mega-merge-strategy.md` plan for the `paulprae-com` repository. The plan lives at:
`.claude/plans/mega-merge-strategy.md` on branch `feat/autonomize-ai-career-update`.

You must:

1. Read and internalize the current plan and ALL related files listed in the **Required Reading** section below.
2. Fix every issue in the **Issue Inventory** (Critical → High → Medium → Low, in that order).
3. Rewrite the relevant sections of `mega-merge-strategy.md` in-place with corrections applied.
4. Add a `## Known Issues Fixed (April 2026)` section at the bottom of the plan documenting what changed and why.
5. Commit each logical batch of fixes with a clear commit message and push immediately.

Do not start any of the merge steps described in the plan — this is a planning/editing pass only.

---

## Required Reading (Read These First, In Order)

Before touching anything, read all of these files in full:

```bash
cat .claude/plans/mega-merge-strategy.md
cat .claude/plans/autonomize-transition-agent-handoff.md
cat .claude/plans/autonomize-transition-human-runbook.md
cat .claude/plans/hotfix-multi-resume-bug.md
cat .claude/plans/backlog.md
cat .claude/plans/human-tasks.md
cat .github/workflows/ci.yml
cat .github/workflows/deploy.yml
cat scripts/approve-resume.ts
cat package.json | python3 -c "import json,sys; p=json.load(sys.stdin); print('version:', p['version'])"
```

Then check the live branch state:

```bash
git fetch --unshallow origin 2>/dev/null || true
git fetch --all --prune
git branch -a
git log --all --oneline --graph
gh pr list --state open
```

---

## Issue Inventory

Issues are ordered: Critical → High → Medium → Low. Fix all Critical and High issues before
committing. Medium and Low can be batched into a second commit.

---

### CRITICAL — Must Fix Before Plan Is Executable

---

#### C1 — Shallow Clone / Unshallow Requirement

**File:** `mega-merge-strategy.md`, Task 1 Step 1

**Problem:** The plan opens Task 1 Step 1 with `git fetch --all --prune`. In agent environments,
GitHub Codespaces, or CI with `actions/checkout` (which defaults to depth=1), this will NOT fetch
full branch history. The subsequent `git merge` calls require common ancestors, which a shallow
clone lacks. The merge will fail with `"refusing to merge unrelated histories"` or incorrect
conflict detection.

**Fix:** Prepend a `git fetch --unshallow origin` step with graceful failure handling:

```bash
# Task 1, Step 1 — UPDATED:
cd ~/dev/paulprae-com
git fetch --unshallow origin 2>/dev/null || echo "Already full clone, continuing..."
git fetch --all --prune
git checkout main
git pull --ff-only
git checkout -b uat/mega-merge-apr-2026 2>/dev/null || git checkout uat/mega-merge-apr-2026
```

Note the idempotent `checkout` pattern — see also C5.

---

#### C2 — Branch Name Discrepancy: `copilot/` Prefix

**File:** `mega-merge-strategy.md`, Task 3 Step 1 and Task 9 Step 2–3

**Problem:** The `feat/autonomize-ai-career-update` branch is also exposed under the alias
`copilot/featautonomize-ai-career-update` in agent environments (both point to SHA e9b5a7d).
The plan exclusively references `feat/autonomize-ai-career-update` in all merge commands. When an
agent executes this plan, `origin/feat/autonomize-ai-career-update` may not resolve unless the
branch is explicitly fetched by exact name.

**Fix:** Add an explicit fetch in Task 1 Step 1 and add a verification step:

```bash
# After fetch --all, explicitly ensure both ref names resolve:
git fetch origin feat/autonomize-ai-career-update:refs/remotes/origin/feat/autonomize-ai-career-update 2>/dev/null || true
git fetch origin copilot/featautonomize-ai-career-update:refs/remotes/origin/feat/autonomize-ai-career-update 2>/dev/null || true
# Verify:
git log --oneline origin/feat/autonomize-ai-career-update -3 || echo "ERROR: branch not found — fetch failed"
```

Also update Task 9 Step 2 cleanup loop to include the `copilot/` variant:

```bash
for branch in docs/backlog-apr4-lighthouse-ux docs/autonomize-intro-deliverable \
  chore/audit-fix-and-regen chore/add-project-settings \
  feat/autonomize-ai-career-update copilot/featautonomize-ai-career-update \
  feat/custom-resume-gen; do
  git push origin --delete "$branch" 2>/dev/null && echo "deleted $branch" || echo "skipped $branch (already gone)"
  git branch -d "$branch" 2>/dev/null || true
done
```

---

#### C3 — PR #36 Contradiction: "Separate Branch" vs. "Merge Into UAT"

**File:** `mega-merge-strategy.md`, Task 2 Step 2 vs. `autonomize-transition-agent-handoff.md`
"Out of scope (do NOT touch)"

**Problem:** Task 2 Step 2 merges `docs/autonomize-intro-deliverable` into the UAT branch. The
handoff doc (`autonomize-transition-agent-handoff.md`) explicitly says:

> "PR #36 — the Autonomize team intro deliverable. Separate PR, separate branch. Out of scope (do
> NOT touch)."

These instructions directly contradict each other. Executing both would: (a) incorporate deliverable
docs into the mega-merge PR, (b) create a second PR for the same content, and (c) cause PR #36 to
target `main` while UAT absorbs its content, creating a duplicate merge risk.

**Fix:** Choose ONE of the following strategies and document it explicitly in the plan:

**Option A (Recommended):** Include `docs/autonomize-intro-deliverable` in the UAT merge. This is
the simpler path — the deliverable doc is static, low-risk, and Paul presumably wants it on main
before starting. Update the plan to say: "PR #36 is included in this mega-merge. After the UAT PR
merges to main, PR #36 will auto-close (or close it manually)."

**Option B:** Remove `docs/autonomize-intro-deliverable` from Task 2 entirely. Add a note: "PR #36
ships independently. Do NOT merge `docs/autonomize-intro-deliverable` into the UAT branch; it stays
on its own path to main." Then remove it from the Task 9 Step 3 close list.

After choosing, add a "Decision" callout to the plan at the top of Task 2 Step 2.

---

#### C4 — CI Only Runs on `main`-Targeted PRs

**File:** `mega-merge-strategy.md`, Task 8 Step 2–3 and Task 8 Step 4

**Problem:** `.github/workflows/ci.yml` triggers on:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

This means CI runs when the UAT branch PR targets `main` — which is correct. However, the plan
says "wait for Vercel preview" in Step 3 without ever mentioning CI. The plan must explicitly gate
the merge-to-main on CI passing, since `main` is branch-protected.

The deploy workflow (`deploy.yml`) only runs on `workflow_run: workflows: ["CI"]` on `main` pushes.
It does NOT deploy Vercel previews for PRs — Vercel does that via its GitHub integration, separately.

**Fix:** Replace Task 8 Step 3 with a proper two-gate check:

```bash
# Step 3a: Wait for CI to pass
gh pr checks <PR_NUMBER> --watch
# Expected: All checks pass (ci / lint / format / test / build / validate)

# Step 3b: Verify Vercel preview URL (from Vercel GitHub App comment)
gh pr view <PR_NUMBER> --json comments --jq '.comments[-3:][].body' | grep "vercel.app"
# Then manually open the preview URL and run UAT checklist
```

Add a guardrail: "Do NOT merge to main until `gh pr checks <PR_NUMBER>` shows all green."

---

#### C5 — Tag Collision on Plan Re-execution

**File:** `mega-merge-strategy.md`, Task 2 Steps 1–4, Task 3 Step 1, Task 4 Step 1

**Problem:** The plan creates tags like `pre-merge-backlog`, `pre-merge-intro`, etc. with plain
`git tag`. If the plan is restarted (machine crash, agent timeout, second attempt), every `git tag`
command fails with:

```
fatal: tag 'pre-merge-backlog' already exists
```

This halts the merge process.

**Fix:** Use `git tag -f` (force) everywhere tags are created, and add a verification step:

```bash
git tag -f pre-merge-backlog  # -f overwrites if exists, idempotent
git merge origin/docs/backlog-apr4-lighthouse-ux --no-edit
git push --follow-tags
```

Also add to the Pre-Conditions section: "Check for stale tags from previous attempts:
`git tag | grep pre-merge` — if any exist, use `git tag -d <name>` to remove them, or use
`git tag -f` throughout (which this plan now does)."

---

#### C6 — Resume Generation Runs Without Mandatory Test Gate

**File:** `mega-merge-strategy.md`, Task 6 Step 1

**Problem:** Task 6 runs `npm run generate -- --force` (the expensive AI call: ~$3–4) but there is
no explicit `npm test` step immediately before it on the final merged state. Task 5 Step 5 runs
`npm test` before committing intermediates, but Task 6 follows after new pipeline outputs are
written. If any pipeline output from Task 5 is inconsistent with the test suite, `npm run generate`
would spend money on data that fails CI.

More critically: `tests/data-consistency.test.ts` from the `feat/custom-resume-gen` branch contains
pinned date assertions that are the "source of truth" for fraud-fixed career dates. If this test
file exists on the UAT branch (it should, from Task 4), it MUST pass before generation.

**Fix:** Add a mandatory gate immediately before Task 6 Step 1:

```bash
# Step 0 (NEW): Final test gate before expensive AI generation
npm test -- --reporter=verbose 2>&1 | tail -20
# If any test fails: STOP. Do not run generate. Fix the data first.
# Pay special attention to: tests/data-consistency.test.ts
```

---

### HIGH — Must Fix Before Plan Is Trustworthy

---

#### H1 — `approve` Command Piping Fragility

**File:** `mega-merge-strategy.md`, Task 6 Step 2

**Problem:** `echo "y" | npm run approve` may fail silently. The `approve-resume.ts` script uses
`readline.createInterface({ input: process.stdin })` which may not respond to piped input in all
terminal/TTY configurations. The script has an explicit `--force` / `hasForceFlag()` path:

```typescript
// From scripts/approve-resume.ts:
import { hasForceFlag } from "../lib/script-utils";
```

**Fix:** Replace `echo "y" | npm run approve` with:

```bash
npm run approve -- --force
```

This uses the built-in force flag, bypasses interactive confirmation, and is guaranteed to work
in non-TTY environments (agents, CI, WSL pipe mode).

---

#### H2 — `gh` CLI Path Is Machine-Specific

**File:** `mega-merge-strategy.md`, Task 8 Steps 2 and 4, Task 9 Steps 2 and 3

**Problem:** All `gh` invocations use `/home/praeducer/.local/bin/gh`. This hardcoded path breaks
on any other machine, GitHub Codespaces, CI runners, or agent environments. If `gh` is installed
to a different location (e.g., `/usr/local/bin/gh`, `/usr/bin/gh`, or `~/.local/bin/gh` for a
different user), every PR and cleanup command fails.

**Fix:** Replace all `/home/praeducer/.local/bin/gh` with `gh` (rely on PATH). Add to Task 1 a
precondition verification:

```bash
# Verify gh CLI is available
which gh || { echo "ERROR: gh CLI not found in PATH. Install from https://cli.github.com/"; exit 1; }
gh auth status || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }
```

---

#### H3 — UAT Branch Already-Exists Guard

**File:** `mega-merge-strategy.md`, Task 1 Step 1

**Problem:** `git checkout -b uat/mega-merge-apr-2026` fails if the branch already exists:

```
fatal: A branch named 'uat/mega-merge-apr-2026' already exists.
```

This halts execution if the plan is being resumed after a partial run.

**Fix:** Use idempotent checkout:

```bash
git checkout uat/mega-merge-apr-2026 2>/dev/null || git checkout -b uat/mega-merge-apr-2026
```

Add a note: "If the branch already exists remotely, add:
`git pull origin uat/mega-merge-apr-2026 --ff-only` after checkout to sync."

---

#### H4 — No Explicit Rollback Protocol for Task 4 (The Hard Merge)

**File:** `mega-merge-strategy.md`, Task 4

**Problem:** Task 4 is labeled "THE HARD ONE" and involves 8 conflict zones across 41 changed files.
Despite the complexity, there are no rollback instructions if the merge goes wrong mid-resolution.
If an agent gets confused mid-conflict (e.g., partially resolves files incorrectly), there is no
safe recovery path described.

**Fix:** Add a "Recovery Protocol" block at the start of Task 4:

````markdown
#### Task 4 Recovery Protocol

If any step in Task 4 goes wrong:

1. **Abort the merge:** `git merge --abort`
2. **Verify clean state:** `git status` — should show "nothing to commit"
3. **Clean up the tag:** `git tag -d pre-merge-custom-resume`
4. **Start Task 4 fresh:** Re-run from Step 1

If you committed a bad merge and need to revert:

```bash
# Revert the merge commit (creates a new commit that undoes it)
git revert -m 1 HEAD
git push
```
````

Never use `git reset --hard` or `git push --force` — these are prohibited per the guardrails.

````

---

#### H5 — PR Should Be Created as Draft

**File:** `mega-merge-strategy.md`, Task 8 Step 2

**Problem:** The `gh pr create` command in Task 8 Step 2 creates a non-draft PR. Paul needs to:
(1) receive the PR, (2) wait for Vercel preview, (3) run UAT manually. Creating a non-draft PR
puts it in "ready for review" state immediately, which may prematurely request reviews and trigger
notifications before UAT passes.

**Fix:** Add `--draft` flag:

```bash
gh pr create --base main --head uat/mega-merge-apr-2026 --draft \
  --title "feat: mega-merge — Autonomize transition + tailored pipeline + quality infra" \
  --body "..."
````

Add a note: "After UAT passes on the preview URL, mark the PR ready:
`gh pr ready <PR_NUMBER>`"

---

#### H6 — Pre-condition #2 Is Subjective (No CI Verification)

**File:** `mega-merge-strategy.md`, Pre-Conditions section, item 2

**Problem:** Pre-condition #2 says: "PR #37 body says 'ready to merge' (check via `gh pr view 37`)".
This relies on a human having updated the PR body text, which is a weak signal. The actual
requirement is that PR #37's CI checks pass and the code is in a mergeable state.

**Fix:** Replace with a programmatic check:

```bash
# Pre-condition 2: Verify feat/custom-resume-gen is CI-clean
gh pr checks 37 --watch
# Expected: All checks pass — if any fail, stop and fix before proceeding
# Also verify commit count:
git fetch --all && git log --oneline origin/main..origin/feat/custom-resume-gen | wc -l
# Expected: >= 26 commits ahead of main
```

---

#### H7 — Deploy Workflow Does Not Deploy UAT Branch

**File:** `mega-merge-strategy.md`, Task 8 Step 3

**Problem:** The plan says "Wait for Vercel deployment (check PR comments for preview URL)" without
explaining where the preview comes from. The `deploy.yml` workflow only runs on successful CI on
`main` merges — it does NOT create PR previews. Vercel previews come from the Vercel GitHub App,
which auto-deploys every PR branch.

If the Vercel GitHub App is not installed or is not configured for the repository, there will be NO
preview URL in PR comments, and this step will hang indefinitely.

**Fix:** Add an explicit verification step before the UAT PR is created:

```bash
# Verify Vercel GitHub App is installed (pre-condition for preview URLs)
gh api /repos/praeducer/paulprae-com/installations 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
vercel = [i for i in data if 'vercel' in i.get('app_slug','').lower()]
print('Vercel App installed:', bool(vercel))
"
```

And update Step 3 instructions to say: "The Vercel GitHub App automatically creates a preview
deployment for every PR. Check PR comments for a comment from the `vercel` bot containing the
preview URL. This typically appears within 2–5 minutes of PR creation."

---

#### H8 — Package Version Already 2.0.0 — Backlog Item Complete

**File:** `mega-merge-strategy.md`, Post-Merge Roadmap; `backlog.md`

**Problem:** The backlog says "Bump `package.json` version to `2.0.0` after merging PR #28 to main
(currently `0.1.0`)." The current `package.json` shows `"version": "2.0.0"`. This task is already
complete and should be marked done in the backlog.

**Fix:** Update `.claude/plans/backlog.md` to mark the version bump as complete:
Change `- [ ] Bump package.json version to 2.0.0` to `- [x] Bump package.json version to 2.0.0`
and add a note `(completed — already at 2.0.0)`.

---

#### H9 — No SSOT Refactor Tracking Issue Created

**File:** `mega-merge-strategy.md`, Guardrail #10 and Post-Merge Roadmap

**Problem:** "Phase A SSOT refactor is OUT OF SCOPE for this merge" is mentioned three times. No
GitHub issue is created to track this work, so it exists only in plan files. Plan files get stale;
GitHub Issues persist across sessions and can be linked to milestones.

**Fix:** After completing the merge (Task 8), create a tracking issue:

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

---

#### H10 — Hotfix Bug (#multi-resume) Not Addressed in Merge Context

**File:** `mega-merge-strategy.md` (absent); `hotfix-multi-resume-bug.md`

**Problem:** `hotfix-multi-resume-bug.md` describes an open bug: "Generating more than one tailored
resume in the same chat session without refreshing fails after the first one." This bug is NOT
mentioned in the mega-merge plan at all. If `feat/custom-resume-gen` introduces a `lib/tailored.ts`
and new resume generation pipelines, the bug may interact with those changes.

**Fix:** Add to the Pre-Conditions section:

> **Hotfix Status Check:** Verify whether the multi-resume bug (documented in
> `hotfix-multi-resume-bug.md`) has been fixed on either `feat/custom-resume-gen` or `main`.
> If unfixed, add a TODO to create a `fix/multi-resume-tool-call` branch from `main` AFTER
> this mega-merge lands. Do NOT mix the hotfix into the UAT branch.
>
> ```bash
> gh issue list --label "bug" | grep -i "resume"
> # If no issue exists, create one after the mega-merge lands
> ```

---

### MEDIUM — Should Fix Before Final Review

---

#### M1 — Python CSV Patch Is Fragile (No Error Handling)

**File:** `mega-merge-strategy.md`, Task 5 Step 1

**Problem:** The Python CSV patching script has no error handling. If `Positions.csv` doesn't exist
(fresh clone, different machine, or gitignored file absent), the script silently does nothing and
ingest will use wrong dates.

**Fix:** Add a guard at the top of the Python script:

```python
import csv, os, sys

csv_path = 'data/sources/linkedin/Positions.csv'
if not os.path.exists(csv_path):
    print(f'WARNING: {csv_path} not found. This file is gitignored.')
    print('Manual action required: create/update Positions.csv with correct Arine start date (Mar 2025).')
    sys.exit(1)  # Stop here — do not proceed to ingest with wrong data
```

---

#### M2 — Appendix Extraction via `grep -A 500` Is Fragile

**File:** `mega-merge-strategy.md`, Task 1 Steps 3–4

**Problem:** Extracting appendix content via `git show | grep -A 500 "## Appendix A" | grep -B 500 "## Appendix B"` is fragile:

- If Appendix A is more than 500 lines, content is truncated silently
- If section headings change, the grep silently produces empty output
- The `head -n -1` to remove last line is shell-version dependent

**Fix:** Replace with a direct Python extraction approach:

```bash
# Task 1, Steps 3–4 (UPDATED):
git show origin/feat/autonomize-ai-career-update:.claude/plans/mega-merge-strategy.md \
  | python3 -c "
import sys
content = sys.stdin.read()
sections = content.split('## Appendix ')
if len(sections) < 2:
    print('ERROR: No Appendix sections found in mega-merge-strategy.md')
    sys.exit(1)
with open('.claude/plans/merge-strategy-framework.md', 'w') as f:
    f.write('## Appendix ' + sections[1].split('## Appendix')[0].strip())
print('Created merge-strategy-framework.md')
if len(sections) >= 3:
    with open('.claude/plans/merge-strategy-analysis.md', 'w') as f:
        f.write('## Appendix ' + sections[2].strip())
    print('Created merge-strategy-analysis.md')
"
```

---

#### M3 — Modular Earth in projects.json Is a Career Decision

**File:** `mega-merge-strategy.md`, Task 4 Step 10

**Problem:** Task 4 Step 10 instructs the agent to add a Modular Earth entry to `projects.json`
if not found. This is a career data decision — it affects how Paul's professional work is presented
to recruiters via the AI chat. Agents should not auto-insert career content without human review.

**Fix:** Change Step 10 to a verification-only step:

````markdown
**Step 10: Verify Modular Earth transformation (human review required if missing)**

Check:

```bash
grep -c "Modular Earth" data/sources/knowledge/career/positions.json
grep -c "Modular Earth" data/sources/knowledge/career/projects.json
```
````

If Modular Earth is in `positions.json`: this is incorrect — it should be removed (the
`custom-resume-gen` branch handles this). If it is NOT in `projects.json`, do NOT auto-add it.
Instead, add a TODO comment and flag to Paul in the PR description:

> "ACTION REQUIRED (Paul): Modular Earth was removed from positions.json but is not in projects.json.
> Please add it manually with correct project description if you want it to appear as a project."

````

---

#### M4 — Cost Estimate Is Stale

**File:** `mega-merge-strategy.md`, Task 6 Step 1

**Problem:** Task 6 Step 1 says "$3.70" for the resume generation. The `backlog.md` says "~$2.90
per run (Claude Opus 4.6, max effort, ~453s)." The discrepancy suggests plan drift.

**Fix:** Update to: "Expected cost: ~$2.90–$3.70 (varies with prompt cache hit rate; first run
after data change may be more expensive due to cache miss). Run ONCE on the final merged state."

---

#### M5 — `.gitignore` Consistency Not Verified Across Branches

**File:** `mega-merge-strategy.md`, Actual Conflict Zones table

**Problem:** The conflict matrix lists 8 files across the two major feature branches. It does not
mention `.gitignore`. If any of the 6 branches modified `.gitignore` in conflicting ways, this
creates an untracked 9th conflict zone.

**Fix:** Add to Task 1 Step 2 (verify preconditions):

```bash
# Check if .gitignore conflicts exist between branches
git diff origin/main...origin/feat/custom-resume-gen -- .gitignore | head -30
git diff origin/main...origin/feat/autonomize-ai-career-update -- .gitignore | head -30
# If both show changes, add .gitignore to the conflict matrix with resolution strategy
````

---

#### M6 — UAT Checklist May Be Stale After custom-resume-gen Merge

**File:** `mega-merge-strategy.md`, Task 8 Step 1

**Problem:** `docs/uat-checklist.md` was updated by `feat/autonomize-ai-career-update` to change
the current-role assertion to Autonomize AI. The `feat/custom-resume-gen` branch may have also
touched `docs/uat-checklist.md` or added new UAT scenarios for the tailored resume pipeline.
After both branches merge, the checklist may be incomplete.

**Fix:** Add to Task 7 (cleanup pass):

```bash
# Step 0 (NEW): Verify UAT checklist reflects merged capabilities
git diff origin/main...HEAD -- docs/uat-checklist.md
# Review: does the checklist cover tailored resume generation (new from custom-resume-gen)?
# If not, add: "Tailored resume tool: generate a tailored resume in chat, verify it renders"
```

---

#### M7 — Vercel Environment Variables Not Audited Post-Deploy

**File:** `mega-merge-strategy.md`, Task 9

**Problem:** Task 9 has no step to verify Vercel environment variables after the merge lands on
main. If any branch accidentally modified `vercel.json` in a way that references new env vars, the
production deployment could fail silently or fall back to undefined behavior.

**Fix:** Add to Task 9 Step 1 (verify production):

```bash
# Verify required environment variables are set in Vercel production
gh api /repos/praeducer/paulprae-com/environments/production 2>/dev/null \
  | python3 -c "import json,sys; env=json.load(sys.stdin); print('Production env:', env.get('name','unknown'))"
# Manually check Vercel dashboard for: ANTHROPIC_API_KEY, UPSTASH_REDIS_REST_URL,
# UPSTASH_REDIS_REST_TOKEN, CRON_SECRET, VERCEL_AUTOMATION_BYPASS_SECRET
```

---

#### M8 — `positions.json` Schema Integrity Not Validated After Accept-Theirs

**File:** `mega-merge-strategy.md`, Task 4 Step 3

**Problem:** After `git checkout --theirs data/sources/knowledge/career/positions.json`, the plan
does not validate JSON syntax. A malformed JSON file would cause `npm run ingest` to fail in Task 5
with a confusing error far from the source.

**Fix:** Add after each `git checkout --theirs <json-file>`:

```bash
python3 -m json.tool data/sources/knowledge/career/positions.json > /dev/null \
  && echo "✅ positions.json is valid JSON" \
  || { echo "❌ positions.json is INVALID JSON — fix before proceeding"; exit 1; }
```

Apply the same pattern to `companies.json`.

---

#### M9 — PR Close Order in Task 9 Is Confusing

**File:** `mega-merge-strategy.md`, Task 9 Steps 2–3

**Problem:** Task 9 Step 3 closes PRs #34–38 after deleting branches in Step 2. PRs auto-close when
their head branch is deleted — so most will already be closed by the time Step 3 runs. However,
the plan doesn't distinguish between:

- PRs whose branches are deleted (will auto-close)
- PRs that are open against a branch that wasn't deleted (e.g., `docs/backlog-apr4-lighthouse-ux`
  if it doesn't have an associated PR)

The `gh pr close` commands will produce errors for PRs that are already closed.

**Fix:** Update Step 3 to be idempotent and explain the logic:

```bash
# Close any PRs that haven't auto-closed (suppress errors for already-closed PRs)
for pr in 34 35 36 37 38; do
  gh pr close $pr --comment "Absorbed into uat/mega-merge-apr-2026 and merged to main." 2>/dev/null \
    && echo "Closed PR #$pr" || echo "PR #$pr already closed (ok)"
done
```

---

### LOW — Polish and Future-Proofing

---

#### L1 — SSH-Only Remote Assumption Is WSL-Specific

**File:** `mega-merge-strategy.md`, Guardrail #6

**Problem:** Guardrail #6 says "SSH remote only. HTTPS credential helper fails in WSL." This is a
WSL-specific constraint. On macOS, GitHub Codespaces, or CI with GITHUB_TOKEN, HTTPS works fine.

**Fix:** Rewrite to: "In **WSL Ubuntu**, use SSH remote (`git@github.com:...`). The HTTPS
credential helper may fail in WSL due to missing keychain integration. In other environments
(macOS, Codespaces, CI), HTTPS with token auth works. Check your remote: `git remote -v`."

---

#### L2 — Suppressed Skills List May Be Incomplete

**File:** `mega-merge-strategy.md`, Task 6 Step 5

**Problem:** The check `grep -iE "\b(dbt|langchain|n8n|rust)\b"` hardcodes a specific list of
suppressed skills. The `writing-rules.json` in the `feat/custom-resume-gen` branch may define a
more complete list. The plan should derive this check from the canonical source.

**Fix:** After Task 4 merge (when `writing-rules.json` is available), generate the suppression
check dynamically:

```bash
# Get suppressed skills from writing-rules.json (if it has a suppressed_skills array)
SUPPRESSED=$(python3 -c "
import json
with open('data/generated/writing-rules.json') as f:
    rules = json.load(f)
skills = rules.get('suppressed_skills', [])
print('|'.join(r'\\b' + s + r'\\b' for s in skills))
" 2>/dev/null)
if [ -n "$SUPPRESSED" ]; then
  grep -iE "$SUPPRESSED" data/generated/Paul-Prae-Resume.md && echo "⚠️ Suppressed skills found!" || echo "✅ No suppressed skills"
else
  grep -iE "\b(dbt|langchain|n8n|rust)\b" data/generated/Paul-Prae-Resume.md && echo "⚠️ Suppressed skills found!" || echo "✅ No suppressed skills (fallback list)"
fi
```

---

#### L3 — Co-Author Attribution Format

**File:** `mega-merge-strategy.md`, commit message templates throughout

**Problem:** `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` — this email
is not a GitHub account, so it won't appear as a co-author in GitHub's contributor graph. This is
cosmetic but misleading. GitHub co-author attribution requires an email associated with a GitHub
account.

**Fix:** Keep it as documentation of AI involvement but clarify with a comment:

```
Co-Authored-By: Claude Opus 4.6 <claude@anthropic.com>
# Note: Attribution is informational only — Anthropic does not have a GitHub account
```

Or remove entirely and add `[AI-assisted]` to the commit message body instead.

---

#### L4 — No Issue or Milestone for Hotfix After Mega-Merge

**File:** `mega-merge-strategy.md` (absent); `hotfix-multi-resume-bug.md`

**Problem:** The multi-resume bug fix is documented in a plan file but has no GitHub Issue. After
the mega-merge lands, this bug will still exist on main. A developer picking up the codebase after
Paul starts at Autonomize would have no way to discover this known issue except by reading plan
files.

**Fix:** Create a bug issue in Task 9:

```bash
gh issue create \
  --title "Bug: Second tailored resume in same chat session fails without refresh" \
  --body "$(cat .claude/plans/hotfix-multi-resume-bug.md)" \
  --label "bug" \
  --assignee "@me"
```

---

#### L5 — Plan Has No "Already Complete" State Tracking

**File:** `mega-merge-strategy.md`, general

**Problem:** The plan uses `- [ ]` checkboxes but has no mechanism to prevent re-running steps
that were already completed. An agent picking up a partially-complete merge would need to determine
current state manually by reading git log.

**Fix:** Add a "State Recovery" procedure at the top of the plan:

```bash
# Determine current merge state
git log --oneline uat/mega-merge-apr-2026 2>/dev/null || echo "Branch not created yet — start at Task 1"
git log --oneline uat/mega-merge-apr-2026 | grep "pre-merge\|feat:\|chore:\|docs:" | head -20
# Compare against task checklist to determine resume point
```

---

## Order-of-Operations Summary (Complete Corrected Sequence)

This is the authoritative order after all fixes are applied. Use this as the single source of
truth for execution.

```
[PREP]
  git fetch --unshallow origin (if needed)
  git fetch --all --prune
  which gh && gh auth status
  gh pr checks 37 --watch  ← verify feat/custom-resume-gen is CI-clean
  Resolve C3: document PR #36 strategy (include OR exclude from UAT)

[Task 1] Create UAT branch
  git tag -f pre-merge-checkpoint (idempotent)
  git checkout uat/mega-merge-apr-2026 || git checkout -b uat/mega-merge-apr-2026
  Create companion docs
  git commit && git push

[Task 2] Phase 1: Safe branch merges (zero conflicts expected)
  git tag -f pre-merge-backlog → merge docs/backlog-apr4-lighthouse-ux → npm test → push
  git tag -f pre-merge-intro → merge docs/autonomize-intro-deliverable → npm test → push (IF included per C3 decision)
  git tag -f pre-merge-audit → merge chore/audit-fix-and-regen → npm install → npm test → push
  git tag -f pre-merge-settings → merge chore/add-project-settings → npm install → npm test → push
  Phase 1 validation gate: npm install && npm test && npm run build

[Task 3] Phase 2: feat/autonomize-ai-career-update
  git tag -f pre-merge-autonomize
  git merge origin/feat/autonomize-ai-career-update --no-edit
  Verify: grep "Autonomize AI" lib/generated/current-role.ts
  npm test && npm run build → push

[Task 4] Phase 3: feat/custom-resume-gen (THE HARD ONE)
  Read Recovery Protocol first
  git tag -f pre-merge-custom-resume
  git merge origin/feat/custom-resume-gen --no-commit
  Resolve all 8+ conflict zones (validate JSON after each --theirs)
  Verify Modular Earth status (flag for Paul if missing in projects.json)
  git commit (merge commit) → push

[Task 5] Post-merge regeneration
  Fix Positions.csv dates (with error guard for missing file)
  npm run ingest -- --force
  npm run build:prompts
  npm run check:quick
  npm test ← mandatory gate (data-consistency.test.ts must pass)
  npm run build
  git commit intermediates → push

[Task 6] Resume regeneration (one-time, on final state)
  npm test ← FINAL gate before expensive AI call (new step from C6)
  npm run generate -- --force
  npm run approve -- --force (use --force, not echo pipe)
  npm run export -- --force
  Spot-check resume content
  git commit resume outputs → push

[Task 7] Cleanup pass
  Verify .npmrc removal
  Verify Modular Earth transformation
  Verify Hyperbloom end-date
  npm run lint / npm run check
  Mark package.json version bump as done in backlog.md
  Check UAT checklist reflects new capabilities

[Task 8] QA + PR creation
  npm run dev → local smoke test
  gh pr create --base main --head uat/mega-merge-apr-2026 --draft (use --draft)
  gh pr checks <PR_NUMBER> --watch ← wait for CI (replaces subjective "wait for Vercel")
  Verify Vercel preview URL from PR comments (Vercel GitHub App)
  Run docs/uat-checklist.md against preview URL
  gh pr ready <PR_NUMBER> ← mark ready after UAT passes
  gh issue create for Phase A SSOT refactor

[Task 9] Post-deploy (after Paul merges PR to main)
  gh pr merge --merge (from main, after CI passes)
  Verify production: https://paulprae.com vs uat-checklist.md
  Audit Vercel env vars
  Delete merged branches (including copilot/featautonomize-ai-career-update)
  gh pr close <stale PRs> --comment (idempotent, suppress errors)
  gh issue create for multi-resume hotfix
```

---

## Execution Checklist for This Review Pass

When you have finished applying all fixes to `mega-merge-strategy.md`:

- [ ] All Critical issues (C1–C6) addressed in the plan text
- [ ] All High issues (H1–H10) addressed in the plan text
- [ ] All Medium issues (M1–M9) addressed where applicable
- [ ] All Low issues (L1–L5) addressed or explicitly deferred
- [ ] `backlog.md` updated: package version bump marked `[x]`
- [ ] New section added at bottom of plan: `## Known Issues Fixed (April 2026)`
- [ ] Plan committed and pushed to `feat/autonomize-ai-career-update`
- [ ] Confirmed: plan's must-read callout at top links to this file

---

_Authored by: Claude Code Agent (Sonnet 4.5) | April 11, 2026_
_Repository: github.com/praeducer/paulprae-com | Branch: feat/autonomize-ai-career-update_
