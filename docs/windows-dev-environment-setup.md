# Windows Development Environment Setup

This guide covers Windows host setup for this repository.
It intentionally avoids machine-specific inventory and historical logs.

For project install/run instructions, use `README.md`.
For Linux-side setup in WSL, use `docs/linux-dev-environment-setup.md`.

## 1. Scope

Use this guide to:

- create a Windows Dev Drive layout for source code and caches
- install required Windows tooling
- configure optional WSL integration
- verify a clean, reproducible setup

## 2. Requirements

| Requirement     | Minimum                                 |
| --------------- | --------------------------------------- |
| OS              | Windows 11 (Dev Drive supported builds) |
| Disk free space | 50 GB+                                  |
| RAM             | 8 GB+                                   |
| PowerShell      | Available in user + admin shells        |

References:

- Dev Drive docs: <https://learn.microsoft.com/en-us/windows/dev-drive/>
- WSL docs: <https://learn.microsoft.com/en-us/windows/wsl/install>
- Winget docs: <https://learn.microsoft.com/en-us/windows/package-manager/winget/>

## 3. Filesystem Layout

Use one canonical layout:

- `C:\` -> OS and installed tools
- `D:\dev\` -> repositories
- `D:\packages\` -> package caches
- `~/dev` in WSL -> Linux-native repos

Principles:

- Keep repos on the filesystem where their tools run most often.
- Avoid heavy I/O across `/mnt/c` and `\\wsl$`.
- Prefer short root paths to reduce long-path friction.

## 4. Dev Drive Setup

1. Open Windows Settings and create a Dev Drive.
2. Assign drive letter `D:` and label `DevDrive`.
3. Create directories:

```powershell
mkdir D:\dev
mkdir D:\packages\npm
mkdir D:\packages\pip
```

4. Optional scripted setup:

```powershell
powershell -NoProfile -File scripts\setup\setup-dev-drive.ps1
```

5. Verify:

```powershell
fsutil devdrv query D:
```

## 5. Install Windows Tooling

Install base tools with winget:

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Microsoft.VisualStudioCode --exact
winget install --id GitHub.cli --exact
winget install --id JohnMacFarlane.Pandoc --exact
winget install --id Typst.Typst --exact
```

Install CLI tools via npm:

```powershell
npm install -g vercel
npm install -g @anthropic-ai/claude-code
```

Or use the idempotent script:

```powershell
powershell -NoProfile -File scripts\setup\install-dev-tools.ps1
```

## 6. Git Configuration (Windows)

```bash
git config --global core.autocrlf true
git config --global core.longpaths true
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global push.autoSetupRemote true
```

## 7. Optional WSL Setup

If using Claude Code sandboxing or Linux-native workflows:

```powershell
wsl --install -d Ubuntu
wsl --update
wsl --shutdown
```

Then in WSL:

```bash
mkdir -p ~/dev
```

Continue in `docs/linux-dev-environment-setup.md`.

## 8. Package Cache Optimization

Set npm and pip caches to Dev Drive:

```powershell
setx npm_config_cache D:\packages\npm
setx PIP_CACHE_DIR D:\packages\pip
```

Restart terminal sessions after `setx`.

## 9. Project Bootstrap

```powershell
git clone https://github.com/praeducer/paulprae-com.git D:\dev\paulprae-com
cd D:\dev\paulprae-com
npm install
```

Then follow `README.md` for `.env.local`, data inputs, and pipeline commands.

## 10. Verification Checklist

Run and confirm:

```powershell
node --version
npm --version
git --version
gh --version
pandoc --version
typst --version
```

From repo root:

```powershell
npm run lint
npm run format:check
npm test
```

## 11. Troubleshooting

### Long-path or EPERM errors

```bash
git config --global core.longpaths true
```

Enable long paths in Windows if still needed (admin shell).

### Dev Drive not trusted

```powershell
fsutil devdrv trust D:
fsutil devdrv query D:
```

### `claude` or `node` version mismatch across shells

- Restart shell sessions.
- Ensure expected binaries resolve first in PATH.
- If also using WSL, keep Windows and WSL installs separate and explicit.

### Cross-filesystem performance is slow

Keep active project on its native filesystem (Windows tools on `D:\dev`, Linux tools in `~/dev`).
