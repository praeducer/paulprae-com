# Human Steps Guide — v2.1 Quality & Infrastructure

> **When to loop back to Claude Code:** After completing Steps 1-3, tell Claude Code:
> _"Secrets and metrics are configured. Run the pipeline, review quality, and deploy."_
> Claude Code can handle everything from that point autonomously.

---

## How things work right now

### Automated CI/CD chain (on every push to main)

```
Push to main
  → CI workflow (ci.yml): lint, format, test, build, validate
    → Deploy workflow (deploy.yml): preview → smoke test → promote to production
```

- **CI** triggers on push to main AND on PRs to main (required status check for branch protection)
- **Deploy** triggers via `workflow_run` when CI succeeds on main only
- **Vercel Git integration is OFF** (`vercel.json: git.deploymentEnabled: false`) — all deploys go through GitHub Actions, not Vercel's native auto-deploy
- **Pipeline workflow** (pipeline.yml) is separate — manual trigger or monthly cron (1st of month, 9 AM UTC), generates a new resume and creates a PR

### What's currently broken

| Problem                                | Impact                                                       | Fixed by                |
| -------------------------------------- | ------------------------------------------------------------ | ----------------------- |
| **No GitHub secrets**                  | Deploy workflow fails — VERCEL_TOKEN is empty                | Step 1 below            |
| deploy.yml uses `--prebuilt` flag      | `vercel deploy --prebuilt` fails (no `.vercel/output` in CI) | PR #17 merge            |
| deploy.yml missing `permissions` block | "Create issue on failure" step gets 403                      | PR #17 merge            |
| **Vercel Deployment Protection** on    | Preview URLs return HTTP 401, smoke tests fail               | Step 2 below            |
| Open issue #16 "Deploy failed"         | Noise from previous failed deploy attempts                   | Close after Step 4      |
| **No ANTHROPIC_API_KEY secret**        | Pipeline workflow can't generate resumes in CI               | Step 1 below (optional) |

### What's safe and working

- **Production site (paulprae.com) is live and untouched** — deploy pattern is preview → smoke → promote, so failed deploys never touch production
- **Approved resume is unchanged** — PR #17 only adds knowledge entries, prompt tweaks, and validation
- **CI workflow works** — lint, test, build all pass
- **Manual deploy fallback** — `npx vercel --prod --yes` from WSL always works regardless of GitHub secrets
- **No secrets exist yet** — `gh secret list` returns empty, nothing to accidentally break

---

## What to do (in order)

### Step 0: Merge PR #17 (1 minute)

Squash merge at: https://github.com/praeducer/paulprae-com/pull/17

**What happens immediately after merge:**

