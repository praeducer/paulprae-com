---
description: UAT smoke test against a live deployment (preview or production)
allowed-tools: Bash, mcp__playwright__*, mcp__vercel__*
---

Run UAT smoke tests against a live deployment of paulprae.com.

**Target URLs:**

- Preview (latest PR branch): `https://paulprae-com-git-feat-interview-booking-cta-praeducers-projects.vercel.app`
- Production: `https://paulprae.com`

## Automated E2E (preferred — runs full smoke suite)

```bash
BASE_URL=<target-url> npx playwright test --reporter=list
```

This runs all smoke tests (page rendering, navigation, API validation, chat interaction) against the live URL without spinning up a local server.

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

## Post-merge production checklist

After merging to main and deploying to production:

1. Run: `BASE_URL=https://paulprae.com npx playwright test --reporter=list`
2. Check Vercel runtime logs for `cache_creation_input_tokens` on first chat request
3. Check Vercel runtime logs for `cache_read_input_tokens` on second chat request
4. Manually trigger cron warmup (if CRON_SECRET is available)
5. Verify no `x-robots-tag: noindex` on production pages
