# V2 QA Baseline Evidence (Preview/Local)

Date: 2026-03-08
Scope: QA-only baseline for Phase 2 (`feat/phase2-implementation`) using local/preview-compatible checks.

## Command Evidence

| Check                | Command                                              | Result                           | Notes                                                                                                |
| -------------------- | ---------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Docs validation      | `npm run validate:docs`                              | PASS                             | Required docs + internal links pass.                                                                 |
| Quick release gate   | `npm run check:quick`                                | PASS                             | Data files, resume quality, public sync pass.                                                        |
| Unit/component suite | `npm test`                                           | PASS                             | `406` tests passed, `2` skipped.                                                                     |
| Full release gate    | `npm run check`                                      | PASS                             | Lint/format/tests/build/build output pass.                                                           |
| E2E suite            | `npm run test:e2e`                                   | FAIL                             | Playwright webServer startup timed out after Turbopack panic.                                        |
| Smoke script (local) | `SMOKE_TEST_URL=http://localhost:3001 npm run smoke` | FAIL (expected local limitation) | Security headers missing locally because they are set in Vercel edge config, not local `next start`. |

## Prioritized Issue Register (Stakeholder-Mapped)

### P0 (Release confidence blockers)

1. **Playwright startup instability blocks browser QA automation**
   - **Evidence:** `npm run test:e2e` fails with Turbopack backend panic (`Failed to lookup task type`, missing `.sst` file) and webServer timeout.
   - **Stakeholders impacted:** Engineering leadership, recruiters/hiring managers (reduced confidence in regression protection).
   - **Repro path:** `npm run test:e2e`.
   - **Recommendation for Claude Code:** update Playwright webServer strategy to avoid Turbopack for E2E (use stable runtime), add retries/diagnostics, and split fast mocked tests from optional live checks.

2. **Critical API/security tests mirror production logic instead of importing it**
   - **Evidence:** `tests/proxy.test.ts` and `tests/tool-calling.test.ts` duplicate regex/schema logic.
   - **Stakeholders impacted:** Security reviewers, platform engineers, technical interviewers.
   - **Repro path:** compare `tests/proxy.test.ts` with `proxy.ts`; compare `tests/tool-calling.test.ts` with `app/api/chat/route.ts`.
   - **Recommendation for Claude Code:** refactor tests to call/import production contracts directly so policy/schema drift cannot silently pass.

### P1 (High-value risk reduction)

3. **Frontend UX-critical behavior under-tested**
   - **Evidence:** no focused tests for `SectionNav`, `BackToTop`, `app/error.tsx`, `app/not-found.tsx`; current component coverage is light.
   - **Stakeholders impacted:** Recruiters and hiring managers evaluating polish/accessibility.
   - **Repro path:** inspect `tests/` coverage and route/component inventory.
   - **Recommendation for Claude Code:** add targeted tests for keyboard nav, active section behavior, back-to-top threshold/interaction, and error journey affordances.

4. **Browser/device coverage is too narrow**
   - **Evidence:** Playwright config currently only uses `Desktop Chrome`.
   - **Stakeholders impacted:** Mobile users, Safari/Firefox users, QA reviewers.
   - **Repro path:** `playwright.config.ts` project matrix.
   - **Recommendation for Claude Code:** expand to WebKit/Firefox and at least one mobile viewport profile.

### P2 (Quality/cost/documentation alignment)

5. **Documentation and implementation drift in deployment/security/cost claims**
   - **Evidence:** mismatches between docs and workflows/runtime (rollback behavior, deploy model wording, token cap references).
   - **Stakeholders impacted:** technical leadership, security/compliance reviewers.
   - **Repro path:** compare `docs/devops.md`, `SECURITY.md`, `README.md`, `CONTRIBUTING.md`, `docs/ai-architecture.md`, `docs/technical-design-document.md` against `.github/workflows/*.yml` and `app/api/chat/route.ts`.
   - **Recommendation for Claude Code:** synchronize docs to source-of-truth code/workflows and add consistency checks where feasible.

6. **Smoke checks are environment-sensitive and can produce false local negatives**
   - **Evidence:** local smoke run fails security-header checks that are injected by Vercel edge headers.
   - **Stakeholders impacted:** QA operators.
   - **Repro path:** `SMOKE_TEST_URL=http://localhost:3001 npm run smoke`.
   - **Recommendation for Claude Code:** document local-vs-Vercel smoke expectations and gate header assertions by environment/target.

## Stakeholder Feedback Matrix (User-Story Lens)

| Stakeholder                | Story                                                                      | Baseline risk                                           | QA/Test recommendation                                                      |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Recruiter                  | "I need fast confidence that site quality is professional and stable."     | Browser QA automation instability weakens confidence.   | Stabilize E2E runtime and add recruiter journey assertions.                 |
| Hiring manager (technical) | "I need proof security and API constraints are real, not just documented." | Drift-prone tests may miss policy regressions.          | Refactor tests to import production contracts; add negative-path API tests. |
| Hiring manager (business)  | "I need trustworthy release process and clear operations narrative."       | Docs/workflow mismatch reduces trust in platform rigor. | Align DevOps/Security docs to actual CI/CD behavior.                        |
| Engineering peer           | "I expect maintainable tests that fail when production behavior changes."  | Mirrored schemas/regex create false confidence.         | Remove duplicated logic from tests.                                         |
| General visitor            | "I expect polished responsive behavior and accessibility."                 | Limited UI-focused tests can allow subtle regressions.  | Add focused component/a11y tests and multi-browser checks.                  |

## Baseline Verdict

- **Readiness:** PASS WITH NOTES (for unit/build/docs) and **FAIL** for current E2E reliability.
- **Next QA-only focus:** test-contract refactors, UI-focused test additions, E2E matrix hardening, and docs/plan alignment.