1. Squash commit lands on main
2. CI workflow triggers (push event) — **will pass** (all 315 tests pass)
3. Deploy workflow triggers (workflow_run event) — **will fail** (no secrets yet, expected)
4. Deploy failure creates a new GitHub issue (the `permissions` fix from PR #17 enables this)
5. **Production is untouched** — deploy never reaches the promote step

**Risk: None.** The deploy failure is expected. You'll fix it in Step 1.

After merging, delete the `feat/v2.1-quality-infra` branch (GitHub offers this button on the merged PR page).

---

### Step 1: Configure GitHub Secrets (5 minutes)

Go to: https://github.com/praeducer/paulprae-com/settings/secrets/actions

Click **"New repository secret"** for each:

| Secret              | Value                              | Where to find it                                    |
| ------------------- | ---------------------------------- | --------------------------------------------------- |
| `VERCEL_TOKEN`      | _(create a new token)_             | https://vercel.com/account/tokens → "Create" button |
| `VERCEL_ORG_ID`     | `team_EZa7yDGXuubGA4VpNUccqrgM`    | Your local `.vercel/project.json` (gitignored)      |
| `VERCEL_PROJECT_ID` | `prj_XGIlmRtsRVSzfqETwwuos3G3elUT` | Your local `.vercel/project.json` (gitignored)      |

**Optional but recommended:**

| Secret              | Value                                   | Purpose                                                                                      |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | _(your Claude API key from .env.local)_ | Enables Pipeline workflow: monthly auto-regeneration + manual trigger from GitHub Actions UI |

**Risk:** If you paste the wrong Vercel token, deploys will fail with auth errors. You'll catch this in Step 4 — easy to fix by updating the secret.

---

### Step 2: Disable Vercel Deployment Protection (2 minutes)

Go to: https://vercel.com → paulprae-com project → **Settings** → **Deployment Protection**

Change the setting so preview deployments are **not** behind authentication.

**Why:** The deploy workflow runs smoke tests (`npm run smoke`) against the preview URL _before_ promoting to production. If Deployment Protection is on, those smoke tests get HTTP 401 and the deploy halts — production never updates even though the build is fine.

**Best option for a public portfolio site:** Set to **"Disabled"** or **"Only Production Deployments"**.

**Risk:** Without Deployment Protection, anyone with a preview URL can view it. Since paulprae.com is a public resume site, this is a non-issue.

---

### Step 3: Add Quantified Metrics (15-30 minutes)

Edit `data/sources/knowledge/career/position-metrics.json` **on main** (since PR #17 is already merged).

The resume generator cannot fabricate numbers (grounding rule G4: Source Grounding). These positions have qualitative context from the knowledge base but zero quantified metrics — only you have the real numbers from your career.

**TReNDS Center** — Find the entry with `"entity": "Georgia State University / TReNDS Center"` and add numbers to the `content` field:

- How many institutions/research sites use COINSTAC? (e.g., "deployed across 20+ research institutions")
- Grant amounts secured? (e.g., "$2.1M NIH R01 grant" or "$500K SBIR Phase II")
- Data scale processed? (e.g., "100K+ neuroimaging datasets")
- Open-source community size? (e.g., "15+ contributors across 5 institutions")

**NeuroLex Labs** — Find `"entity": "NeuroLex Diagnostics"`:

- ML models deployed to production? (e.g., "5 production NLP models")
- Voice data volume? (e.g., "analyzed 50K+ voice samples")
- Test coverage growth? (e.g., "increased test coverage from 0% to 85%")
- Tribe fellowship details? (e.g., "mentored cohort of 8 fellows")

**Hyperbloom** — Find `"entity": "Hyperbloom"`:

- Total client engagements? (e.g., "delivered 15+ client engagements")
- Peak team size managed? (e.g., "team of 12 engineers and designers")
- Industries served? (e.g., "across healthcare, fintech, and education verticals")

**AWS (optional)** — Already has solid data. Nice-to-have:

- Speaking engagements? (e.g., "delivered 10+ technical talks at AWS events")
- Technical publications? (e.g., "authored 5 AWS solution briefs")

**How to edit:** Add metrics directly into the `content` string of each JSON entry. Keep the `--- SCOPE BOUNDARY ---` markers intact — they prevent the generator from mixing achievements across companies.

**Risk:** If you add inaccurate numbers, they will appear in the generated resume. The grounding rules trust your knowledge base as a verified source. Double-check everything.

**Don't run the pipeline yet** — that's Step 5 (Claude Code does it).

---

### Step 4: Verify Deploy Workflow (5 minutes)

Now that secrets (Step 1) and Deployment Protection (Step 2) are configured, test the full chain.

**Option A — Re-run the failed deploy:**

1. Go to: https://github.com/praeducer/paulprae-com/actions/workflows/deploy.yml
2. Find the most recent failed run and click **"Re-run all jobs"**

**Option B — Push a small commit:**

Any push to main triggers CI → Deploy. You could commit the metrics from Step 3 to trigger it.

**Expected result:**

```
CI passes → Deploy triggers → Preview deploys → Smoke tests pass → Production promotes
```

**If it fails, check:**

- **"Deploy preview" step fails** → VERCEL_TOKEN is wrong (update the secret)
- **"Smoke test preview" step fails with 401** → Deployment Protection still on (redo Step 2)
- **"Smoke test preview" step fails with other errors** → check if the preview URL is correct in the logs
- **"Create issue on failure" step fails** → the `permissions` block should fix this; if not, check that GITHUB_TOKEN has issue write access

**After success:** Close issue #16 and any other auto-created deploy failure issues at https://github.com/praeducer/paulprae-com/issues

---

### Step 5: Hand back to Claude Code

Once Steps 1-4 are done, start a new Claude Code session and say:

> "Secrets and metrics are configured. GitHub Actions deploy is verified.
> Run the full pipeline on main, review quality (target score: 388+),
> approve if quality passes, and push to deploy."

**What Claude Code will do autonomously:**

1. `npm run ingest:force` — pick up your new metrics
2. `npm run generate:force` — generate resume with v2.1 prompt (~$3.86, ~11 min)
3. `npm run compare` — section-by-section diff against current approved resume
4. Quality score check — target is **388+** (matching or exceeding current v2.0)
5. If quality passes: `npm run approve` → `npm run export` → `npm run check:fix`
6. `git commit` + `git push` — commit the new resume to main
7. CI passes → Deploy workflow → preview → smoke → production auto-updates

**If quality score is below 388:** Claude Code will NOT approve. It will report what's missing so you can iterate on the knowledge base entries.

---

## Reference

### All 3 GitHub Actions workflows

| Workflow     | File         | Trigger                                       | Secrets needed                                 | Current status      |
| ------------ | ------------ | --------------------------------------------- | ---------------------------------------------- | ------------------- |
| **CI**       | ci.yml       | Push to main, PRs to main                     | None                                           | Working             |
| **Deploy**   | deploy.yml   | CI success on main (`workflow_run`)           | VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID | Broken (no secrets) |
| **Pipeline** | pipeline.yml | Manual dispatch, monthly cron (1st, 9 AM UTC) | ANTHROPIC_API_KEY                              | Not tested          |

### Vercel configuration

| Setting                | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| Git integration        | **OFF** (`vercel.json: git.deploymentEnabled: false`) |
| Build command          | `npm run build`                                       |
| Output directory       | `out/`                                                |
| Framework              | null (static export)                                  |
| Custom domain          | paulprae.com (DNS via DreamHost)                      |
| Local project config   | `.vercel/project.json` (gitignored)                   |
| Manual deploy fallback | `npx vercel --prod --yes` from WSL                    |

### Cost per pipeline run

| Step                                   | Cost       | Time        |
| -------------------------------------- | ---------- | ----------- |
| Ingest                                 | Free       | ~2s         |
| Generate (Claude Opus 4.6, max effort) | ~$3.86     | ~11 min     |
| Export (Pandoc + Typst)                | Free       | ~3s         |
| Build (Next.js static)                 | Free       | ~5s         |
| **Total**                              | **~$3.86** | **~12 min** |
