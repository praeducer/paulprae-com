# Prompt for Claude Code — Phase 2 Hardening, Cleanup, and MVP Versioning

You are working in `paulprae-com` on branch `feat/phase2-implementation`.

## Mission

Deliver a minimal, elegant hardening pass that makes this project a trustworthy, memorable, production-quality demo of AI engineering and architecture skills. Prioritize correctness, reliability, honesty, maintainability, and open-source quality. Remove legacy clutter and reduce confusion for both AI agents and human engineers.

Do **not** over-engineer. Prefer deleting stale code/docs over adding abstractions.

## Non-Negotiable Constraints

- Keep changes minimal and high leverage.
- Do not add new infrastructure or big dependencies.
- Preserve existing architecture (Next.js App Router + `/api/chat` + pipeline).
- Do **not** edit generated resume content directly (`data/generated/Paul-Prae-Resume.md`).
- Keep all quality gates green (`npm run check`).

## Persona-Based Critical Code Review

Use these personas as the review board. Treat their findings as required inputs to the implementation plan.

### 1) Principal Runtime Engineer (Reliability)

Critical feedback:

- `app/api/chat/route.ts` parses request JSON with a direct cast and lacks robust body validation/guards. Malformed JSON or malformed shape can produce 500s instead of deterministic 400s.
- `app/api/chat/route.ts` has no explicit request size/message-count constraints, increasing risk of runaway token usage or unstable behavior under abuse.
- `tests/chat-api.test.ts` covers only 3 basic invalid-input cases and misses key failure paths (invalid JSON parse, system prompt failures, rate-limit behavior, oversized payloads).

### 2) Security & Abuse Engineer

Critical feedback:

- Rate limiting in `app/api/chat/route.ts` fails open if Upstash init fails. For local dev this is fine; for production this can become cost/abuse risk.
- IP extraction trusts `x-forwarded-for` with no hardening strategy and no fallback policy specific to production platform behavior.
- Security model docs claim broad guarantees that are not fully enforced in code.

### 3) AI Quality & Trust Engineer

Critical feedback:

- Docs claim Anthropic prompt caching in the chat route, but `app/api/chat/route.ts` currently does not implement explicit cache-control blocks/provider options.
- Tools-mode content quality requirements (e.g., character-count display) are prompt-only and not backed by testable guardrails.
- Recruiter trust risk: placeholder-like data such as `XXX XXX` in knowledge content can leak into AI responses and appear low-credibility.

### 4) Open Source Maintainer (Linux Foundation/MIT quality bar)

Critical feedback:

- OSS hygiene docs are incomplete for a public, production-facing repo (no `CHANGELOG.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`).
- Release/versioning strategy is unclear: app is still `0.1.0` while MVP is a major milestone.
- There is no explicit, documented app release/tag convention beyond resume artifact versioning.

### 5) Docs/Architecture Steward

Critical feedback:

- Documentation drift is significant and can mislead contributors:
  - `README.md` still references static export behavior in places.
  - `docs/devops.md` still says static `out/` hosting details.
  - `docs/technical-design-document.md` contains stale/contradictory Phase 1/2 statements and references non-existent or removed component patterns.
  - `.claude/commands/deploy-vercel.md` and `.claude/commands/README.md` still describe static-site deploy behavior.
- This drift directly increases maintenance burden and AI-agent confusion.

### 6) Lean Systems Architect (Bloat Reduction)

Critical feedback:

- Legacy `out/` assumptions remain in tests/config/docs (`tests/pipeline.test.ts`, `.gitignore`, `.prettierignore`, docs), creating dead pathways and noise.
- At least one lint warning exists in tests (`tests/config.test.ts` unused `_testExports` import), indicating quality gates are not strict enough.
- Potentially redundant direct dependency declarations should be verified and removed if unnecessary (only if safely proven).

---

## Implementation Plan (Execute in Order)

### Phase A — Baseline and Safety

1. Run and capture baseline:
   - `git status --short --branch`
   - `npm run check`
2. Work in small commits logically grouped by concern.
3. For each deletion candidate, prove no runtime imports/usages before deleting.

