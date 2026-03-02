# Contributing to paulprae.com

Thank you for your interest in contributing! This guide covers the development workflow, branching strategy, and quality standards.

## Prerequisites

See [README.md — Getting Started](README.md#getting-started) for setup instructions including Node.js, API key, LinkedIn data, and export dependencies.

## Environments

| Environment       | Branch      | URL                                  | Deploys on      |
| ----------------- | ----------- | ------------------------------------ | --------------- |
| Local dev         | any         | `localhost:3000`                     | `npm run dev`   |
| Preview / Staging | PR branches | `<branch>-paulprae-com.vercel.app`   | Push to PR      |
| Production        | `main`      | [paulprae.com](https://paulprae.com) | Merge to `main` |

Vercel automatically creates a **preview deploy** for every PR. Use the preview URL to verify changes before merging.

## Branching Strategy (GitHub Flow)

We use [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) — a single long-lived branch (`main`) with short-lived feature branches.

### Branch naming convention

```
feature/<name>    # New functionality (e.g., feature/dark-mode)
fix/<name>        # Bug fixes (e.g., fix/pdf-export-margin)
docs/<name>       # Documentation-only changes (e.g., docs/update-readme)
chore/<name>      # Tooling, CI, dependency updates (e.g., chore/upgrade-next)
```

### Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout main && git pull
   git checkout -b feature/my-feature
   ```

2. **Make changes** and commit (see [Commit Messages](#commit-messages))

3. **Push and open a PR** against `main`:

   ```bash
   git push -u origin feature/my-feature
   gh pr create --fill  # or use GitHub web UI
   ```

4. **CI runs automatically** — lint, format check, tests, and build must all pass

5. **Vercel deploys a preview** — check the preview URL in the PR checks

6. **Merge** — squash or merge commit, then delete the branch

### Rules

- All changes to `main` go through pull requests
- CI must pass before merge
- Keep branches short-lived (days, not weeks)
- Delete branches after merge
- **Never** use `git commit --amend` on pushed commits — force pushes orphan SHAs that Vercel and CI depend on

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>: <short description in imperative mood>

[optional body explaining why, not what]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>   # if AI-assisted
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`

**Examples:**

- `feat: add dark mode toggle`
- `fix: correct PDF margin on mobile`
- `docs: update pipeline commands in README`

## Pipeline Workflow

The AI generation pipeline runs **locally**, not on Vercel. Before committing generated content:

```bash
npm run pipeline          # Full: ingest → generate → export → build
# or
npm run pipeline:content  # Just: ingest → generate
npm run pipeline:render   # Just: export → build
```

Generated files that should be committed: `data/generated/career-data.json`, `data/generated/<Name>-Resume.md` (filename derived from profile name), `public/<Name>-Resume.*`

## Code Quality

Run these before pushing:

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm test              # Vitest (178+ tests)
npm run build         # Next.js static export
```

CI runs all four checks on every PR. All must pass to merge.

## What NOT to Commit

- `.env.local` — API keys
- `data/sources/linkedin/*.csv` — raw LinkedIn exports
- `data/generated/*.pdf`, `data/generated/*.docx` — regenerable binary artifacts
- `data/generated/*.staging.md` — transient staging files
- `node_modules/`

## Resume Content Changes

The resume markdown is **generated** — don't edit the resume `.md` file directly. To change content:

1. Edit `scripts/generate-resume.ts` (prompt, formatting, data processing)
2. Run `npm run generate` (writes to staging)
3. Run `npm run compare` to review changes vs current approved version
4. Run `npm run approve` to promote staging → live
5. Run `npm run export` to regenerate PDF/DOCX
6. Commit the updated files
