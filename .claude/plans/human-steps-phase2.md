# Human Steps — Phase 2 Setup

Tasks requiring manual action or Vercel dashboard configuration. Complements the AI-executable plans (phase2a/b/c).

> **All critical infrastructure steps are COMPLETE.** Only live E2E testing and merge steps remain.
>
> - [x] Step 1: Vercel Pro upgrade — DONE (Fluid Compute enabled)
> - [x] Step 2: Upstash Redis — DONE (`upstash-kv-redis-rest-paulprae-com` via Vercel KV, rate limiting verified)
> - [x] Step 3: AI Gateway — DONE (enabled on Vercel project, OIDC auth, code integrated)
> - [x] Step 3b: Anthropic spending limits — DONE
> - [x] Step 4: Vercel environment variables — DONE (ANTHROPIC*API_KEY, KV_REST_API*\*, VERCEL_OIDC_TOKEN)
> - [x] Vercel spending limits — DONE
> - [ ] Step 5: Post-deploy verification — blocked on merge
> - [ ] Step 6: DNS A record — low priority, deferred

---

## Step 1: Upgrade to Vercel Pro ($20/mo) — DONE

Phase 2 requires Vercel Pro for Fluid Compute (800s function duration for Opus resume generation).

**Why:** Hobby plan has a 10-second function timeout — Opus resume generation takes 30-60 seconds.

---

## Step 2: Provision Upstash Redis for Rate Limiting — DONE

Provisioned `upstash-kv-redis-rest-paulprae-com` via Vercel KV integration.

**Env vars set (Vercel Production + Preview + `.env.development.local`):**

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_URL`
- `REDIS_URL`

**Code supports both naming conventions:** `KV_REST_API_*` (Vercel integration) and `UPSTASH_REDIS_REST_*` (direct Upstash). `Redis.fromEnv()` auto-detects both.

**Verified:** Rate limiting active — 429 responses after 20 req/min exceeded.

---

## Step 3: Configure AI Gateway — DONE

AI Gateway enabled on Vercel project. Code integrated via `@ai-sdk/gateway`.

**How it works:**

- On Vercel: Gateway is auto-authenticated via `VERCEL_OIDC_TOKEN` (no separate key needed)
- Locally: Falls back to direct `@ai-sdk/anthropic` (uses `ANTHROPIC_API_KEY`)
- Model routing: `gateway("anthropic/claude-sonnet-4-6")` → Vercel AI Gateway → Anthropic

**Benefits active:**

- Per-call observability in Vercel Dashboard → AI → Gateway
- Budget alerts and spending controls
- Model hot-swap from dashboard without code changes
- Unified logging across providers

---

## Step 3b: Anthropic API Spending Limits — DONE

Hard spending cap configured in Anthropic Console.

---

## Step 4: Vercel Environment Variables — DONE

All required env vars configured for Production + Preview:

- `ANTHROPIC_API_KEY` — Claude API access
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis rate limiting
- `VERCEL_OIDC_TOKEN` — AI Gateway authentication (auto-set by Vercel)

---

## Step 5: Post-Deploy Verification

After Phase 2 code deploys to production:

1. Visit https://paulprae.com — verify chat homepage loads
2. Visit https://paulprae.com/resume — verify resume page loads with downloads
3. Send a test message: "What is Paul's experience with AI?"
4. Verify streaming response renders correctly
5. Test "Tailored resume" chip — should trigger tool-calling
6. Test "Download resume" chip — should return links
7. Navigate from chat → resume and resume → chat
8. Check Vercel dashboard → Functions → verify function execution
9. Check Vercel dashboard → AI → Gateway → verify calls are logged
10. Monitor costs for the first few days

---

## Step 6: Update DNS A Record (Carried Forward from v2.1)

**Status:** Still pending (low priority).

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
