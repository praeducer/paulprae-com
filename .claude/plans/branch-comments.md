# Branch Comments — Ready to Post

> No GitHub API auth available in this environment.
> Copy each comment below and post it on the corresponding PR/issue.

---

## PR #11 (OPEN) — `claude/fix-word-formatting-aWxHa`

**Post at:** https://github.com/praeducer/paulprae-com/pull/11

```markdown
## Code Review Summary

**Verdict: Approve — ready to squash-merge.**

CI and Vercel preview are both green. No conflicts with main. Full analysis in the [integration plan](https://github.com/praeducer/paulprae-com/blob/claude/fix-word-formatting-aWxHa/.claude/plans/branch-integration-and-deploy.md).

### What this PR does

1. **DOCX compatibility fix** — Post-processes Pandoc DOCX output to inject `compatibilityMode=15` into `word/settings.xml`, eliminating the "Compatibility Mode" banner in Word 2013+. Uses `execFileSync` (not `exec`) for shell safety. Non-fatal try/catch means the DOCX is still usable if `unzip`/`zip` aren't installed.
2. **Sticky header reorg** — Splits header into 3 rows: name+title, contact links, resume downloads with a "Resume" label.
3. **Test** — Validates the DOCX XML contains the compatibility flags.
4. **Lint fix** — Replaces `require("child_process")` with ES import.

### Review findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `require()` lint violation in test | High | **Fixed** in commit `87896e8` |
| 2 | No `checkBinary()` for `unzip`/`zip` | Low | Acceptable — non-fatal try/catch handles missing tools |
| 3 | String-based XML manipulation | Low | Acceptable for controlled Pandoc output |
| 4 | Security (shell commands) | None | Correct use of `execFileSync` with array args |
| 5 | Binary DOCX in git | None | Follows project policy (public/ committed for Vercel) |

### Relationship to other branches

- **`fix/header-layout-nav-uat`** (PR #9, merged) — That PR established the row-based header layout. This PR refines it by reordering rows (contacts above downloads) and adding the "Resume" label. No conflict.
- **`fix/nav-buttons-layout-github`** (PR #7, merged) — That PR added `profile.github` to the data model and pipeline. This PR's header reorg uses `profile.github` (already on main). No conflict.
- **`claude/test-github-connection-tOmsE`** — Empty connectivity test branch. Unrelated. Should be deleted.

### Recommended follow-up (not blocking this PR)

These tech debt items were found during the cross-branch code review:

1. **Zod schema gap** — Add `github: z.string().optional()` to `CareerDataSchema` in `scripts/ingest-linkedin.ts` (~line 562) to match the TypeScript type.
2. **Enrichment unit tests** — `enrichProfileFromKnowledge` in `ingest-linkedin.ts` has zero unit tests. All enriched fields (linkedin, website, email, github) are untested.
3. **GitHub link accessibility** — The GitHub contact link in the sticky header is missing `min-h-[44px]` for WCAG touch target compliance. Email and LinkedIn links have it.

### Merge recommendation

**Squash merge** (`gh pr merge 11 --squash --delete-branch`) — the 4 commits are logically related and read cleanly as a single change.
```

---

## PR #9 (MERGED) — `fix/header-layout-nav-uat`

**Post at:** https://github.com/praeducer/paulprae-com/pull/9

