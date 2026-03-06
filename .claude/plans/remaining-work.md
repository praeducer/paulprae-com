# Remaining Work — Phase 2 Merge & Deploy

> **Status:** Phase 2 code complete. Ready for live testing and merge.
> **Branch:** `feat/phase2-implementation` (builds clean, all tests pass, lint/format pass)
> **PR:** #21 (DRAFT)

---

## Pre-Merge Checklist

### Live End-to-End Testing

- [ ] `npm run dev` with `ANTHROPIC_API_KEY` in `.env.local`:
  - [ ] `/` — chat renders, send a message, streaming response works
  - [ ] "Tailored resume" chip — triggers tool-calling, returns formatted resume
  - [ ] "Download resume" chip — returns download links
  - [ ] `/resume` — resume page renders with section nav and downloads
  - [ ] `/tools` — tools mode renders with 8 chips
  - [ ] Mobile responsive check (375px viewport)

### Merge Steps

- [ ] Run `npm run check` (full release checklist)
- [ ] Tag current `main` as `v1.0.0` before merge (Phase 1 milestone)
- [ ] Update PR #21 description for full Phase 2 scope
- [ ] Mark PR as ready for review (remove DRAFT)
- [ ] Merge to `main`

### Post-Merge

- [ ] Verify deploy workflow: CI → preview → smoke test → promote → production smoke
- [ ] Verify: https://paulprae.com — chat works, /resume renders, /tools loads
- [ ] Verify AI Gateway logs calls in Vercel dashboard → AI → Gateway
- [ ] Monitor costs for first few days (Vercel AI → Usage, Anthropic Console)
- [ ] Update `package.json` version to `2.0.0`

### Pending DNS (low priority)

- [ ] Update DreamHost A record from `216.198.79.1` to `76.76.21.21`
- [ ] Configure www → non-www redirect in Vercel dashboard
