# Iterative Dev/QA Plan — Post v2.0 Deployment

## Status: Ready for implementation

Generated: 2026-03-04 | Based on: v2.0 production deployment observations

---

## Context

Prompt v2.0 is deployed to production at paulprae.com. The anti-hallucination grounding rules work — no more "50M+" fabrication, no ML pipeline misattribution, no cross-entity conflation. However, several quality and infrastructure issues remain.

### What v2.0 Fixed

- Eliminated "50M+ health plan members" hallucination (uses ">30M" correctly)
- No ML pipeline attribution in Arine bullets (data ops only)
- Professional Summary properly scoped
- No resume cliches

### Remaining Issues

**Resume Quality (score: 388/~450, -3% from v1.3):**

1. TReNDS: 3 bullets, 0 quantified metrics
2. Hyperbloom: 2 bullets (Tier 1 minimum is 3-4), weak action verbs
3. AWS: 1/3 bullets with strong action verbs
4. NeuroLex: 2 bullets, 0 quantified metrics
5. Location shows "Atlanta, GA" — may need updating

**CI/CD Infrastructure:** 6. GitHub Actions Deploy workflow fails (missing VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID secrets) 7. Vercel Deployment Protection blocks preview smoke tests (HTTP 401) 8. Issue creation on deploy failure fails (GITHUB_TOKEN permission) 9. Deploy workflow `--prebuilt` flag fails (no `.vercel/output` directory)

**Cost/Performance:** 10. $3.75 per generation (Opus 4.6, max effort, ~36K output tokens) 11. ~11 minutes per generation

---

## Round 1: Knowledge Base Enrichment (Data Quality)

**Goal:** Add quantified metrics to position-metrics.json for the 4 weakest positions.

**Why first:** The prompt can't generate quantified bullets from thin air — it needs data. The grounding rules correctly prevent fabrication; the fix is better input data, not weaker rules.

### Changes

**File: `data/sources/knowledge/career/position-metrics.json`**

Add/update entries for:

1. **TReNDS Center** — COINSTAC user/contributor counts, grant amounts, publication citations, dataset scale, compute infrastructure details
2. **Hyperbloom** — $1.4M ARR (already in resume), client count, engagement count, team size, industries served
3. **AWS** — Account portfolio details (already has 10+ named clients), speaking engagement counts, white paper counts, POC-to-production stats
4. **NeuroLex Labs** — ML model count, data pipeline throughput, Tribe fellowship cohort size, TDD coverage metrics

### User Action Required

Paul needs to provide the actual metrics for these positions. The knowledge base exploration shows rich qualitative data but sparse quantified outcomes. Specific questions:

- **TReNDS:** How many institutions use COINSTAC? What grants were secured (amounts)? How many contributors?
- **Hyperbloom:** How many total client engagements? Team size at peak? Revenue milestones beyond $1.4M ARR?
- **AWS:** How many speaking events? White papers authored? Total account portfolio value?
- **NeuroLex:** How many ML models deployed? What data volumes? How many Tribe fellows mentored?

### After data is added

```bash
npm run ingest:force && npm run generate:force && npm run compare
```

Review the regenerated resume for improved metric density, then approve and deploy.

---

## Round 2: CI/CD Infrastructure Fixes

**Goal:** Make the Deploy workflow actually work on push to main.

### Changes

1. **Configure GitHub Secrets** (manual — Paul must do this):
   - Go to repo Settings → Secrets → Actions
   - Add `VERCEL_TOKEN` (from vercel.com/account/tokens)
   - Add `VERCEL_ORG_ID`: `team_EZa7yDGXuubGA4VpNUccqrgM`
   - Add `VERCEL_PROJECT_ID`: `prj_XGIlmRtsRVSzfqETwwuos3G3elUT`

