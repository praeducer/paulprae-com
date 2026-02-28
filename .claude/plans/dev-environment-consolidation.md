# Plan: Dev Environment Consolidation

> **Created:** 2026-02-27
> **Context:** Remaining items from the desktop environment audit and setup session.
> **Reference:** `docs/windows-dev-environment-setup.md`, `machine-inventory.local.md` (gitignored)
> **Prerequisites:** User must finish active WSL work session before steps that require `wsl --shutdown`.

---

## Step 1: Apply .wslconfig

**Requires:** WSL shutdown (interrupts all running WSL sessions)
**Human action:** User must close WSL work first

```powershell
wsl --shutdown
```

Wait ~8 seconds, then relaunch WSL terminal. Verify new limits:

```bash
free -h          # Should show ~32 GB total
nproc            # Should show 12
```

**Claude action after relaunch:** Verify limits applied, update `machine-inventory.local.md` to note .wslconfig is active.

---

## Step 2: Move paloist-core to Dev Drive

**Requires:** Dev Drive D: exists (done)

```powershell
robocopy C:\dev\paloist-core D:\dev\paloist-core /E /MOVE
cd D:\dev\paloist-core
git status
```

**Claude action:** Verify the move succeeded and the repo is clean. Update any Claude Code project-scoped settings paths if needed.

---

## Step 3: Clone active repos to Dev Drive

**Requires:** Dev Drive D: exists (done)
**Human decision needed:** Which repos are actively developed? The full list from the audit is below. Only clone repos you're working on — the rest stay remote-only on GitHub.

```powershell
cd D:\dev

# Candidate repos (user to confirm which ones):
git clone https://github.com/praeducer/paulprae-com.git
git clone https://github.com/praeducer/financial-assistant-for-families.git
git clone https://github.com/praeducer/job-finding-assistant.git
git clone https://github.com/praeducer/multi-agent-ai-development-framework.git
git clone https://github.com/praeducer/notion-website-developer.git
git clone https://github.com/praeducer/small-business-consultant.git
git clone https://github.com/praeducer/AI-Data-Engineering-Toolkit.git
git clone https://github.com/praeducer/pgp.git
```

**Claude action:** After cloning, verify each repo with `git status`. Set up any needed `.env.local` files or project-specific config.

---

## Step 4: Consolidate WSL repos

**Requires:** WSL running, user's active WSL work session complete

```bash
# Inside WSL
mv ~/workspace/career-coach ~/dev/
mv ~/workspace/data-science-stack ~/dev/
mv ~/workspace/my-local-ai-env ~/dev/
rmdir ~/workspace
```

**Claude action:** Verify moves, confirm `~/workspace` is gone, confirm all repos in `~/dev/` have clean `git status`.

---

## Step 5: Clean up cloud drive repos

**Requires:** Steps 3-4 complete (repos safely on Dev Drive / WSL ~/dev)
**Human decision needed:** Confirm all repos are pushed to GitHub before deleting local copies.

### OneDrive — `C:\Users\<username>\OneDrive\Documents\GitHub\` (7 repos)
- AI-Data-Engineering-Toolkit, financial-assistant-for-families, job-finding-assistant
- multi-agent-ai-development-framework, notion-website-developer, pgp, small-business-consultant

### iCloudDrive — `C:\Users\<username>\iCloudDrive\Documents\GitHub\` (10 repos)
- AI-architecture-assistant, AI-engineering-assistant, awesome-mlops, financial-assistant-for-families
- job-finding-assistant, Made-With-ML, mistral-on-aws, mlops-coding-course, mlops-zoomcamp, pgp

**Action:** Delete these local copies. They are duplicates synced via cloud storage and risk `.git` corruption.

### iCloudDrive workspace — `C:\Users\<username>\iCloudDrive\workspace\` (20 old company repos)
- Decooda (5), Innowatts (1), NL (12), trendscenter (2)

**Action:** Keep as-is in iCloud. User may not have GitHub access to these orgs anymore.

**Claude action:** Before deleting, verify each repo has no unpushed commits (`git log --oneline @{u}..HEAD`). After cleanup, confirm the cloud folders are empty or contain only non-git files.

---

## Step 6: Commit environment changes to paulprae-com

**Requires:** Steps 1-5 complete (or at minimum the repo is on Dev Drive)

### Changes from this session (environment audit agent):
- `.gitignore` — added `*.local.md` pattern
- `docs/windows-dev-environment-setup.md` — desktop specs, .wslconfig section, decisions log, security hardening

### Changes from other agents (also uncommitted on main):
- CLAUDE.md, README.md, technical-design-document.md, lib/config.ts, package.json
- scripts/setup/install-dev-tools.ps1, scripts/setup/README.md
- New files: scripts/export-resume.ts, scripts/setup/install-pipeline-deps.sh, templates/

**Claude action:** Run `git status` and `git diff --stat` to inventory all changes. Group into logical commits. Suggest commit messages for user approval. Do NOT commit without explicit user confirmation.

---

## Verification Checklist

After all steps, confirm:

- [ ] `.wslconfig` applied — WSL shows bounded memory/CPUs
- [ ] Active repos live on `D:\dev\` (Windows) or `~/dev/` (WSL)
- [ ] No git repos in OneDrive or iCloudDrive (except old company archives)
- [ ] `~/workspace` directory removed from WSL
- [ ] `npm config get cache` returns `D:\packages\npm`
- [ ] `pip cache dir` returns `D:\packages\pip`
- [ ] All environment changes committed to paulprae-com
- [ ] `machine-inventory.local.md` updated with final state
