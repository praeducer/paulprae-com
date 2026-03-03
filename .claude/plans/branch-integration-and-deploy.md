# Branch Integration & Deployment Plan

> **Generated:** 2026-03-03 by Claude Opus 4.6
> **Repository:** praeducer/paulprae-com
> **Goal:** Merge all outstanding branches to main, clean up stale branches, and deploy with zero regressions.

---

## Branch Inventory

| # | Branch | Status | Commits Ahead | Commits Behind | Open PR | Verdict |
|---|--------|--------|---------------|----------------|---------|---------|
| 1 | `claude/fix-word-formatting-aWxHa` | **Active — PR #11 open** | 4 | 0 | #11 | **MERGE** |
| 2 | `claude/test-github-connection-tOmsE` | Empty commit (connectivity test) | 1 (empty) | 0 | None | **DELETE** |
| 3 | `fix/header-layout-nav-uat` | Already merged as PR #9; stale remnant 1 commit behind | 1 | 2 | None | **DELETE** |
| 4 | `fix/nav-buttons-layout-github` | Already merged as PR #7; stale remnant 2 commits behind | 2 | 4 | None | **DELETE** |

### Branch Details

#### 1. `claude/fix-word-formatting-aWxHa` (MERGE)
**Purpose:** Three meaningful improvements + one lint fix.
- **DOCX compatibility fix** (`scripts/export-resume.ts`): Post-processes Pandoc DOCX to inject `compatibilityMode=15` in `word/settings.xml`, eliminating the "Compatibility Mode" banner in Word 2013+. Uses `unzip`/`zip` CLI tools to extract, patch XML, and repackage.
- **Sticky header reorganization** (`app/page.tsx`): Splits the header into 3 rows — name+title, contact links, then resume downloads with a "Resume" label.
- **Test coverage** (`tests/pipeline.test.ts`): Validates DOCX has the compatibility flags.
- **Lint fix**: Replaces `require("child_process")` with ES import.
- **CI status:** All passing (Vercel preview + CI green).
- **Conflicts with main:** None (clean merge).

#### 2. `claude/test-github-connection-tOmsE` (DELETE)
**Purpose:** Empty commit used to verify GitHub push connectivity from a Claude Code session. Contains zero code changes. No PR was created. Safe to delete.

#### 3. `fix/header-layout-nav-uat` (DELETE)
**Purpose:** Was the working branch for PR #9 (compact header layout and nav scroll alignment). PR #9 was merged to main on 2026-03-02. The remote branch is now stale — it's 2 commits behind main (PRs #9 and #10 both landed after this branch diverged). Its one unmerged commit is an earlier version of changes that were superseded by the merged PRs. Merging this would **regress** the current header layout.

#### 4. `fix/nav-buttons-layout-github` (DELETE)
**Purpose:** Was the working branch for PR #7 (nav tracking, button labels, header layout, GitHub in exports). PR #7 was merged on 2026-03-02. The remote branch has 2 commits (the original + a Prettier format fix) but is 4 commits behind main. All meaningful changes already landed via PR #7. The extra `qa-fixes-round-3.md` plan file and `VERSIONS.md` entry are stale artifacts. Merging would cause conflicts in 10+ files with no benefit.

---

## Code Review Findings

### PR #11 (`claude/fix-word-formatting-aWxHa`) — Approved with Notes

**Overall quality: Good.** All tests pass, CI green, clean diff.

#### Positive
- DOCX compat fix is well-structured with proper cleanup in `finally` block
- Non-fatal error handling (DOCX still usable if fix fails)
- Good use of `crypto.randomUUID()` for temp directory uniqueness
- Test actually extracts and validates the DOCX XML content
- ES import fix resolves a real lint violation

#### Issues Found

1. **Minor — `require()` on local branch vs remote mismatch:** The local branch (commit `0a65f8c`) still has `require("child_process")` in `tests/pipeline.test.ts:310`, but the remote (commit `87896e8`) has the ES import fix. The local branch needs to be pulled before any further work. **Action:** `git pull` before merging.

2. **Minor — System dependency assumption:** The `fixDocxCompatibility()` function assumes `unzip` and `zip` are available as system binaries. This is fine for Linux/macOS CI but will silently skip on Windows (non-fatal `try/catch`). The test also requires `unzip`. **Action:** Acceptable — the skip behavior is correct and the function is non-fatal.

3. **Minor — Temp directory race condition is mitigated:** Uses `crypto.randomUUID()` suffix, which is sufficient. No actual race risk.