2. **Fix deploy.yml preview step** — Remove `--prebuilt` flag entirely (Vercel builds remotely):

   ```yaml
   # Change:
   DEPLOY_URL=$(vercel deploy --prebuilt --yes --token=...)
   # To:
   DEPLOY_URL=$(vercel deploy --yes --token=...)
   ```

3. **Fix Deployment Protection for smoke tests** — Either:
   - a) Disable Vercel Deployment Protection (Project Settings → Deployment Protection → Disabled), OR
   - b) Use `vercel deploy --skip-domain` + share token for preview access, OR
   - c) Skip preview smoke test and only smoke-test production (simpler but less safe)

4. **Fix issue creation permission** — Add `permissions: issues: write` to deploy workflow:

   ```yaml
   jobs:
     deploy:
       permissions:
         issues: write
         contents: read
   ```

5. **Add ANTHROPIC_API_KEY secret** for the Pipeline workflow (if not already set)

### Verification

After secrets are configured, push a trivial commit to main and verify:

- CI passes → Deploy triggers → Preview deploys → Smoke passes → Production promotes → Smoke passes

---

## Round 3: Prompt Fine-Tuning

**Goal:** Recover the 3% quality regression and strengthen action verb density.

### Changes

**File: `lib/prompts/resume-writer.system.md`**

1. **Strengthen action verb instruction:** Add explicit guidance that EVERY bullet must start with a strong action verb. List the preferred verbs: Led, Architected, Delivered, Scaled, Reduced, Automated, Built, Designed, Managed, Deployed, Established, Drove, Spearheaded, Orchestrated.

2. **Clarify Tier 1 scope:** Current position (Arine) + Hyperbloom (concurrent founder role) are both Tier 1. Hyperbloom should get 3-4 bullets minimum despite being a side venture.

3. **Add location instruction:** "Use the candidate's current location from profile data, not the location of their most recent office-based role."

4. **Validate "Mento" reference:** Check if this is a valid employer in career data or an artifact. If artifact, add to exclusion list.

**File: `scripts/generate-resume.ts`**

5. **Tighten action verb validation:** Current check counts action verb percentage per position. Lower the warning threshold from current level to flag any position with <75% action verb bullets.

6. **Add location validation:** Check that header location matches `profile.location` from career data.

### Verification

```bash
npm run generate:force && npm run compare
```

Quality score should return to ≥398 and ideally exceed 400.

---

## Round 4: Cost Optimization (Optional)

**Goal:** Reduce per-generation cost from $3.75 without sacrificing quality.

### Options (evaluate in order)

1. **Reduce thinking effort from "max" to "high":** May save 30-50% on output tokens. Run A/B comparison with `npm run compare --judge` to measure quality delta.

2. **Try Sonnet 4.6 instead of Opus 4.6:** ~10x cheaper. Run A/B comparison. If quality is within 5%, switch default to Sonnet and reserve Opus for final/production generations.

3. **Reduce max_tokens from 128K to 16K:** The resume is ~8K chars. 128K is excessive headroom. Even 16K provides 2x the needed space.

4. **Prompt caching:** Already implemented. Verify it's working by checking `cache_read_input_tokens` in generation telemetry.

### Verification

For each option, generate 2-3 resumes and compare quality scores. Accept only if quality score stays ≥395.

---

## Implementation Order

| Round                        | Effort     | Blocked on                      | Priority                      |
| ---------------------------- | ---------- | ------------------------------- | ----------------------------- |
| 1. Knowledge Base Enrichment | Medium     | Paul providing metrics          | High — biggest quality impact |
| 2. CI/CD Fixes               | Low-Medium | Paul configuring GitHub secrets | High — deploys are broken     |
| 3. Prompt Fine-Tuning        | Low        | Round 1 data                    | Medium — incremental quality  |
| 4. Cost Optimization         | Low        | Nothing                         | Low — nice to have            |

Rounds 2 and 3 can proceed in parallel. Round 1 requires user input. Round 4 is independent.
