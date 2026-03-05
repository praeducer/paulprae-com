# Phase 2 Final Merge Plan

> **Status:** All code and infrastructure complete. This plan covers the remaining steps to merge and deploy.

---

## What's Done

### Infrastructure (all human steps complete)

- Vercel Pro with Fluid Compute
- Upstash Redis rate limiting (verified: 429 after 20 req/min)
- Vercel AI Gateway (observability, budget controls, model routing)
- Anthropic + Vercel spending limits
- All env vars on Vercel (Production + Preview)

### Code (feat/phase2-implementation)

- 360 unit tests + 11 E2E tests, all passing
- TypeScript clean, lint clean, build clean
- Chat homepage `/`, resume `/resume`, tools `/tools`, API `/api/chat`
- Security hardened: CORS middleware, rate limiting with fallback, input validation, prompt injection defense
- AI Gateway integration with direct Anthropic fallback

---

## Remaining Steps

### 1. Live End-to-End Testing (human + AI)

Manual testing of the running app. Run `npm run dev` and verify:

- [ ] `/` — Chat renders with welcome message, send a message, streaming works
- [ ] "Tailored resume" chip — triggers tool-calling, returns formatted resume
- [ ] "Download resume" chip — returns download links (PDF, DOCX, MD, web)
- [ ] `/resume` — Full resume with section nav, downloads, skip link
- [ ] `/tools` — 8 tool chips, noindex meta tag
- [ ] Mobile responsive check (375px viewport)
- [ ] Character counter appears when typing long messages
- [ ] Rate limiting returns 429 on rapid requests

### 2. Release Checks

```bash
npm run check          # Full: data + lint + format + test + build + validate
npm run test:e2e       # Playwright E2E (separate — requires dev server)
```

### 3. Tag Phase 1

```bash
git checkout main
git pull
git tag -a v1.0.0 -m "Phase 1: AI-generated static resume site"
git push origin v1.0.0
```

### 4. Update PR and Merge

```bash
# Update PR description with full Phase 2 scope
gh pr edit 21 --title "feat: Phase 2 — AI chat platform with security hardening"

# Mark as ready (remove DRAFT)
gh pr ready 21

# Merge (squash or merge commit)
gh pr merge 21 --merge
```

### 5. Post-Deploy Verification

1. Visit https://paulprae.com — chat works
2. Visit https://paulprae.com/resume — resume renders
3. Send test message, verify streaming
4. Check Vercel Dashboard → AI → Gateway → verify calls logged
5. Check Vercel Dashboard → Functions → verify execution
6. Monitor costs for first few days

### 6. Version Bump

```bash
# After merge to main
npm version 2.0.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to 2.0.0"
git push
```

---

## Security Architecture Summary

```
User Browser
    │
    ▼
┌─────────────────────────────┐
│  Vercel Edge (CDN)          │
│  ├─ HSTS, CSP, X-Frame     │
│  └─ Static: /, /resume,    │
│     /tools                  │
└─────────────┬───────────────┘
              │ POST /api/chat
              ▼
┌─────────────────────────────┐
│  Next.js Middleware         │
│  ├─ Origin validation       │
│  ├─ CORS (allowed origins)  │
│  ├─ Method enforcement      │
│  └─ Security headers        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Chat API Route             │
│  ├─ Content-Type check      │
│  ├─ Rate limiting           │
│  │   ├─ Upstash Redis       │
│  │   └─ In-memory fallback  │
│  ├─ Body size limit (100KB) │
│  ├─ Message count (50 max)  │
│  ├─ Per-msg length (4K)     │
│  ├─ Total input budget      │
│  └─ Tool input Zod schemas  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Vercel AI Gateway          │
│  ├─ Observability/logging   │
│  ├─ Budget controls         │
│  └─ Model routing           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Anthropic Claude Sonnet    │
│  ├─ Prompt caching (90%     │
│  │   cost reduction)        │
│  ├─ System prompt with      │
│  │   security rules S1-S5   │
│  ├─ XML-delimited user      │
│  │   input in tools         │
│  └─ Grounding rules G1-G10  │
└─────────────────────────────┘
```

## Cost Controls (Defense in Depth)

| Layer      | Control               | Limit                           |
| ---------- | --------------------- | ------------------------------- |
| Client     | maxLength on textarea | 4,000 chars                     |
| Middleware | Origin validation     | Allowed origins only            |
| API Route  | Rate limiting         | 20 req/min/IP                   |
| API Route  | Body size             | 100 KB                          |
| API Route  | Message count         | 50 messages                     |
| API Route  | Per-message           | 4,000 chars                     |
| API Route  | Tool inputs           | 10K job desc, 200 char emphasis |
| AI SDK     | maxOutputTokens       | 4,096 tokens                    |
| Vercel     | maxDuration           | 120 seconds                     |
| Vercel     | AI Gateway budget     | Configurable alerts             |
| Vercel     | Spending limit        | Hard cap                        |
| Anthropic  | Spending limit        | Hard cap                        |
| Anthropic  | Prompt caching        | ~90% input cost reduction       |