```markdown
## Post-merge note — branch cleanup

The remote branch `fix/header-layout-nav-uat` still exists but is now **stale**. It has 1 commit ahead of its merge base but is **2 commits behind main** (this PR's squash merge + PR #10). The unmerged commit (`7bd4731`) is the pre-squash version of this PR's changes — its content is already on main.

**Action: Delete the remote branch.** Merging it now would regress the header layout by reverting PR #10's title positioning fix (`justify-between` → `gap-3`).

See the full branch analysis in the [integration plan](https://github.com/praeducer/paulprae-com/blob/claude/fix-word-formatting-aWxHa/.claude/plans/branch-integration-and-deploy.md).

### How later PRs built on this work

- **PR #10** refined the Row 1 layout from this PR — changed `justify-between gap-4` to `gap-3` so the title sits adjacent to the name instead of being pushed to the far right.
- **PR #11** (open) further reorganizes the rows from this PR — moves contact links above downloads and adds a "Resume" label prefix to the download row.

### Code quality notes from review

This PR made solid improvements that are still active on main:
- `--header-height: 80px` (up from 61px) correctly matches the taller stacked-row layout
- SectionNav threshold `+16` aligns JS scroll tracking with the CSS `scroll-padding-top: +16px`
- `requestAnimationFrame(onScroll)` defers initial measurement until layout settles

No issues found with the merged code.
```

---

## PR #7 (MERGED) — `fix/nav-buttons-layout-github`

**Post at:** https://github.com/praeducer/paulprae-com/pull/7

```markdown
## Post-merge note — branch cleanup & follow-up items

The remote branch `fix/nav-buttons-layout-github` still exists but is now **stale**. It has 2 commits ahead (original + Prettier format fix) but is **4 commits behind main** (PRs #7, #8, #9, #10 all merged after divergence). Merging would cause conflicts in 10+ files with zero benefit.

**Action: Delete the remote branch.** All meaningful changes are on main.

See the full branch analysis in the [integration plan](https://github.com/praeducer/paulprae-com/blob/claude/fix-word-formatting-aWxHa/.claude/plans/branch-integration-and-deploy.md).

### How later PRs built on this work

- **PR #8** — Cleaned up nav alignment and publications formatting, building on the scroll-based SectionNav from this PR.
- **PR #9** — Improved SectionNav threshold accuracy (reduced breathing room from `+32` to `+16` to match CSS) and added `requestAnimationFrame` for deferred initial measurement. Also restructured the header layout from this PR into the current 3-row format.
- **PR #10** — Refined the Row 1 title positioning that this PR introduced.
- **PR #11** (open) — Reorders the contact/download rows and adds a "Resume" label. Also adds DOCX Word compatibility fix (unrelated to this PR's scope).

### Code quality findings from review

**Overall: Good quality.** The IntersectionObserver → scroll-based tracking was the right call — IO entries arrive in non-deterministic order, causing the off-by-one highlight bug. The scroll approach is the industry standard (Bootstrap ScrollSpy, Docusaurus, etc.).

**Follow-up items identified:**

1. **Zod schema gap (low priority):** `CareerDataSchema` in `scripts/ingest-linkedin.ts` (~line 562) does not include `github: z.string().optional()`. The TypeScript `CareerProfile` interface has the field, but the Zod runtime validator doesn't. Data survives because `.safeParse()` result is only checked for `success` and the raw (unparsed) object is written to disk — but it means `github` is never validated at runtime.

2. **No enrichment unit tests:** `enrichProfileFromKnowledge` covers linkedin, website, email, and github enrichment but has zero unit tests. Good candidate for a follow-up test PR.

3. **GitHub link touch target:** The GitHub link added in this PR used `className="rounded-md px-1 py-0.5"` without `min-h-[44px]`. Email and LinkedIn links have the WCAG-compliant 44px minimum. This inconsistency persists on main.

### Extra artifact on branch

The branch includes `.claude/plans/qa-fixes-round-3.md` — a plan file that describes the work done in this PR. It was committed to the branch but not included in the squash merge to main (which is correct — it's a working document, not a deliverable). The file will be deleted when the branch is deleted.
```

---

## `claude/test-github-connection-tOmsE` (NO PR)

**No PR exists for this branch.** If you want to leave a record, you could open and immediately close an issue, or just delete the branch silently. Here's a deletion command:

```bash
git push origin --delete claude/test-github-connection-tOmsE
```

If you want to note it somewhere, this summary covers it:

> Empty commit branch created to verify GitHub push connectivity from a Claude Code session. Contains zero code changes. No PR was created. Safe to delete without review.
