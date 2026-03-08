---
description: Execute V2 implementation handoff from QA findings
---

Run the V2 implementation cycle using:

- `./.claude/prompts/claude-code-v2-execution-handoff.md`

Required context files:

- `./.claude/plans/v2-qa-baseline-evidence.md`
- `./.claude/plans/production-qa-plan.md`

Requirements:

1. Validate baseline first (`npm run check`, `npm run test:e2e`).
2. Prioritize P0 blockers from baseline evidence.
3. Keep tests and docs aligned with every fix.
4. Return a final report using the prompt's output contract.