### Phase B — P0 Runtime Hardening

1. Harden `app/api/chat/route.ts` request handling:
   - Add strict body schema validation (messages + mode).
   - Handle invalid JSON parse errors explicitly with `400`.
   - Add sane bounds (max messages, max text size) and return `413`/`400` as appropriate.
   - Keep user-safe, non-leaky error messages.
2. Add focused tests in `tests/chat-api.test.ts` for:
   - invalid JSON body
   - malformed message shape
   - oversized payload/message count limits
   - system prompt unavailability path

### Phase C — P1 Reliability, Trust, and Cost Integrity

1. Resolve prompt-caching truth gap:
   - Either implement explicit chat prompt caching in `app/api/chat/route.ts`, **or**
   - remove/adjust all claims that caching is active today.
   - Prefer the minimal correct option.
2. Add production-safe rate-limit behavior:
   - Keep fail-open for local/dev.
   - In production, add clear telemetry/logging and a safer fallback policy (minimal complexity).
3. Add guardrails for placeholder data leakage:
   - Prevent obviously redacted placeholder names from being presented as credible references in chat outputs.
   - Keep implementation simple and explicit.

### Phase D — Documentation Truth and Legacy Cleanup

1. Reconcile docs to actual architecture (no stale static-export claims):
   - `README.md`
   - `docs/devops.md`
   - `docs/technical-design-document.md`
   - `.claude/commands/deploy-vercel.md`
   - `.claude/commands/README.md`
2. Remove or rewrite obsolete assets that create confusion:
   - `docs/deployment.md` (if fully superseded by `docs/devops.md`)
   - dead `out/` test block in `tests/pipeline.test.ts`
   - outdated comments referencing static export where no longer true
3. Clean lint/dead-code noise:
   - remove unused `_testExports` import in `tests/config.test.ts`
4. Normalize ignore/config entries:
   - remove legacy `out/` references where truly obsolete.

### Phase E — Open Source Standards and Release Governance

1. Add minimal OSS governance docs:
   - `CHANGELOG.md` (Keep a Changelog format, SemVer-aware)
   - `SECURITY.md`
   - `CODE_OF_CONDUCT.md`
   - `SUPPORT.md`
2. Document release policy in README or CONTRIBUTING:
   - app release tag format (`vX.Y.Z`)
   - resume artifact tag format (`resume/YYYY-MM-DD`)

### Phase F — MVP Major Version Preservation

Goal: preserve the currently deployed `main` milestone as a major release snapshot.

1. Identify the exact production `main` commit SHA (from git/GitHub/Vercel deploy metadata).
2. Create immutable annotated tag on that SHA:
   - `v1.0.0-mvp` (or `v1.0.0` if team preference is strict semver tag)
3. Publish GitHub release from that tag with notes describing it as the MVP milestone.
4. Add a `CHANGELOG.md` entry referencing this release/tag and what it represents.
5. If package version metadata must align, do it in a separate, explicit follow-up commit (do not mutate the historical snapshot tag target).

---

## Explicit Deletion/Prune Targets (Validate Before Deleting)

- Dead/static-export legacy:
  - obsolete `out/` test assertions in `tests/pipeline.test.ts`
  - stale static-export references across docs and command guides
- Candidate obsolete docs:
  - `docs/deployment.md` if duplicated by `docs/devops.md`
- Stale planning clutter:
  - reduce archive noise only if references are updated and context is preserved in one concise canonical doc
- Unused imports/functions/components/data:
  - remove proven-unused code paths/imports; prefer deletion over retention

## Required Verification

After changes:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run check`

Also provide:

- A list of deleted files and why each deletion is safe.
- A list of doc claims corrected to match actual runtime behavior.
- The exact release tag/release commands used for MVP version preservation.

## Success Criteria (Definition of Done)

- No stale architecture contradictions remain in active docs.
- Chat API returns deterministic 4xx for malformed client input.
- Legacy static-export clutter is removed from active code/tests/docs.
- OSS governance docs exist and are coherent.
- MVP milestone is preserved with a clear major release tag.
- All checks pass without warnings/errors.
