# `.claude/plans/` — Session Entry Point

**If you are a fresh Claude Code agent starting in this repo, read this file first.**

## Current State (2026-04-11)

**Branch:** `uat/mega-merge-apr-2026` | **PR:** [#39](https://github.com/praeducer/paulprae-com/pull/39) (draft, CI green)
**All 7 feature branches merged.** 511 tests pass, resume quality 415, Autonomize AI is current employer everywhere.

**Paul starts at Autonomize AI:** Monday April 13, 2026
**Next step:** Paul runs UAT on Vercel preview, squash-merges PR #39 to main

## Plan Documents

### Active

| File                               | Purpose                                           | Status                           |
| ---------------------------------- | ------------------------------------------------- | -------------------------------- |
| `remaining-phases-ssot.md`         | Writing-rules SSOT refactor roadmap (Phase A1-A9) | Phases A1+A3+A5 executing on UAT |
| `content-quality-system-design.md` | 5-layer quality stack architecture                | Reference (locked)               |
| `backlog.md`                       | Post-merge coding/automation backlog              | Active, reconciled 2026-04-11    |

### Reference (human action needed)

| File                               | Purpose                                      |
| ---------------------------------- | -------------------------------------------- |
| `human-tasks.md`                   | Manual tasks (DNS, SEO, mobile testing)      |
| `production-monitoring.md`         | Post-deploy monitoring playbook              |
| `production-qa-plan.md`            | Stakeholder-centered QA framework            |
| `data-model-and-knowledge-base.md` | Phase 3 knowledge graph design (deferred)    |
| `hotfix-multi-resume-bug.md`       | Multi-resume chat bug (tracked as issue #41) |

### Completed (historical reference)

| File                                     | Purpose                                             | Completed                           |
| ---------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| `mega-merge-strategy.md`                 | 10-phase merge of 7 branches into UAT               | PR #39 open                         |
| `mega-merge-review-prompt.md`            | Copilot SWE Agent review (30 issues, all addressed) | Issues in v2 plan                   |
| `autonomize-transition-agent-handoff.md` | Career transition tooling refactor                  | PR #38 absorbed into UAT            |
| `autonomize-transition-human-runbook.md` | Paul's pre-merge QA guide                           | Reference for future career changes |
| `generic-jingling-mccarthy.md`           | Mega-merge execution plan (this session)            | Execution complete                  |

## Authoritative Career Timeline

Pinned in `tests/data-consistency.test.ts`. **Do NOT trust memory files for dates.**

| Role                       | Company             | Start    | End       | Type                |
| -------------------------- | ------------------- | -------- | --------- | ------------------- |
| Solutions Architect        | **Autonomize AI**   | Apr 2026 | _current_ | full-time           |
| Staff AI DataOps Engineer  | Arine               | Sep 2025 | Mar 2026  | full-time           |
| Chief AI Architect         | Booz Allen Hamilton | Jul 2024 | Mar 2025  | full-time           |
| Chief AI Officer, Founder  | Hyperbloom          | Jun 2021 | Aug 2025  | self-employed       |
| Neuroinformatics Architect | TReNDS Center       | Jan 2022 | Sep 2023  | full-time           |
| Enterprise AI Architect    | Amazon Web Services | Aug 2018 | May 2021  | full-time           |
| Senior AI Architect        | Decooda             | Feb 2018 | Jul 2018  | full-time           |
| Senior AI Engineer         | NeuroLex Labs       | Feb 2018 | Jul 2018  | part-time moonlight |
| Analytics Consultant       | Slalom Consulting   | Jul 2015 | Jan 2018  | full-time           |

## Quick Sanity Check

```bash
python3 -c "
import json
with open('data/generated/career-data.json') as f:
    data = json.load(f)
targets = {'Autonomize AI':'2026-04→None', 'Arine':'2025-09→2026-03',
           'Hyperbloom':'2021-06→2025-08', 'NeuroLex Labs':'2018-02→2018-07',
           'Decooda':'2018-02→2018-07'}
for p in data['positions']:
    if p['company'] in targets:
        actual = f\"{p['startDate']}→{p['endDate']}\"
        expected = targets[p['company']]
        status = '✅' if actual == expected else '❌'
        print(f'{status} {p[\"company\"]:20} {actual} (expected {expected})')
"
```

## NVIDIA Tailored Content

- Resume: `data/generated/tailored/Paul-Prae-Resume-NVIDIA.md` (95% grader score)
- Cover letter: `data/generated/tailored/Paul-Prae-Cover-Letter-NVIDIA.md` (92% grader score)
- Iterate: `npm run generate:tailored -- nvidia --force` then `npm run grade`

## Tracking Issues

- [#40](https://github.com/praeducer/paulprae-com/issues/40) — Phase A SSOT refactor
- [#41](https://github.com/praeducer/paulprae-com/issues/41) — Multi-resume chat bug

---

_Last updated: 2026-04-11 by Claude Opus 4.6 on `uat/mega-merge-apr-2026`_
