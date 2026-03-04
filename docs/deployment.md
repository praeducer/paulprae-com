# Deployment Setup

## GitHub Secrets (one-time setup)

Three secrets are required for the Deploy workflow. Configure them at:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret              | Value                              | Source                                                         |
| ------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Vercel API token                   | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID`     | `team_EZa7yDGXuubGA4VpNUccqrgM`    | `.vercel/project.json`                                         |
| `VERCEL_PROJECT_ID` | `prj_XGIlmRtsRVSzfqETwwuos3G3elUT` | `.vercel/project.json`                                         |

The Pipeline workflow also needs `ANTHROPIC_API_KEY` for resume generation.

## Vercel Project Settings (one-time)

1. **Disable Git Integration auto-deploy:**
   This is handled by `vercel.json` (`git.deploymentEnabled: false`).
   Verify at: Project Settings → Git → Deploy Hooks section shows no automatic triggers.

2. **Disable Deployment Protection:**
   Project Settings → Deployment Protection → set to "Disabled" (or "Only Production").
   This allows smoke tests to access preview deployment URLs without authentication.

## Branch Protection (one-time)

Run the setup script after configuring secrets:

```bash
./scripts/setup-branch-protection.sh
```

This creates GitHub Rulesets requiring PRs + CI status checks for the main branch.

## Deployment Flow

```
push to main
    → CI workflow (lint, test, build, validate)
    → Deploy workflow (triggered by CI success)
        → vercel deploy (preview)
        → smoke test preview URL
        → vercel promote (assign production domains)
        → smoke test production URL
        → create issue on failure
```

## Manual Operations

- **Force deploy:** Re-run the Deploy workflow from GitHub Actions UI
- **Rollback:** `vercel rollback --token=$VERCEL_TOKEN` (rolls back to previous production deployment)
- **Resume regeneration:** Trigger Pipeline workflow manually from Actions UI