4. **Cosmetic — Header row ordering is a design choice:** The branch moves contact links above downloads (Row 2: contacts, Row 3: downloads). This is the opposite order from what PR #7 established (downloads first). This is intentional per the branch description. **Action:** Accept — design decision by the branch author.

5. **Note — Binary file in git:** `public/Paul-Prae-Resume.docx` is committed (per project policy for Vercel static serving). The updated DOCX with compat mode is larger (16KB vs 14KB) due to the added XML. This is expected.

### Already-Merged Branches — No Action Needed

- **PR #7 (`fix/nav-buttons-layout-github`):** Good changes — scroll-based nav tracking replaced flaky IntersectionObserver, GitHub field added to types and pipeline, button labels standardized. All changes are on main.
- **PR #9 (`fix/header-layout-nav-uat`):** Good changes — header height CSS variable and SectionNav threshold tuning. All changes are on main.

---

## Conflict Analysis

| Merge Scenario | Conflicts? | Details |
|---|---|---|
| PR #11 → main | **None** | Clean fast-forward possible (0 commits behind) |
| `header-layout-nav-uat` → main | **Yes** | `app/page.tsx` has 1 conflict (flex gap value). Would regress layout. |
| `nav-buttons-layout-github` → main | **Yes, severe** | 10+ files conflict including `SectionNav.tsx`, `page.tsx`, resume data, binary files. All content already on main via PR #7. |
| PR #11 + `header-layout-nav-uat` | **Yes** | `page.tsx` header layout is completely different between them. |

---

## Merge Order

Only one branch needs merging. The order is:

1. **Merge PR #11** (`claude/fix-word-formatting-aWxHa`) — the only branch with unmerged, non-stale changes
2. **Delete** the 3 stale branches

---

## Execution Steps

Run these commands on your Windows desktop (or any machine with git + gh CLI).

### Step 1: Merge PR #11

```bash
# Merge via GitHub UI or CLI
gh pr merge 11 --squash --delete-branch

# Or if you prefer a merge commit:
gh pr merge 11 --merge --delete-branch
```

**Squash is recommended** since the 4 commits are logically related and a single commit message is cleaner on main.

### Step 2: Delete Stale Remote Branches

```bash
# Delete the empty test branch
git push origin --delete claude/test-github-connection-tOmsE

# Delete the already-merged PR #9 branch
git push origin --delete fix/header-layout-nav-uat

# Delete the already-merged PR #7 branch
git push origin --delete fix/nav-buttons-layout-github
```

### Step 3: Clean Up Local Branches

```bash
# Fetch and prune deleted remote branches
git fetch --prune

# Delete local tracking branches if they exist
git branch -d fix/header-layout-nav-uat 2>/dev/null
git branch -d fix/nav-buttons-layout-github 2>/dev/null
git branch -d claude/test-github-connection-tOmsE 2>/dev/null
git branch -d claude/fix-word-formatting-aWxHa 2>/dev/null

# Return to main
git checkout main
git pull origin main
```

### Step 4: Verify Deployment

```bash
# Run the full release checklist
npm run check

# Verify Vercel auto-deployed from main
# Check: https://paulprae.com
# Check: https://paulprae-com-one.vercel.app
```

### Step 5: Verify DOCX Fix Specifically

```bash
# Download the DOCX from the live site and open in Word
# Confirm: No "Compatibility Mode" banner appears in the title bar
# Confirm: File opens as a normal modern Word document
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PR #11 merge breaks build | Very Low | Medium | CI already passes; Vercel preview is green |
| Stale branch deletion loses work | None | None | All changes from stale branches are already on main via merged PRs #7 and #9 |
| DOCX fix fails on some systems | Low | Low | Non-fatal try/catch; DOCX works without compat fix, just shows banner |
| Vercel deployment fails | Very Low | Medium | Vercel has automatic rollback; previous deployment is preserved |

---

## Post-Merge Checklist

- [ ] PR #11 merged to main
- [ ] `claude/test-github-connection-tOmsE` deleted
- [ ] `fix/header-layout-nav-uat` deleted
- [ ] `fix/nav-buttons-layout-github` deleted
- [ ] `npm run check` passes locally
- [ ] Vercel production deployment succeeds
- [ ] DOCX opens without "Compatibility Mode" in Word
- [ ] Site renders correctly at paulprae.com
- [ ] No remaining remote branches besides `main`
