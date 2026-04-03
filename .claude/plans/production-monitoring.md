# Production Monitoring Plan — paulprae.com

**Goal:** Monitor the production system using Claude Code as autonomously as possible.  
**One command:** `/uat` — runs the full monitoring sweep.

---

## One-Command Monitoring

### Run smoke tests against production

```bash
BASE_URL=https://paulprae.com npx playwright test --reporter=list
```

Covers: page rendering, navigation, API health (400/401 responses), chat interaction. Takes ~30s.

### Run the /uat command in Claude Code

```
/uat
```

Claude will run E2E tests, check security headers, verify Vercel deployment status, and inspect runtime logs for cache health — all using Playwright MCP + Vercel MCP.

---

## Scheduled Autonomous Monitoring (Claude Code)

Use the `schedule` skill to create a recurring monitoring agent:

```
/schedule daily 9am — run /uat against https://paulprae.com and report any failures
```

Or use `loop` for incident response:

```
/loop 5m — check Vercel runtime logs for errors in /api/chat
```

---

## What to Monitor

### 1. Anthropic Cache Health (most important)

Check Vercel runtime logs for these fields after each chat request:

| Field                         | Healthy                | Unhealthy          |
| ----------------------------- | ---------------------- | ------------------ |
| `cache_creation_input_tokens` | > 0 on first req       | 0 every request    |
| `cache_read_input_tokens`     | > 0 on 2nd+ req        | 0 every request    |
| TTFT (first token)            | < 2s warm / < 15s cold | > 20s consistently |

**How to check via Claude Code:**

```
check Vercel runtime logs for the /api/chat function in the last hour, look for cache_creation_input_tokens and cache_read_input_tokens
```

**Critical signals:**

- Second request slower than first → cache not working (check beta header)
- All requests 15-20s → cron warmup failing (check CRON_SECRET env var)
- `cache_creation_input_tokens: 0` on every request → `extended-cache-ttl-2025-04-11` beta header missing

### 2. Deployment Health

Via Vercel MCP:

```
list recent deployments and check the production deployment state
```

Via E2E:

```bash
BASE_URL=https://paulprae.com npx playwright test e2e/smoke.spec.ts --reporter=list
```

### 3. API Error Rate

Check Vercel runtime logs for error-level entries from `/api/chat`:

```
check runtime logs for errors in the last 24 hours, filter by /api/chat
```

Key patterns to watch:

- `[chat] Stream error` — Anthropic API errors
- `[tool:generate_tailored_resume]` — resume tool failures
- HTTP 429 — rate limit being hit (check Upstash usage)
- HTTP 503 — ANTHROPIC_API_KEY missing or service down

### 4. Cron Warmup

The cron fires every 55 minutes. Verify it's running:

```
check Vercel runtime logs for /api/cron in the last 2 hours
```

Expected: `ok` response every ~55 minutes.  
If missing: check CRON_SECRET is set in Vercel production env vars.

### 5. Core User Flows

```bash
# Production smoke (no API tokens burned — uses mocked responses)
BASE_URL=https://paulprae.com npx playwright test --reporter=list

# Live chat test (burns ~$0.01 in API tokens)
E2E_LIVE_CHAT=1 BASE_URL=https://paulprae.com npx playwright test e2e/live-chat.spec.ts
```

---

## Post-Deploy Verification (after each merge to main)

Run this sequence immediately after production deploys:

```bash
# 1. Smoke tests
BASE_URL=https://paulprae.com npx playwright test --reporter=list

# 2. Trigger cache warmup manually (requires CRON_SECRET)
curl -X GET https://paulprae.com/api/cron -H "Authorization: Bearer $CRON_SECRET"

# 3. Check logs for cache creation
# → Use: check Vercel runtime logs for cache_creation_input_tokens
```

Expected after step 2:

- Response: `ok`
- Vercel logs: `cache_creation_input_tokens > 0` for both `chat` and `resume-generator` prompts

---

## Observability Stack Reference

| Platform                          | What to check                     | How                             |
| --------------------------------- | --------------------------------- | ------------------------------- |
| Vercel Dashboard → Logs           | Runtime errors, TTFT, cache stats | `mcp__vercel__get_runtime_logs` |
| Vercel Dashboard → Analytics      | Page views, top pages, geography  | Vercel Dashboard manually       |
| Vercel Dashboard → Speed Insights | LCP, CLS, TTFB, INP               | Vercel Dashboard manually       |
| Anthropic Console                 | API usage, spend, rate limits     | console.anthropic.com           |
| Upstash Console                   | Rate limit hits, Redis usage      | console.upstash.com             |

---

## Alerting (not yet configured)

Future improvement: set up Vercel deploy hooks or Upstash rate-limit alerts to push to email/Slack when:

- A production deployment fails
- Rate limit threshold exceeded (e.g. > 50% of limit in 1 minute)
- Anthropic spend cap approaching
