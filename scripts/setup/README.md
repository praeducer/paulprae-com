# Setup Scripts

Automation scripts for setting up the development environment. These are thin convenience wrappers around standard tools — see each script's header comments for links to the authoritative documentation.

For the full setup guides, see:

- **Windows:** [`docs/windows-dev-environment-setup.md`](../../docs/windows-dev-environment-setup.md)
- **Linux / WSL:** [`docs/linux-dev-environment-setup.md`](../../docs/linux-dev-environment-setup.md)

For project installation (npm install, env vars, running the app), see the [project README](../../README.md).

## Scripts

| Script                     | Platform        | What it does                                                                                                                                                                                                       | When to run                                   |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `install-dev-tools.ps1`    | Windows         | Installs Git, Node.js, VS Code, GitHub CLI, Pandoc, Typst, Vercel CLI, Claude Code via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) and npm                                         | Fresh Windows machine, before anything else   |
| `setup-dev-drive.ps1`      | Windows         | Creates `D:\dev` and `D:\packages\*` directories, redirects package caches, configures [Dev Drive filters](https://learn.microsoft.com/en-us/windows/dev-drive/#filters-for-common-scenarios)                      | After creating Dev Drive via Windows Settings |
| `install-pipeline-deps.sh` | Linux/macOS/WSL | Installs pandoc, typst, Node.js (via nvm), npm dependencies, Claude Code CLI, Claude Code settings, and (on WSL) Cursor wrapper. Runs shell health checks. Prompts before running remote bootstrap script for nvm. | Fresh Linux/WSL machine, or after cloning     |

## Usage

### Security Defaults

- Run with least privilege: only `setup-dev-drive.ps1` requires Administrator.
- Run trusted local scripts from this repository only.
- Avoid persistent policy changes; do not set machine-wide execution policy just to run these scripts.

### Windows (PowerShell)

```powershell
# 1. Install tools (regular PowerShell)
powershell -NoProfile -File scripts\setup\install-dev-tools.ps1

# 2. Create Dev Drive via Windows Settings (manual step — see docs)

# 3. Configure Dev Drive (Admin PowerShell)
powershell -NoProfile -File scripts\setup\setup-dev-drive.ps1
```

If script execution is blocked by policy:

```powershell
# Temporary process-only relaxation (safer than machine-wide changes)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
powershell -NoProfile -File scripts\setup\install-dev-tools.ps1
```

### Linux / WSL / macOS (Bash)

```bash
bash scripts/setup/install-pipeline-deps.sh
```
