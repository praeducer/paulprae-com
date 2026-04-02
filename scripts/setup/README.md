# Setup Scripts

Automation scripts for setting up the development environment. These are thin convenience wrappers around standard tools — see each script's header comments for links to the authoritative documentation.

For the full setup guides, see:

- **Windows:** [`docs/windows-dev-environment-setup.md`](../../docs/windows-dev-environment-setup.md)
- **Linux / WSL:** [`docs/linux-dev-environment-setup.md`](../../docs/linux-dev-environment-setup.md)

For project installation (npm install, env vars, running the app), see the [project README](../../README.md).

## Scripts

| Script                            | Platform        | What it does                                                                                                                                                                                                       | When to run                                   |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `install-dev-tools.ps1`           | Windows         | Installs Git, Node.js, VS Code, GitHub CLI, Pandoc, Typst, Vercel CLI, Claude Code via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) and npm                                         | Fresh Windows machine, before anything else   |
| `setup-dev-drive.ps1`             | Windows         | Creates `D:\dev` and `D:\packages\*` directories, redirects package caches, configures [Dev Drive filters](https://learn.microsoft.com/en-us/windows/dev-drive/#filters-for-common-scenarios)                      | After creating Dev Drive via Windows Settings |
| `setup-git-config.sh`             | Linux/macOS/WSL | Configures Git for cross-platform consistency (autocrlf, longpaths, rebase, push)                                                                                                                                  | After Git installation                        |
| `setup-git-config.ps1`            | Windows         | Same as `setup-git-config.sh` for Windows (PowerShell)                                                                                                                                                             | After Git installation                        |
| `ensure-wsl-paths.ps1`            | Windows         | Verifies WSL paths are optimized (no slow /mnt/c usage)                                                                                                                                                            | After WSL setup, periodic check               |
| `setup-vscode-global-settings.sh` | Linux/WSL       | Applies recommended global VS Code settings (work in progress - manual merge recommended)                                                                                                                          | After VS Code installation                    |
| `install-pipeline-deps.sh`        | Linux/macOS/WSL | Installs pandoc, typst, Node.js (via nvm), npm dependencies, Claude Code CLI, Claude Code settings, and (on WSL) Cursor wrapper. Runs shell health checks. Prompts before running remote bootstrap script for nvm. | Fresh Linux/WSL machine, or after cloning     |
| `install-mcp.sh`                  | Linux/macOS/WSL | Writes `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor) from `mcp-servers.json`. Idempotent.                                                                                                              | After clone; repeat to refresh MCP config     |
| `install-mcp.ps1`                 | Windows         | Same as `install-mcp.sh` for Windows (PowerShell).                                                                                                                                                                 | After clone; repeat to refresh MCP config     |
| `onboard.sh`                      | Linux/macOS/WSL | Runs full project setup: npm install, Git hooks, data pipeline, tests, build, and final checks                                                                                                                     | After cloning, for new developers             |

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

# 4. Configure Git (regular PowerShell)
powershell -NoProfile -File scripts\setup\setup-git-config.ps1

# 5. Verify WSL paths (regular PowerShell)
powershell -NoProfile -File scripts\setup\ensure-wsl-paths.ps1
```

If script execution is blocked by policy:

```powershell
# Temporary process-only relaxation (safer than machine-wide changes)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
powershell -NoProfile -File scripts\setup\install-dev-tools.ps1
```

### Linux / WSL / macOS (Bash)

```bash
# Git configuration
bash scripts/setup/setup-git-config.sh

# Pipeline and dev tools (if install-pipeline-deps.sh is present)
bash scripts/setup/install-pipeline-deps.sh

# MCP config for Claude Code and Cursor
bash scripts/setup/install-mcp.sh

# Full project onboarding (after cloning)
bash scripts/setup/onboard.sh
```

### MCP only (any platform)

After cloning, to install or refresh MCP config (Vercel, GitHub, Filesystem, Fetch):

```bash
# Linux / WSL / macOS
bash scripts/setup/install-mcp.sh
```

```powershell
# Windows
powershell -NoProfile -File scripts\setup\install-mcp.ps1
```

See [docs/mcp-setup.md](../../docs/mcp-setup.md) for details.
