# Human Steps Guide — v2.1 Quality & Infrastructure

> **Status: Steps 0-2 COMPLETE ✅** — All GitHub secrets are configured and Vercel bypass is active.
> Nothing left for you to do manually. Claude Code is handling Step 3 (deploy fix) and Step 4 (pipeline).

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

### What was broken / current status

| Problem                               | Impact                                                       | Status                       |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| ~~No GitHub secrets~~                 | ~~Deploy workflow fails — VERCEL_TOKEN is empty~~            | ✅ Fixed (all 5 secrets set) |
| ~~deploy.yml uses `--prebuilt` flag~~ | ~~`vercel deploy --prebuilt` fails~~                         | ✅ Fixed (PR #17)            |
| ~~deploy.yml missing `permissions`~~  | ~~"Create issue on failure" step gets 403~~                  | ✅ Fixed (PR #17)            |
| ~~Vercel Deployment Protection on~~   | ~~Preview URLs return HTTP 401, smoke tests fail~~           | ✅ Fixed (bypass added)      |
| **`vercel promote` team scope error** | Promote step fails: "Deployment belongs to a different team" | 🔧 Fixed in this session     |
| Open issues #16-#23 "Deploy failed"   | Noise from failed deploy attempts                            | 🔧 Being closed              |

### What's safe and working

- **Production site (paulprae.com) is live and untouched** — deploy pattern is preview → smoke → promote, so failed deploys never touch production
- **Smoke tests pass** — all 6 checks pass with bypass header active
- **CI workflow works** — lint, test, build all pass
- **Manual deploy fallback** — `npx vercel --prod --yes` from WSL always works

---

## Steps

### ~~Step 0: Merge PR #17~~ ✅ DONE

### ~~Step 1: Add Protection Bypass for Automation~~ ✅ DONE

`VERCEL_AUTOMATION_BYPASS_SECRET` set in GitHub secrets at 2026-03-04T18:31:55Z.

### ~~Step 2: Configure GitHub Secrets~~ ✅ DONE

All 5 secrets configured:

| Secret                            | Value                              | Set                     |
| --------------------------------- | ---------------------------------- | ----------------------- |
| `VERCEL_TOKEN`                    | _(token)_                          | ✅ 2026-03-04T17:34:12Z |
| `VERCEL_ORG_ID`                   | `team_EZa7yDGXuubGA4VpNUccqrgM`    | ✅ 2026-03-04T17:36:33Z |
| `VERCEL_PROJECT_ID`               | `prj_XGIlmRtsRVSzfqETwwuos3G3elUT` | ✅ 2026-03-04T17:37:17Z |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | _(generated)_                      | ✅ 2026-03-04T18:31:55Z |
| `ANTHROPIC_API_KEY`               | _(key)_                            | ✅ 2026-03-04T17:39:36Z |

### Step 3: Verify Deploy Workflow

**Root cause found:** `vercel promote` doesn't pick up `VERCEL_ORG_ID` from env the same way `vercel deploy` does, causing "Deployment belongs to a different team." Fixed by adding `--scope="${VERCEL_ORG_ID}"` to both `vercel deploy` and `vercel promote` in `deploy.yml`.

Smoke tests were already passing (all 6 checks) — only the promote step was failing.

**Expected result after fix:**

```
CI passes → Deploy triggers → Preview deploys → Smoke tests pass → Production promotes
```

**After success:** Close issues #16-#23 (auto-generated deploy failure issues).

### Step 4: Hand back to Claude Code

Once deploy is verified working, start a new Claude Code session and say:

> "GitHub Actions deploy is verified.
> Run the full pipeline on main, review quality (target score: 388+),
> approve if quality passes, and push to deploy."

**What Claude Code will do autonomously:**

1. `npm run ingest:force` — re-ingest career data
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

| Workflow     | File         | Trigger                                       | Secrets needed                                                                  | Current status          |
| ------------ | ------------ | --------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| **CI**       | ci.yml       | Push to main, PRs to main                     | None                                                                            | ✅ Working              |
| **Deploy**   | deploy.yml   | CI success on main (`workflow_run`)           | VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_AUTOMATION_BYPASS_SECRET | 🔧 Fix pushed to main   |
| **Pipeline** | pipeline.yml | Manual dispatch, monthly cron (1st, 9 AM UTC) | ANTHROPIC_API_KEY                                                               | ✅ Secret set, untested |

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
