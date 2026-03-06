# Human Tasks — paulprae.com

Tasks that require manual action: Vercel dashboard, GitHub UI, DNS provider, browser testing, or personal decisions. Cannot be automated by Claude Code.

> Last updated: 2026-03-06

---

## Pre-Merge (do before merging Phase 2)

- [ ] Tag current `main` as `v1.0.0` (Phase 1 milestone)
- [ ] Update PR #21 description, mark ready for review, merge to `main`

## Post-Deploy (do after merging to main)

- [ ] Run UAT checklist in browser: [`docs/uat-checklist.md`](../../docs/uat-checklist.md)
- [ ] Verify AI Gateway logs in Vercel Dashboard > AI Gateway
- [ ] Monitor costs for first few days (Vercel Dashboard + Anthropic Console)
- [ ] Check Vercel Dashboard > Functions — `/api/chat` executions appear

## DNS & Domain

- [ ] Add `www.paulprae.com` in Vercel Dashboard > Project Settings > Domains
- [ ] Configure Vercel's built-in www -> non-www redirect toggle (handles it at CDN edge)
- [ ] Verify DNS at DreamHost matches Vercel recommendations (check dashboard for current A record IP — Vercel now uses dynamic Anycast IPs)
- [ ] Set DreamHost hosting to "DNS Only" for this domain if not already

**Context:** Non-www (`paulprae.com`) is the canonical URL — shorter for personal branding, already set in layout.tsx metadata. No technical need for www subdomain.

## Content & Branding

- [ ] Obtain and add professional headshot to header/OG image
