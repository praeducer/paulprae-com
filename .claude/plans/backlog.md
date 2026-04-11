# AI-Driven Backlog — paulprae.com

Actionable coding and documentation tasks for Claude Code. No human-only tasks here (those are in `human-tasks.md`).

> Last reconciled: 2026-04-03 against `feat/interview-booking-cta` (PR #28 — MERGED ✅)

---

## Post-Merge Automation

- [x] Bump `package.json` version to `2.0.0` after merging PR #28 to main (completed — already at 2.0.0)
- [ ] Add CI route validation — `test -d .next/server/app/resume` to verify specific routes exist in build output

## Observability

- [ ] **Confirm cache 1h vs 5m TTL** — `[chat] cache_tokens: ephemeral_1h/5m` always show `"n/a"` because `providerMetadata.anthropic.usage` doesn't include those fields in AI SDK 3.0.58. Two options: (1) upgrade `@ai-sdk/anthropic` to `3.0.66` which may expose them, or (2) check Anthropic Console directly for "Cache Write (1h)" vs "Cache Write (5m)" bucket breakdown. If 1h is confirmed, cron at 55 min is correct. If only 5m, increase cron frequency (see below).
- [ ] **Cron frequency if 1h TTL not working** — If Anthropic Console confirms only 5m cache writes, change `vercel.json` cron from `*/55 * * * *` to `*/4 * * * *`. Note: 4-min cron with 5m TTL costs ~$4/hour in cache writes; only viable if 1h TTL is definitively broken and cannot be fixed.
- [ ] **Upgrade `@ai-sdk/anthropic`** from `3.0.58` to latest stable (`3.0.66`) — may fix 1h TTL serialization and expose `ephemeral_1h_input_tokens` in usage metadata

## Pipeline Enhancements

- [ ] Add job description comparison CLI (`npm run compare:jobs`) with stakeholder persona voting and weighted scoring
- [ ] Add pipeline metrics output (`tokens`, `cost`, `latency`, artifact sizes) to a gitignored metrics file
- [ ] Add optional JSON Resume export from `career-data.json`

## Cost Optimization

Current generation cost: ~$2.90 per run (Claude Opus 4.6, max effort, ~453s).

Options to evaluate in order:

1. **Reduce thinking effort from "max" to "high":** May save 30-50% on output tokens. Run A/B comparison with `npm run compare --judge` to measure quality delta.
2. **Try Sonnet 4.6 instead of Opus 4.6:** ~10x cheaper. Run A/B comparison. If quality is within 5%, switch default to Sonnet and reserve Opus for final/production generations.
3. **Reduce max_tokens from 128K to 16K:** The resume is ~8K chars. 128K is excessive headroom.
4. **Prompt caching:** Implemented and confirmed working — `cache_read: 73,923` tokens on every warm request. 1-hour TTL intent present; see Observability backlog for TTL confirmation steps.

Acceptance criteria: quality score must stay >=395 for any optimization to be accepted.

## UX Enhancements

- [ ] **Rate limiting blank bubble (P1)** — When `/api/chat` returns 429 (or 400 for oversized body), the AI SDK stream ends without error content → assistant message bubble goes blank silently. Fix: add a client-side error handler in `ChatHome.tsx` that detects non-2xx responses from the `/api/chat` stream and shows a toast/inline message: "Too many requests — please wait a moment and try again." The `useChat` hook from AI SDK 6 exposes an `onError` callback; hook into that and map HTTP status codes to user-facing messages. Confirmed in UAT Round 4 (2026-04-04): rapid-fire messages triggered rate limiting but blank bubble was the only feedback. Expected: a visible rate limit message matching the UAT checklist's 429 check.
- [ ] Platform-aware copy-to-clipboard in tools mode
- [ ] Character count display for tools mode
- [ ] Add highlight reel badges below the header (defer to Phase 3 component work)
- [ ] Add skill-tier visualization (chips/progress bars/tag clouds; currently plain grouped lists)
- [ ] Add contact chips/badges styling for Email/LinkedIn/GitHub links
- [ ] Add `<time>` element wrapping for date ranges in resume body (SEO micro-optimization)

## Lighthouse / Performance (Remaining After PR #33)

Scores as of 2026-04-04 commit `2031703` (post-PR-#33): **Performance 97 / Accessibility 100 / Best Practices 96 / SEO 100**.
Color contrast fix ✅ resolved Accessibility 96→100. Items below are what remains.

- [ ] **Legacy JS polyfills (Best Practices 96 → 100)** — `47288bb2a605c691.js` still ships Array.at/flat/flatMap, Object.fromEntries/hasOwn, String.trimStart/trimEnd polyfills (~14KB). The `browserslist` field added to `package.json` in PR #33 targets last-2 modern browsers but did NOT eliminate them. Investigation needed: (1) identify which dependency is shipping these (likely a deep transitive dep of `@assistant-ui/react` or `@ai-sdk/*`); (2) check if Next.js's `transpilePackages` or a Webpack `exclude` can strip them; (3) alternatively add a `.browserslistrc` at the project root (sometimes `package.json` field is ignored). Accept criteria: polyfill chunk removed or reduced to 0KB in `next build` output.
- [ ] **Unused JS / code splitting (Performance)** — Lighthouse flags 237KB of unused JS: `9d058cc6c530487a.js` (79.8% unused) and `47288bb2a605c691.js` (38.4% unused). The large chunk is the full `@assistant-ui/react` chat runtime loaded on every page. Consider dynamic import with `next/dynamic` + `ssr: false` for the `AssistantRuntimeProvider` and `Thread` components so the chat bundle only loads on `/`. Resume and tools pages would benefit most. Note: this is a non-trivial refactor — `ChatHome.tsx` wraps the entire page; splitting will require a lazy boundary around the chat-specific subtree.
- [ ] **Render-blocking CSS (Performance, ~120ms savings)** — `2c9a3cb7abd55a59.css` is render-blocking. Likely the Tailwind CSS bundle. Options: (1) verify `next/font` is being used (already is); (2) check if any `<link rel="stylesheet">` tags are manually added in layout; (3) preload critical CSS. Low-priority — 97 performance score is already strong.
- [ ] **CSP `unsafe-inline` (Best Practices)** — Lighthouse flags CSP with `unsafe-inline` for scripts. Strict CSP with nonces requires Next.js middleware to inject per-request nonces into both the `Content-Security-Policy` header and all inline `<script>` tags. This is a significant infrastructure change. See `next-safe-middleware` or Next.js docs on nonce-based CSP. Only pursue if security posture requires it.
- [ ] **Source maps (informational)** — Large JS chunk missing source maps. Low priority; add `productionBrowserSourceMaps: true` to `next.config.ts` if debugging production issues. Note: adds ~2x to build size.

## MCP Expansion (when corresponding stack exists)

- [ ] Add Sentry MCP when production monitoring is enabled
- [ ] Add PostgreSQL/Supabase MCP when database-backed Phase 3 is active
- [ ] Add Neo4j MCP when graph-backed Phase 3 is active
- [ ] Evaluate `mcp-pandoc` when on-demand export is needed in chat workflows
