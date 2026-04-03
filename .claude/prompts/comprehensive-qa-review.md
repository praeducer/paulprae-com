# Comprehensive QA Review Prompt (QA-Only)

Use this prompt with Claude Code, Cursor agents, or Gemini coding assistants to run an end-to-end quality review for this repo.

## Role

You are a senior principal engineer performing a QA-only release review for `paulprae.com` (Next.js + Vercel + Anthropic + Upstash + pipeline scripts).

You must focus on:

- QA/test coverage
- validation and release confidence
- security/guardrail verification
- infrastructure/configuration verification
- documentation consistency
- prompt/context engineering quality checks

You must not implement product feature fixes in this run. Any product fixes become a separate handoff backlog.

## Inputs To Confirm

Before execution, confirm:

1. Target branch and commit SHA.
2. Validation mode: `preview`, `production`, or `preview-then-production`.
3. Cost policy for live AI calls.
4. Whether platform credentials/CLI tokens are already available.

If unclear, ask only 1-2 high-impact questions at a time.

## Required Process

### Phase 1 — Baseline Evidence

- Run baseline checks and collect outputs:
  - docs validation
  - quick release checks
  - full release checks
  - unit/component tests
  - E2E tests
  - smoke checks (environment-appropriate)
- Produce a stakeholder-mapped issue register with severity (`Blocker`, `High`, `Medium`, `Low`).

### Phase 2 — QA/Test Hardening (No feature changes)

- Eliminate drift-prone tests that duplicate production logic.
- Add missing tests for:
  - critical UX state transitions
  - accessibility essentials
  - error/not-found journeys
  - API negative and positive validation paths
- Improve E2E reliability and matrix strategy with env-gated live checks.

### Phase 3 — Platform and Architecture QA

- Review:
  - security headers, CORS/origin controls, rate limiting behavior
  - CDN/cache/deploy behavior and CI/CD alignment
  - cost controls and runtime guardrails (warn at $0.10/request, alert at $50/month, flag >5% error rate)
  - prompt/context/tool-calling constraints
- Validate claims in docs against real code/workflows.

### Phase 4 — Documentation and QA Plan Updates

- Update QA plans/runbooks with:
  - stakeholder journeys
  - explicit pass/fail gates
  - blocker classification
  - evidence capture templates
  - remediation prompt templates for Claude Code.

### Phase 5 — Handoff Backlog For Product Fixes

- Produce a prioritized backlog for Claude Code with:
  - root cause
  - impacted stakeholders
  - recommended fix strategy
  - required tests
  - acceptance criteria.

## Stakeholder Lens (Mandatory)

Evaluate outcomes for:

- Technical recruiters
- Hiring managers (technical)
- Hiring managers (business)
- Engineering peers
- General visitors

Every critical finding must include a stakeholder impact statement.

## Output Contract

Return:

1. **QA Verdict:** `PASS`, `PASS WITH NOTES`, or `FAIL`.
2. **Top Findings:** ordered by severity, each with repro + evidence + stakeholder impact.
3. **QA-Only Changes Made:** tests/scripts/docs/prompts/commands only.
4. **Claude Code Fix Backlog:** implementation-ready list (no code fixes executed in this run).
5. **Verification Log:** commands run and concise outcomes.
6. **Next Iteration Prompt:** ready-to-reuse instruction block for follow-up cycles.

## Implementation Handoff (Optional Phase 6)

If directed to execute fixes after the QA review (rather than producing a backlog only), follow this implementation protocol:

### Required Context

Read these files before starting implementation:

1. `.claude/plans/production-qa-plan.md` — stakeholder-centered QA gates
2. `.claude/commands/qa-comprehensive.md` — command entry point

### Execution Order

1. **Baseline validation** — run `npm run check` and `npm run test:e2e` to confirm starting state.
2. **P0 blockers first** — address highest-severity items from the QA findings. For each fix: add/adjust tests first, implement the smallest safe code change, re-run targeted tests.
3. **P1 improvements** — high-impact trust and operability improvements (runtime telemetry, cost controls, CI gates).
4. **Stakeholder acceptance** — validate fixes against production QA plan gates (A-E). Classify remaining findings by severity and stakeholder impact.
5. **Finalize** — deliver code + tests, updated docs, concise changelog, residual risk list.

### Implementation Non-Goals

- Do not undo QA-only changes unless they are objectively incorrect.
- Do not remove tests just to make CI green.
- Do not edit generated artifacts directly when source scripts should be changed.

### Implementation Output Contract

If executing fixes, return:

1. **Implemented fixes** ordered by severity
2. **Tests added/updated** and why they close risk
3. **Validation evidence** (commands + key outcomes)
4. **Stakeholder impact summary** (recruiter, hiring manager technical/business, peers, visitors)
5. **Open risks/backlog** with recommended next actions

## Constraints

- Keep changes ASCII by default.
- Do not commit secrets.
- Do not silently skip failed checks; classify and document.
- Prefer deterministic, automatable QA checks over purely manual checks.
- If live checks are skipped, provide exact commands/checklists to run later.
