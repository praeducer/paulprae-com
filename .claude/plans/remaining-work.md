# Remaining Work — Phase 2 Merge & Deploy

> **Status:** Phase 2 code complete. Ready for live testing and merge.
> **Branch:** `feat/phase2-implementation`
> **PR:** #21 (DRAFT)

---

## Pre-Merge

- [ ] Run `npm run check` (full release checklist)
- [ ] Run `npm run dev` with `ANTHROPIC_API_KEY` — verify chat, resume, tools work locally
- [ ] Tag current `main` as `v1.0.0` before merge (Phase 1 milestone)
- [ ] Update PR #21 description, mark ready, merge to `main`

## Post-Deploy

- [ ] Run UAT checklist: [`docs/uat-checklist.md`](../../docs/uat-checklist.md)
- [ ] Verify AI Gateway logs in Vercel dashboard
- [ ] Monitor costs for first few days (Vercel + Anthropic Console)
- [ ] Update `package.json` version to `2.0.0`

## Pending DNS (low priority)

- [ ] Update DreamHost A record from `216.198.79.1` to `76.76.21.21`
- [ ] Configure www → non-www redirect in Vercel dashboard
