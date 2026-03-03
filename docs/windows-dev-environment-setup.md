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
winget install --id koalaman.shellcheck --exact
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

## 7. Git GUI Tools

### GitHub Desktop

Install from [desktop.github.com](https://desktop.github.com/) or via winget:

```powershell
winget install --id GitHub.GitHubDesktop --exact
```

GitHub Desktop uses its own bundled Git (MINGW bash) which does **not** have access to WSL-installed Node.js or `npx`. The project's husky pre-commit hook handles this automatically — when `npx` is not available, the hook delegates to WSL via `wsl.exe`, converting the UNC path to a WSL-native path.

No additional configuration is needed for GitHub Desktop to work with pre-commit hooks on this project.

### VS Code Source Control

VS Code's built-in Git also uses the Windows Git installation. The same WSL delegation in the pre-commit hook applies here. Ensure Git for Windows is installed (§5) and the repo is opened via the WSL filesystem path (`\\wsl.localhost\Ubuntu\...`).

## 8. Optional WSL Setup

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

## 9. Package Cache Optimization

Set npm and pip caches to Dev Drive:

```powershell
setx npm_config_cache D:\packages\npm
setx PIP_CACHE_DIR D:\packages\pip
```

Restart terminal sessions after `setx`.

## 10. Project Bootstrap

```powershell
git clone https://github.com/praeducer/paulprae-com.git D:\dev\paulprae-com
cd D:\dev\paulprae-com
npm install
```

Then follow `README.md` for `.env.local`, data inputs, and pipeline commands.

## 11. Verification Checklist

Run and confirm:

```powershell
node --version
npm --version
git --version
gh --version
pandoc --version
typst --version
shellcheck --version
```

From repo root:

```powershell
npm run lint
npm run format:check
npm test
```

## 12. Troubleshooting

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

### Pre-commit hook fails in GitHub Desktop or VS Code

The husky pre-commit hook automatically delegates to WSL when `npx` is not found. If it still fails:

1. Verify WSL is running: `wsl --status`
2. Verify Node.js in WSL: `wsl bash -lc "node --version"`
3. Ensure the repo was cloned on the WSL filesystem (`\\wsl.localhost\Ubuntu\...`), not `C:\`
4. Run the setup script in WSL to create the husky init file:
   ```bash
   bash scripts/setup/install-pipeline-deps.sh
   ```
   This creates `~/.config/husky/init.sh` which adds nvm-managed Node.js to PATH using POSIX-safe detection (required because husky runs hooks via `sh`/`dash`, not `bash`).

### Cross-filesystem performance is slow

Keep active project on its native filesystem (Windows tools on `D:\dev`, Linux tools in `~/dev`).
