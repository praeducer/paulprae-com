# QA Fixes Round 3 — Nav, Buttons, Layout, GitHub in Exports

## Issues

1. **Nav links off-by-one** — IntersectionObserver entry order is non-deterministic; clicking "Technical Skills" highlights "Education"
2. **Inconsistent button labels** — PDF says "Resume PDF", others say just "DOCX" / "MD"
3. **Download buttons + contact links on same row** — looks odd when wrapping on resize
4. **GitHub link missing from exported resumes** — PDF/DOCX/MD don't have GitHub; pipeline doesn't carry the field

## Plan

### Step 1: Fix SectionNav active tracking (Issue 1)

**File:** `app/components/SectionNav.tsx`

**Root cause:** IntersectionObserver callback receives entries in arbitrary order. The code takes the first `isIntersecting` entry, which may not be the topmost visible section.

**Fix:** Replace IntersectionObserver with a scroll-position-based approach:
- Single `scroll` event listener (passive) replaces both useEffect #2 (IntersectionObserver) and useEffect #3 (scroll-to-top clearing)
- On each scroll, loop through sections in DOM order, check `getBoundingClientRect().top`
- The last section whose heading top is ≤ the sticky offset threshold becomes active
- If `scrollY < 100`, clear active (handles scroll-to-top)
- Keep useEffect #1 (ResizeObserver for header height) unchanged

### Step 2: Standardize download button labels (Issue 2)

**File:** `app/page.tsx`

Change labels:
- `Resume PDF` → `PDF`
- `DOCX` → `DOCX` (already fine)
- `MD` → `Markdown`

All three get the download icon + file size badge. The download icon communicates the action; being on a resume site makes "Resume" redundant.

### Step 3: Separate downloads from contact links (Issue 3)

**File:** `app/page.tsx`

Split the single `<nav>` with 6 items into two visual rows:
- **Row 1 (Downloads):** PDF, DOCX, Markdown buttons — with download icons
- **Row 2 (Contact):** Email, LinkedIn, GitHub links — text links with subtle styling
- Vertical gap between rows
- Each row has its own flex container

Also: use `profile.github` instead of hardcoded URL (after Step 4 adds the field).

### Step 4: Add GitHub to pipeline + exports (Issue 4)

**Files:** `lib/types.ts`, `scripts/ingest-linkedin.ts`, `scripts/generate-resume.ts`, `data/generated/career-data.json`, `data/generated/Paul-Prae-Resume.md`, `app/page.tsx`

Chain of changes (each is 1-3 lines):

1. **`lib/types.ts`** — Add `github?: string` to `CareerProfile` interface
2. **`scripts/ingest-linkedin.ts`** — Add github enrichment in `enrichProfileFromKnowledge()`:
   ```ts
   if (!data.profile.github && kbProfile.github) {
     data.profile.github = kbProfile.github;
   }
   ```
3. **`scripts/generate-resume.ts`** — Update SYSTEM_PROMPT contact line template:
   ```
   **[Title]** | [Location] | [Email] | [LinkedIn URL] | [GitHub URL] | [Website URL]
   ```
4. **`data/generated/career-data.json`** — Add `"github": "https://github.com/praeducer"` to profile object
5. **`data/generated/Paul-Prae-Resume.md`** — Add GitHub link to contact line (line 7)
6. **`app/page.tsx`** — Use `profile.github` for the GitHub link href instead of hardcoded URL

### Step 5: Re-export and verify

- Run `npm run export` to regenerate PDF/DOCX with GitHub link
- Run `npm test` — all pass
- Run `npm run check:fix` — syncs public/ copies, lint, format, build
- Manual verification via dev server

## Files Modified

| File | Change |
|------|--------|
| `app/components/SectionNav.tsx` | Replace IO with scroll-based tracking |
| `app/page.tsx` | Button labels, layout split, profile.github |
| `lib/types.ts` | Add `github?: string` to CareerProfile |
| `scripts/ingest-linkedin.ts` | Add 3-line github enrichment |
| `scripts/generate-resume.ts` | Add `[GitHub URL]` to template |
| `data/generated/career-data.json` | Add github to profile |
| `data/generated/Paul-Prae-Resume.md` | Add GitHub to contact line |
