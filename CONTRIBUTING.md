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
   # Write PR body to a temp file (avoids shell escaping issues with backticks):
   cat > /tmp/pr-body.md << 'PREOF'
   ## Summary
   - Description of changes

   ## Test plan
   - [ ] `npm run check` passes
   PREOF
   gh pr create --title "feat: my feature" --body-file /tmp/pr-body.md
   ```

   > **Tip:** Always use `--body-file` for PR descriptions containing backticks or code blocks.
   > Using `<< 'PREOF'` (quoted delimiter) prevents variable/command expansion.

4. **CI runs automatically** — lint, format check, tests, and build must all pass

5. **Vercel deploys a preview** — check the preview URL in the PR checks

6. **Merge** — squash or merge commit, then delete the branch

### Rules

- All changes to `main` go through pull requests
- CI must pass before merge
- Keep branches short-lived (days, not weeks)
- Delete branches after merge
- **Never** use `git commit --amend` on pushed commits — force pushes orphan SHAs that Vercel and CI depend on

## GitHub CLI Setup (WSL)

For PR creation from the WSL terminal, authenticate `gh` with a personal access token:

1. Create a fine-grained token at https://github.com/settings/tokens
   - Scopes: **Contents** (read/write), **Pull Requests** (read/write)
2. Add to `.env.local`: `GH_TOKEN=github_pat_...`
3. Source it: `export GH_TOKEN=$(grep GH_TOKEN .env.local | cut -d= -f2)`
4. Verify: `gh auth status`

> **Note:** Claude Code uses the Windows `gh.exe` (already authenticated). This setup is only needed for manual `gh` commands in WSL.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>: <short description in imperative mood>

[optional body explaining why, not what]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>   # if AI-assisted
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `design`

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

A **pre-commit hook** runs automatically on every `git commit`. It formats staged files with Prettier via lint-staged before the commit is recorded, so formatting issues never reach CI.

The hook is installed by `npm install` via the `prepare` lifecycle hook — no extra setup needed. It works across all Git environments:

- **WSL / Linux / macOS terminal:** Uses `npx` directly (sources nvm if present)
- **Windows Git clients (GitHub Desktop, VS Code, etc.):** Automatically delegates to WSL via `wsl.exe` when `npx` isn't available in the Windows shell, converting UNC paths to WSL-native paths

Run the release checklist before pushing:

```bash
npm run check         # Full checklist: data files → lint → format → test → build → validate
npm run check:quick   # Data file validation only (instant)
```

Or run individual checks:

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm test              # Vitest (330+ tests)
npm run build         # Next.js build
```

CI runs lint, format, test, build, and build output validation on every PR. All must pass to merge.

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
