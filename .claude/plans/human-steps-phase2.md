# Human Steps — Phase 2 Setup

Tasks requiring manual action or Vercel dashboard configuration. Complements the AI-executable plans (phase2a/b/c).

> **Prerequisites:** Complete the v2.1 human steps first (secrets, metrics, deploy verification).
> **Sequence:** Steps 1-3 can happen in any order (parallelizable). Steps 4-5 after code merges to main.

---

## Step 1: Upgrade to Vercel Pro ($20/mo)

Phase 2 requires Vercel Pro for Fluid Compute (800s function duration for Opus resume generation).

1. Go to: https://vercel.com/account/billing
2. Upgrade to Pro plan ($20/month)
3. Verify: Dashboard shows "Pro" badge

**Why:** Hobby plan has a 10-second function timeout — Opus resume generation takes 30-60 seconds.

---

## Step 2: Provision Upstash Redis for Rate Limiting

> **Changed from original plan:** Uses Upstash Redis directly (`@upstash/redis`), not Vercel KV (`@vercel/kv`). Env var names are `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

1. Go to: https://console.upstash.com (or Vercel Dashboard → Storage → Create → KV/Redis)
2. Create a free Redis database (10,000 requests/day — sufficient for a portfolio site)
3. Copy the REST URL and REST Token
4. Add to Vercel: Settings → Environment Variables:
   - `UPSTASH_REDIS_REST_URL` (Production + Preview)
   - `UPSTASH_REDIS_REST_TOKEN` (Production + Preview)
5. Verify: Both vars exist for Production and Preview environments

**Why:** Distributed rate limiting across Vercel's serverless function instances. The implementation gracefully falls back to no rate limiting when these env vars are absent (safe for local dev).

---

## Step 3: Configure AI Gateway (Optional but Recommended)

1. Go to: https://vercel.com → paulprae-com project → **AI** → **Gateway**
2. Enable AI Gateway for the project
3. Copy the generated `AI_GATEWAY_API_KEY`
4. Add as environment variable: Settings → Environment Variables → `AI_GATEWAY_API_KEY` (Production + Preview)
5. Set budget alerts: AI → Gateway → Budget → Set monthly alert threshold (e.g., $10)

**Benefits:** Zero-markup model routing, per-call observability, budget controls, hot-swap models from dashboard.

**Note:** Current implementation uses `@ai-sdk/anthropic` directly. AI Gateway integration is a Sprint 2+ code change (see Plan 2A Step 8). Setting up the gateway now means it's ready when the code is updated.

---

## Step 4: Add Vercel Environment Variables

After `feat/phase2-implementation` branch merges to main:

1. Go to: Vercel → paulprae-com project → **Settings** → **Environment Variables**
2. Add `ANTHROPIC_API_KEY` for Production + Preview (same key from `.env.local`)
3. Verify Upstash vars from Step 2 are present
4. Verify AI Gateway key from Step 3 is present (if configured)
5. Trigger a deploy and verify `/api/chat` responds

---

## Step 5: Post-Deploy Verification

After Phase 2 code deploys to production:

1. Visit https://paulprae.com — verify chat homepage loads with mode toggle
2. Visit https://paulprae.com/resume — verify resume page loads with downloads
3. Send a test message: "What is Paul's experience with AI?"
4. Verify streaming response renders correctly
5. Toggle to "Job Tools" mode and test a quick action
6. Navigate from chat → resume and resume → chat
7. Check Vercel dashboard → Functions → verify function execution
8. Check Vercel dashboard → AI Gateway → verify calls are logged (if configured)
9. Monitor costs for the first few days (Vercel AI → Usage)

---

## Step 6: Update DNS A Record (Carried Forward from v2.1)

**Status:** Still pending.

1. Log in to panel.dreamhost.com
2. Navigate to Domains → DNS Records
3. Change the A record for `@` from `216.198.79.1` to `76.76.21.21`
4. Wait for propagation (up to 48h)
5. Verify: `dig paulprae.com +short` should return `76.76.21.21`

---

## Cost Summary (Phase 2 Monthly)

| Service       | Cost              | Notes                                             |
| ------------- | ----------------- | ------------------------------------------------- |
| Vercel Pro    | $20/mo            | Required for Fluid Compute                        |
| Upstash Redis | Free tier         | 10K requests/day                                  |
| AI Gateway    | $5/mo free credit | Covers most portfolio-site usage                  |
| Anthropic API | ~$5-20/mo         | Depends on chat traffic; prompt caching saves 90% |
| **Total**     | **~$20-40/mo**    | Scales with usage                                 |
