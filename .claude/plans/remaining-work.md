# Remaining Work — Phase 2 Merge & Deploy

> **Status:** Phase 2 code complete. Release checklist passes. Ready for merge.
> **Branch:** `feat/phase2-implementation`
> **PR:** #21 (DRAFT — needs description update and mark ready)

---

## Pre-Merge

- [ ] Tag current `main` as `v1.0.0` before merge (Phase 1 milestone)
- [ ] Update PR #21 description, mark ready, merge to `main`

## Post-Deploy

- [ ] Run UAT checklist: [`docs/uat-checklist.md`](../../docs/uat-checklist.md)
- [ ] Verify AI Gateway logs in Vercel dashboard
- [ ] Monitor costs for first few days (Vercel + Anthropic Console)
- [ ] Update `package.json` version to `2.0.0`

## DNS & Domain (low priority)

**Research finding:** www -> non-www redirect IS best practice. Not debatable — you must pick one canonical and 301-redirect the other. Google has no preference for which direction, but `paulprae.com` (non-www) is the right choice because:

- Shorter, cleaner for personal branding (business cards, verbal mentions)
- Already the canonical URL in `layout.tsx` metadata and `resume/page.tsx`
- No technical need for www (no cookie scoping, no CNAME requirements)

**Action items:**

- [ ] Add `www.paulprae.com` in Vercel Dashboard > Project Settings > Domains
- [ ] Configure Vercel's built-in redirect toggle (www -> non-www) — handles it at CDN edge, ~10-50ms
- [ ] Verify DNS at DreamHost matches what Vercel recommends (check dashboard for current A record IP — may not be `76.76.21.21` anymore, Vercel now uses dynamic Anycast IPs)
- [ ] Set DreamHost hosting to "DNS Only" for this domain if not already
