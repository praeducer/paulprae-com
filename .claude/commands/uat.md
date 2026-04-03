---
description: UAT smoke test against a live deployment (preview or production)
allowed-tools: Bash, mcp__playwright__*, mcp__vercel__*
---

Run UAT smoke tests against a live deployment of paulprae.com.

**Default target:** `https://paulprae.com` (production)

To test a specific preview deployment, first get the URL:

```
list recent Vercel deployments and find the latest preview URL for this project
```

Then run:

```bash
BASE_URL=<preview-url> npx playwright test --reporter=list
```

## Automated E2E (preferred — runs full smoke suite)

```bash
BASE_URL=https://paulprae.com npx playwright test --reporter=list
```

This runs all smoke tests (page rendering, navigation, API validation, chat interaction) without spinning up a local server. Takes ~30s.

## Manual checks via Playwright MCP (use when E2E can't reach a protected URL)

Use the Playwright MCP browser tool to verify each item:

### Homepage (`/`)

- [ ] Title: "Paul Prae — AI Career Assistant | paulprae.com"
- [ ] "Paul Prae" heading visible
- [ ] "Principal AI Engineer & Architect" subtitle visible
- [ ] Quick action chips: Quick overview, Core expertise, Recent work, Tailored resume, Download resume, Book Interview
- [ ] "Book Interview" button in header nav (blue, links to Outlook Bookings)
- [ ] Chat input visible with correct placeholder
- [ ] No emojis anywhere on the page

### Resume page (`/resume`)

- [ ] "Paul Prae" heading visible
- [ ] "Professional Summary" section visible
- [ ] Section nav works (click a section → page scrolls)
- [ ] PDF download link present in contact row (has file size label)
- [ ] "Book Interview" link in contact row

### Security checks (verify response headers)

- [ ] `x-frame-options: DENY`
- [ ] `strict-transport-security` present
- [ ] `x-robots-tag: noindex` is **absent** on production (present on preview — expected)
- [ ] CORS: `access-control-allow-origin` is `https://paulprae.com` (not `*`)

### API health

- [ ] `POST /api/chat` with empty body → 400
- [ ] `POST /api/chat` with `{"messages":[]}` → 400
- [ ] `GET /api/cron` without auth → 401

## Cache health (check after any chat interaction)

```
check Vercel runtime logs for /api/chat in the last 30 minutes, look for "cache_tokens" log lines
```

Expected healthy log line:

```
[chat] cache_tokens: {"cache_read":73923,"cache_write":0,"ephemeral_1h":"n/a","ephemeral_5m":"n/a"}
```

Key signals:

- `cache_read > 0` on 2nd+ request → cache is working ✅
- `cache_write > 0` only on cold start → normal ✅
- `ephemeral_1h > 0` and `ephemeral_5m = 0` → 1-hour TTL active ✅
- `ephemeral_5m > 0` and `ephemeral_1h = 0` → only 5-minute TTL (cron is critical) ⚠️

## Deployment health check

```
list recent Vercel deployments and check production deployment state
```

## Post-merge production checklist

After merging to main and deploying to production:

1. Run: `BASE_URL=https://paulprae.com npx playwright test --reporter=list`
2. Check Vercel runtime logs for `cache_tokens` on first chat request
3. If `ephemeral_1h > 0`: cron warmup can be reduced; 55-min schedule is sufficient
4. If only `ephemeral_5m > 0`: manually trigger cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://paulprae.com/api/cron`
5. Verify no `x-robots-tag: noindex` on production pages
