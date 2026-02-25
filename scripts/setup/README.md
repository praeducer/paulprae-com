# Setup Scripts

Windows-specific automation scripts for setting up the development environment. These are thin convenience wrappers around standard tools — see each script's header comments for links to the authoritative documentation.

For the full setup guide, see [`docs/windows-dev-environment-setup.md`](../../docs/windows-dev-environment-setup.md).
For project installation (npm install, env vars, running the app), see the [project README](../../README.md).

## Scripts

| Script | What it does | When to run |
|---|---|---|
| `install-dev-tools.ps1` | Installs Git, Node.js, VS Code, GitHub CLI, Vercel CLI, Claude Code via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) and npm | Fresh machine, before anything else |
| `setup-dev-drive.ps1` | Creates `D:\dev` and `D:\packages\*` directories, redirects package caches, configures [Dev Drive filters](https://learn.microsoft.com/en-us/windows/dev-drive/#filters-for-common-scenarios) | After creating Dev Drive via Windows Settings |

## Usage

```powershell
# 1. Install tools (Admin PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\setup\install-dev-tools.ps1

# 2. Create Dev Drive via Windows Settings (manual step — see docs)

# 3. Configure Dev Drive (Admin PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\setup\setup-dev-drive.ps1
```
