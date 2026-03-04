# Human Steps Guide — v2.1 Quality & Infrastructure Improvements

## What was done automatically

### Round 1: Knowledge Base Enrichment

- Added 3 new position-metrics.json entries: TReNDS Center, NeuroLex Labs, Hyperbloom
- Each entry includes SCOPE BOUNDARY markers, verified confidence, and relatedPositions
- Hyperbloom entry includes $1.4M ARR, 5+ year operating history, team composition
- TReNDS entry includes COINSTAC details, differential privacy, GPU infrastructure, SBIR grants
- NeuroLex entry includes ML pipeline architecture, TDD implementation, Tribe fellowship

### Round 2: CI/CD Fixes

- Fixed deploy.yml: added `permissions: { contents: read, issues: write }` for issue creation
- Removed `--prebuilt` flag from deploy step (Vercel builds remotely, no local `.vercel/output`)
- Improved deploy URL extraction with better error handling

### Round 3: Prompt Fine-Tuning

- Strengthened action verb instruction: every bullet MUST start with a strong verb (20 preferred verbs listed)
- Added location instruction: header must use `profile.location`, not position city
- Clarified Tier 1 scope: concurrent/founder roles with recent end dates get full Tier 1 treatment
- Added location validation in generate-resume.ts
- Tightened action verb validation threshold to 75%

### Test Results

- All 315 tests pass
- Generated a test resume: Buford, GA location now correct, grounding intact

---

## What you need to do (in order)

### Step 1: Configure GitHub Secrets (5 minutes)

These secrets enable the automated Deploy workflow. Without them, every push to main triggers a failed deploy.

1. Go to https://github.com/praeducer/paulprae-com/settings/secrets/actions
2. Click "New repository secret" and add each:

| Secret Name         | Value                              | Where to find it                               |
| ------------------- | ---------------------------------- | ---------------------------------------------- |
| `VERCEL_TOKEN`      | _(your Vercel API token)_          | https://vercel.com/account/tokens → Create new |
| `VERCEL_ORG_ID`     | `team_EZa7yDGXuubGA4VpNUccqrgM`    | Already in `.vercel/project.json`              |
| `VERCEL_PROJECT_ID` | `prj_XGIlmRtsRVSzfqETwwuos3G3elUT` | Already in `.vercel/project.json`              |

3. (Optional) Add `ANTHROPIC_API_KEY` if you want the Pipeline workflow to run in CI.

### Step 2: Disable Vercel Deployment Protection (2 minutes)

Preview URLs currently return HTTP 401, which blocks smoke tests.

1. Go to https://vercel.com → paulprae-com project → Settings → Deployment Protection
2. Set protection to "Disabled" or "Only Production"
3. This allows the Deploy workflow to smoke-test preview URLs before promoting to production

### Step 3: Add Quantified Metrics to Knowledge Base (15-30 minutes)

The resume generation can't fabricate numbers (by design). These positions need real metrics from your records:

**TReNDS Center** — Edit `data/sources/knowledge/career/position-metrics.json`, TReNDS entry:

- How many institutions/research sites use COINSTAC? (e.g., "20+ research institutions")
- What grants were secured? (e.g., "NIH R01 grant, $500K SBIR")
- How many open-source contributors? (e.g., "15+ contributors")
- Data scale? (e.g., "100K+ neuroimaging datasets")

**NeuroLex Labs** — Edit the NeuroLex entry:

- How many ML models deployed? (e.g., "5 production models")
- Data volume processed? (e.g., "50K+ voice samples")
- Tribe fellowship size? (e.g., "mentored 8 fellows")
- Test coverage improvement? (e.g., "grew test coverage from 0% to 80%")

**Hyperbloom** — Edit the Hyperbloom entry:

- Total client engagements? (e.g., "delivered 15+ client engagements")
- Peak team size? (e.g., "team of 12")
- Industries served count? (e.g., "across 3 industry verticals")

**AWS** — Already has good data (10+ accounts, named clients). Optional additions:

- Speaking engagement count? (e.g., "spoke at 10+ AWS events")
- White papers authored? (e.g., "published 5 technical white papers")

After adding metrics, run:

```bash
npm run ingest:force && npm run generate:force
npm run compare    # review section-by-section
npm run approve    # if quality looks good
npm run export     # PDF + DOCX
npm run check:fix  # sync public/ copies
```

### Step 4: Verify Deploy Workflow (5 minutes)

After Steps 1-2, push any commit to main and verify the full flow:

```
CI passes → Deploy triggers → Preview deploys → Smoke passes → Production promotes
```

Watch the Actions tab: https://github.com/praeducer/paulprae-com/actions

### Step 5: (Optional) Cost Optimization Test

Current generation costs $3.75 per run. To test cheaper options:

```bash
# Try reducing thinking effort (edit lib/config.ts temporarily)
# Change effort from "max" to "high", then:
npm run generate:force
npm run compare --judge   # LLM-scored comparison
```

If quality stays within 5%, the savings are worthwhile for iterative development.

---

## Summary of changes to commit

The following files were modified and are ready to commit:

- `data/sources/knowledge/career/position-metrics.json` — 3 new entries (TReNDS, NeuroLex, Hyperbloom)
- `.github/workflows/deploy.yml` — permissions fix + --prebuilt removal
- `lib/prompts/resume-writer.system.md` — action verb guidance, location instruction, Tier 1 scope
- `scripts/generate-resume.ts` — location validation, action verb threshold (75%)
- `data/generated/career-data.json` — updated by ingest (37 knowledge entries)
- `data/generated/Paul-Prae-Resume.staging.md` — test generation (not approved)

**NOT changed** (kept as-is):

- `data/generated/Paul-Prae-Resume.md` — current approved resume stays live
- `public/` files — no sync needed since approved resume unchanged
