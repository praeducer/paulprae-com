# DevOps & Deployment Guide

## Deployment Architecture

```
Push to main → CI workflow (lint, test, build) → Deploy workflow → Vercel --prod → Smoke test
                                                                                      ↓
                                                                            Fail → Auto-rollback + Issue
```

Two GitHub Actions workflows manage the pipeline:

| Workflow                      | Trigger                   | Purpose                                       |
| ----------------------------- | ------------------------- | --------------------------------------------- |
| **CI** (`ci.yml`)             | Push/PR to main           | Lint, format, test, build, quality gates      |
| **Deploy** (`deploy.yml`)     | After CI passes on main   | Build, deploy to Vercel, smoke test, rollback |
| **Pipeline** (`pipeline.yml`) | Manual / Monthly schedule | Full resume generation pipeline + PR creation |

The Deploy workflow uses `workflow_run` to trigger only after CI succeeds on `main`. This prevents deploying broken builds.

## Required Secrets

Configure these in GitHub repo Settings → Secrets and variables → Actions:

| Secret              | Source                                                         | Used by  |
| ------------------- | -------------------------------------------------------------- | -------- |
| `VERCEL_TOKEN`      | [vercel.com/account/tokens](https://vercel.com/account/tokens) | Deploy   |
| `VERCEL_ORG_ID`     | `.vercel/project.json` → `orgId`                               | Deploy   |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId`                           | Deploy   |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/)        | Pipeline |

## Smoke Tests

After every deployment, the smoke test (`npm run smoke`) verifies:

1. Homepage returns 200 with expected content ("Paul Prae", "AI Career Assistant")
2. Resume page returns 200 with expected content ("Paul Prae", "Professional Summary")
3. Resume MD download hash matches the local committed file
4. PDF download returns 200, correct content-type, size > 10 KB
5. DOCX download returns 200, correct content-type, size > 5 KB
6. HTTP → HTTPS redirect works
7. Security headers present (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

Run locally:

```bash
npm run smoke                                    # Test against https://paulprae.com
SMOKE_TEST_URL=https://preview.vercel.app npm run smoke  # Test against preview
```

## Rollback Procedures

### Automatic Rollback (Deploy Workflow)

If the smoke test fails after deployment, the workflow automatically:

1. Retrieves the previous production deployment from Vercel
2. Promotes it back to production
3. Creates a GitHub issue labeled `deploy-failure`

### Manual Rollback via Vercel CLI

```bash
# List recent production deployments
vercel ls --prod

# Promote a specific deployment to production
vercel promote <deployment-url> --yes
```

### Manual Rollback via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) → Project → Deployments
2. Find the last known-good deployment
3. Click "..." → "Promote to Production"

### Resume Content Rollback

Each pipeline run archives the resume to `data/generated/versions/`. To restore a previous version:

```bash
# List available versions
ls data/generated/versions/

# Restore a specific version
cp data/generated/versions/Paul-Prae-Resume-YYYY-MM-DD-<sha>.md data/generated/Paul-Prae-Resume.md
npm run export && npm run check:fix

# Commit and deploy
git add data/generated/ public/Paul-Prae-Resume.*
git commit -m "revert: restore resume from YYYY-MM-DD"
git push
```

## Quality Gates

CI runs `npm run check:quick -- --ci` which validates:

- **Data files** — `career-data.json` and resume markdown exist and are non-empty
- **Resume quality** — expected sections present, sufficient positions/bullets, quantification density >= 30%, key companies included, reasonable length
- **Public downloads** — PDF, DOCX, MD in `public/` match `data/generated/` (hash comparison)

In CI mode (`--ci`), results are output as:

- GitHub Actions annotations (`::error::` for failures)
- Step summary table in `$GITHUB_STEP_SUMMARY`

## Pipeline Workflow

The Pipeline workflow (`pipeline.yml`) runs the full resume generation pipeline in CI:

```bash
# Trigger manually from GitHub Actions UI or CLI
gh workflow run pipeline.yml
gh workflow run pipeline.yml -f force=true -f auto_approve=true
```

It creates a PR with generated changes rather than pushing directly to main, keeping human review in the loop.

The workflow also runs on a monthly schedule (1st of each month at 9 AM UTC) to keep the resume fresh.

## Vercel Configuration

- **Framework:** Auto-detected Next.js (server-rendered with API routes)
- **Build command:** `npm run build`
- **Output directory:** `.next/` (managed by Vercel)
- **Compute:** Fluid Compute (Pro plan) — streaming AI responses via `/api/chat`
- **Deploy:** GitHub Actions Deploy workflow handles deployments (Vercel Git integration is not used).

## Monitoring

- **GitHub Environments:** The deploy job uses `environment: production`, so deployment history is visible at Settings → Environments → production.
- **Badges:** CI and Deploy status badges are in README.md.
- **Failure notifications:** GitHub notifies repo owner on workflow failures by default. Additionally, failed deploys create issues labeled `deploy-failure`.
