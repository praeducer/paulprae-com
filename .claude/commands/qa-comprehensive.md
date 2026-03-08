---
description: Run comprehensive QA-only review and produce Claude Code fix backlog
---

Run the full QA-only release review workflow defined in:

- `./.claude/prompts/comprehensive-qa-review.md`
- `./.claude/plans/production-qa-plan.md`

Execution requirements:

1. Confirm target mode (`preview`, `production`, or `preview-then-production`) and cost policy.
2. Follow the prompt phases exactly (baseline evidence, test hardening, platform review, docs alignment, handoff backlog).
3. Restrict code edits to QA/testing/validation/documentation/prompt-command assets only.
4. Do not implement product feature fixes; output those as a prioritized Claude Code backlog.
5. Return the output contract from the prompt file.
