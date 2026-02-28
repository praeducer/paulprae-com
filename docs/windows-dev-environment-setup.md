# Windows Development Environment Setup Guide

> **Purpose:** Windows-specific environment setup for developing paulprae.com and related projects. Covers Dev Drive, filesystem layout, security guardrails, and cross-machine parity. For project installation, dependencies, and running the app, see the [project README](../README.md).
>
> **Last updated:** 2026-02-28
> **Applies to:** All development machines (laptop + desktop)

---

## Table of Contents

1. [Machine Inventory](#1-machine-inventory)
2. [System Requirements](#2-system-requirements)
3. [Filesystem Layout](#3-filesystem-layout)
4. [Dev Drive Setup](#4-dev-drive-setup)
5. [WSL Setup](#5-wsl-setup)
6. [Windows Dev Tools](#6-windows-dev-tools)
7. [Package Cache Optimization](#7-package-cache-optimization)
8. [Cross-Machine Parity](#8-cross-machine-parity)
9. [Decisions Log](#9-decisions-log)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Machine Inventory

Track all development machines here to maintain parity. See [Cross-Machine Parity](#8-cross-machine-parity) for what must match.

### Laptop (Primary)

| Spec | Detail |
|---|---|
| **Machine** | ASUS ROG Strix SCAR 18 (G835LX) |
| **CPU** | Intel Core Ultra 9 275HX (24 cores / 24 threads) |
| **RAM** | 32 GB |
| **GPU** | NVIDIA RTX 5090 Laptop + Intel integrated |
| **Storage** | 2 TB NVMe |
| **OS** | Windows 11 Pro 24H2 |
| **WSL** | WSL2, Ubuntu |
| **Dev Drive** | D: — 250 GB VHDX (dynamically expanding), ReFS, labeled "DevDrive" |
| **Setup date** | 2025-02-25 |
| **Setup status** | In progress |

### Desktop

| Spec | Detail |
|---|---|
| **Machine** | Alienware Aurora 16 Desktop |
| **CPU** | Intel Core i9-14900KF (24 cores / 32 threads) |
| **RAM** | 64 GB |
| **GPU** | NVIDIA RTX 4090 (24 GB VRAM) |
| **Storage** | ~1.89 TB NVMe |
| **OS** | Windows 11 Pro for Workstations |
| **WSL** | WSL2, Ubuntu 24.04 LTS |
| **Dev Drive** | D: — 250 GB VHDX (dynamically expanding), ReFS, labeled "DevDrive" |
| **Additional software** | CUDA Toolkit, NVIDIA Container Toolkit, Docker Desktop, Neo4j Desktop, Ollama, Open WebUI |
| **Related repo** | [my-local-ai-env](https://github.com/praeducer/my-local-ai-env) — local AI stack (separate from paulprae-com) |
| **Setup date** | 2026-02-27 |
| **Setup status** | In progress — Dev Drive created, WSL configured, git config set |

> **Machine-specific details** (hostnames, usernames, OS build numbers, exact versions) are stored locally in `machine-inventory.local.md` (gitignored). See [Cross-Machine Parity](#8-cross-machine-parity).

> **Note:** The desktop has a heavier AI/ML stack (CUDA, Docker, Ollama, Neo4j) documented in [my-local-ai-env](https://github.com/praeducer/my-local-ai-env). That repo covers the WSL/Docker/GPU side. This guide covers only the Windows Dev Drive and tooling setup relevant to paulprae-com.

---

## 2. System Requirements

See the [official Dev Drive prerequisites](https://learn.microsoft.com/en-us/windows/dev-drive/#prerequisites):

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Windows 11 Build 22621.2338+ | 24H2+ (for [block cloning](https://learn.microsoft.com/en-us/windows-server/storage/refs/block-cloning)) |
| RAM | 8 GB | 16+ GB |
| Free disk space | 50 GB (Dev Drive minimum) | 100+ GB |

Verify:

```powershell
[System.Environment]::OSVersion.Version
(Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB
Get-Volume -DriveLetter C | Select-Object @{N="FreeGB";E={[math]::Round($_.SizeRemaining/1GB,1)}}
```

---

## 3. Filesystem Layout

| Location | Purpose | Filesystem | Why |
|---|---|---|---|
| `C:\` | OS, installed applications, dev tools | NTFS | [MS recommends tools stay on C:](https://learn.microsoft.com/en-us/windows/dev-drive/#what-should-i-put-on-my-dev-drive) |
| `D:\dev\` | Source repos, project files | ReFS (Dev Drive) | [Performance mode](https://learn.microsoft.com/en-us/microsoft-365/security/defender-endpoint/microsoft-defender-endpoint-antivirus-performance-mode), async Defender scans, block cloning |
| `D:\packages\` | Package caches (npm, pip, etc.) | ReFS (Dev Drive) | [Recommended by MS](https://learn.microsoft.com/en-us/windows/dev-drive/#storing-package-cache-on-dev-drive) for biggest I/O win |
| `C:\dev\` | Temporary workspace (pre-Dev Drive) | NTFS | Fallback; short path, no spaces |
| `~/dev` (WSL) | Linux-native projects | ext4 | [WSL does not benefit from Dev Drive](https://learn.microsoft.com/en-us/windows/dev-drive/#does-dev-drive-work-with-wsl-project-files) |

### Key Principles

- **Projects live where their tools run.** Node.js/Windows projects on Dev Drive. Docker/Python projects in WSL ext4.
- **Never cross filesystems for heavy I/O.** `/mnt/c` from WSL and `\\wsl$\` from Windows both add significant overhead.
- **Short root paths.** `D:\dev` avoids Windows 260-char path limits (deep `node_modules`).
- **Least privilege by default.** Use Administrator only for system-level changes (Dev Drive, registry, machine policies).
- **Use trusted local scripts only.** Run scripts from this repo; avoid copy-pasting commands from unknown sources.

### Initial Setup

```powershell
# Windows PowerShell — temporary workspace before Dev Drive
New-Item -ItemType Directory -Force -Path C:\dev | Out-Null
```

```bash
# WSL/Ubuntu
mkdir -p ~/dev
```

If you use Git Bash on Windows, equivalent command is `mkdir -p /c/dev`.

After Dev Drive exists, move repos to `D:\dev\` (see [section 4](#4-dev-drive-setup)).

---

## 4. Dev Drive Setup

> **Reference:** [Set up a Dev Drive on Windows 11](https://learn.microsoft.com/en-us/windows/dev-drive/) — full MS documentation.

### What Dev Drive Gives You

| Benefit | Impact | MS Docs |
|---|---|---|
| **Defender Performance Mode** | Antivirus scans run async instead of blocking every file I/O | [Performance mode](https://learn.microsoft.com/en-us/microsoft-365/security/defender-endpoint/microsoft-defender-endpoint-antivirus-performance-mode) |
| **Block Cloning (24H2+)** | File copies become metadata operations | [Block cloning on ReFS](https://learn.microsoft.com/en-us/windows-server/storage/refs/block-cloning) |
| **ReFS** | Resilient to corruption from unexpected power loss | [ReFS overview](https://learn.microsoft.com/en-us/windows-server/storage/refs/refs-overview) |
| **Filter Control** | Choose which filesystem filters attach | [Filter configuration](https://learn.microsoft.com/en-us/windows/dev-drive/#how-do-i-configure-additional-filters-on-dev-drive) |

### Step-by-Step: Windows Settings Wizard

1. Open **Settings > System > Storage > Advanced Storage Settings > Disks & volumes**
2. Click **Create dev drive**
3. Choose **Create new VHD**

Use these values on **all machines** for parity:

| Field | Value | Rationale |
|---|---|---|
| **Virtual hard disk name** | `DevDrive` | Shows in Disk Management |
| **Location** | `C:\Users\<username>\` | [Per-user path recommended by MS](https://learn.microsoft.com/en-us/windows/dev-drive/#create-new-vhd) to avoid unintentional sharing |
| **Virtual hard disk size** | `250 GB` | Multiple repos + node_modules + package caches. Dynamically expanding — only consumes actual space used |
| **Virtual hard disk format** | `VHDX` | [MS recommended](https://learn.microsoft.com/en-us/windows/dev-drive/#create-new-vhd) — up to 64 TB, resilient to I/O failure |
| **Disk type** | `Dynamically expanding` | [MS recommended](https://learn.microsoft.com/en-us/windows/dev-drive/#create-new-vhd) — no wasted space |

4. Format as Dev Drive when prompted. Assign drive letter **D:** and label **DevDrive**.

> **Parity note:** Identical settings on all machines. Only the VHD file path differs by username.

### Why VHD Instead of Partition

See [MS docs: How to choose between using a disk partition or VHD](https://learn.microsoft.com/en-us/windows/dev-drive/#how-to-choose-between-using-a-disk-partition-or-vhd). We chose VHD (VHDX) because:
- **Safer:** No partition resize risk on a production machine
- **Reproducible:** Same wizard values work on any machine
- **Flexible:** Easy to resize, back up, or delete
- **Trade-off accepted:** Slight virtual disk overhead, negligible on NVMe

### Post-Setup: Verify and Configure

```powershell
# Admin PowerShell

# 1. Verify
fsutil devdrv query D:
# Expected: "This is a trusted Dev Drive"

# 2. Trust (if needed — should be automatic on fresh create)
fsutil devdrv trust D:

# 3. Allow common dev filters (Docker, monitoring)
# See: https://learn.microsoft.com/en-us/windows/dev-drive/#filters-for-common-scenarios
fsutil devdrv setFiltersAllowed /volume D: "PrjFlt, MsSecFlt, WdFilter, bindFlt, wcifs, FileInfo"
```

### Create Directory Structure

```powershell
mkdir D:\dev
mkdir D:\packages\npm
mkdir D:\packages\pip
```

Or run the automated script:

```powershell
# Admin PowerShell
powershell -NoProfile -File scripts\setup\setup-dev-drive.ps1
```

### Move Repos to Dev Drive

```powershell
robocopy C:\dev\paulprae-com D:\dev\paulprae-com /E /MOVE
cd D:\dev\paulprae-com
git status   # verify
```

### Auto-Mount on Reboot

VHDX-based Dev Drives [auto-mount on startup](https://learn.microsoft.com/en-us/windows/dev-drive/#how-to-set-up-a-dev-drive). If not:

```powershell
Mount-VHD -Path "C:\Users\<username>\DevDrive.vhdx"
```

---

## 5. WSL Setup

> **Reference:** [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

paulprae-com does **not** require WSL (pure Node.js/TypeScript, Vercel deploy). However, WSL is strongly recommended for using Claude Code CLI (which uses Linux sandboxing) and for other projects (Docker, Python ML, etc.). The desktop's AI/ML stack is documented in [my-local-ai-env](https://github.com/praeducer/my-local-ai-env).

### 5.1 Install / Update WSL

```powershell
# Install (if needed)
wsl --install -d Ubuntu

# Verify
wsl --version
```

```bash
# Inside WSL
mkdir -p ~/dev
```

#### Update the WSL Kernel

Claude Code's sandbox requires kernel ≥ 6.2 for [Landlock v3](https://docs.kernel.org/userspace-api/landlock.html) support. WSL's default kernel (5.15) is too old. Update from an **Admin PowerShell**:

```powershell
wsl --update
wsl --shutdown
```

Then reopen Ubuntu and verify:

```bash
uname -r
# Expected: 6.x.x or higher
```

### 5.2 Performance Tuning (.wslconfig)

Create `C:\Users\<username>\.wslconfig` to [control WSL2 resource limits](https://learn.microsoft.com/en-us/windows/wsl/wsl-config). Without this, WSL defaults to 50% of RAM and all processors.

```ini
# C:\Users\<username>\.wslconfig
[wsl2]
memory=32GB          # Cap at half of 64GB — leaves room for Windows + IDE
processors=12        # 12 of 32 logical CPUs
swap=16GB
networkingMode=mirrored   # WSL shares Windows network stack
dnsTunneling=true
firewall=true
autoProxy=true

[experimental]
autoMemoryReclaim=gradual   # Slowly return unused memory to Windows
sparseVhd=true              # Reclaim disk space from deleted WSL files
```

> After changes: `wsl --shutdown`, wait ~8 seconds, then relaunch. See [MS docs: .wslconfig settings](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#wslconfig).

### 5.3 Linux Environment Setup

For shell configuration, Node.js, Claude Code CLI, Cursor, and pipeline dependencies **inside WSL**, follow the **[Linux Dev Environment Setup Guide](linux-dev-environment-setup.md)**.

That guide covers:
- Shell health checks (PATH corruption, nvm loading, cargo env guards)
- Node.js installation via nvm
- Pipeline dependencies (pandoc, typst)
- Claude Code CLI installation and settings
- Cursor wrapper script for WSL
- Verification checklist and troubleshooting

Or run the automated setup script from inside WSL:

```bash
bash scripts/setup/install-pipeline-deps.sh
```

### 5.4 Claude Code Settings Sync

Windows and WSL maintain **separate** Claude Code settings files:

| Platform | Settings Path |
|---|---|
| Windows | `C:\Users\<username>\.claude\settings.json` |
| WSL | `~/.claude/settings.json` |

Keep both in sync manually. The WSL copy should omit Windows-specific entries like `additionalDirectories` (which use Windows paths). See the [Linux guide's Claude Code section](linux-dev-environment-setup.md#6-claude-code-cli) for the canonical permission set.

### 5.5 When to Use WSL vs Windows (Dev Drive)

| Use WSL (`~/dev`) | Use Windows (`D:\dev`) |
|---|---|
| Docker-based projects | Node.js / Next.js (e.g., paulprae-com) |
| Python ML/AI (CUDA, PyTorch) | .NET / C# projects |
| Linux-specific toolchains | Vercel-deployed projects |
| Claude Code CLI (sandboxed) | Quick edits via Cursor on Windows |

---

## 6. Windows Dev Tools

Install tools on `C:\` using [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) (Microsoft's official package manager). See each tool's docs for configuration:

| Tool | Install Command | Docs |
|---|---|---|
| **Git** | `winget install --id Git.Git --exact` | [git-scm.com](https://git-scm.com/doc) |
| **Node.js LTS** | `winget install --id OpenJS.NodeJS.LTS --exact` | [nodejs.org](https://nodejs.org/en/download/) |
| **VS Code** | `winget install --id Microsoft.VisualStudioCode --exact` | [code.visualstudio.com](https://code.visualstudio.com/docs) |
| **GitHub CLI** | `winget install --id GitHub.cli --exact` | [cli.github.com](https://cli.github.com/manual/) |
| **Pandoc** | `winget install --id JohnMacFarlane.Pandoc --exact` | [pandoc.org](https://pandoc.org/installing.html) |
| **Typst** | `winget install --id Typst.Typst --exact` | [typst.app](https://github.com/typst/typst) |

After Node.js is installed (restart terminal first):

| Tool | Install Command | Docs |
|---|---|---|
| **Vercel CLI** | `npm install -g vercel` | [vercel.com/docs/cli](https://vercel.com/docs/cli) |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |

Or run the convenience script which installs all of the above idempotently:

```powershell
# Regular PowerShell (do not run elevated)
powershell -NoProfile -File scripts\setup\install-dev-tools.ps1
```

### Git Configuration (Windows-specific)

These settings are Windows-specific. See [Git on Windows](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup) for full docs.

```bash
git config --global core.autocrlf true      # Normalize line endings for Windows
git config --global core.longpaths true      # Required for deep node_modules paths
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global push.autoSetupRemote true
```

### VS Code Extensions (Recommended for This Project)

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
```

---

## 7. Package Cache Optimization

After creating Dev Drive, redirect package caches per [MS recommendations](https://learn.microsoft.com/en-us/windows/dev-drive/#storing-package-cache-on-dev-drive):

### npm Cache

```powershell
# Regular PowerShell (user scope; least privilege)
setx npm_config_cache D:\packages\npm

# Move existing cache (if any)
robocopy "%AppData%\npm-cache" D:\packages\npm /E /MOVE

# Verify (restart terminal first)
npm config get cache
```

> See [npm docs: cache](https://docs.npmjs.com/cli/v10/commands/npm-cache) for details.

### pip Cache (for Python projects)

```powershell
setx PIP_CACHE_DIR D:\packages\pip
```

> See [pip docs: caching](https://pip.pypa.io/en/stable/topics/caching/) for details.

Or run the automated script which handles all of this:

```powershell
# Admin PowerShell
powershell -NoProfile -File scripts\setup\setup-dev-drive.ps1
```

---

## 8. Cross-Machine Parity

### What Must Match

| Setting | Value | Enforced by |
|---|---|---|
| Dev Drive letter | `D:` | Wizard (section 4) |
| Dev Drive config | 250 GB VHDX, dynamically expanding, ReFS | Wizard (section 4) |
| Directory structure | `D:\dev\`, `D:\packages\npm\`, `D:\packages\pip\` | `setup-dev-drive.ps1` |
| Git config | autocrlf, longpaths, default branch | Commands in section 6 |
| npm cache location | `D:\packages\npm` (user env var) | `setup-dev-drive.ps1` |
| Node.js major version | Same LTS across machines | `node --version` |
| WSL distro | Ubuntu with `~/dev` | `wsl --install -d Ubuntu` |
| .wslconfig | Same resource limits (adjusted per machine RAM) | Manual (section 5) |
| .env.local contents | Same API keys | Manual — use a password manager |

### What Can Differ

VHD file path (varies by Windows username), computer name, hardware specs, additional software (desktop has CUDA/Docker stack, laptop does not).

### New Machine Quick Reference

1. `git clone https://github.com/praeducer/paulprae-com.git C:\dev\paulprae-com`
2. Run `scripts\setup\install-dev-tools.ps1` (regular PowerShell)
3. Restart terminal, run git config commands from section 6
4. Create Dev Drive via Settings wizard (section 4 values)
5. Run `scripts\setup\setup-dev-drive.ps1` (admin PowerShell)
6. `robocopy C:\dev\paulprae-com D:\dev\paulprae-com /E /MOVE`
7. Follow [project README](../README.md) for `npm install`, `.env.local`, and first run
8. `wsl -e bash -c 'mkdir -p ~/dev'`
9. Create `.wslconfig` per section 5, then `wsl --shutdown`
10. Update Machine Inventory (section 1) and commit

### Keeping Machines in Sync

- **Code:** Push/pull via GitHub. Never transfer directly.
- **Secrets (.env.local):** Password manager. Copy manually per machine.
- **Tool versions:** Periodically verify `node --version`, `git --version` match.
- **This guide:** Commit environment changes here so the other machine can replicate.
- **Privilege model:** Regular shell for tooling/tasks; admin shell only for Dev Drive and other machine-level changes.

---

## 9. Decisions Log

### 2025-02-25: Filesystem Layout

**Decision:** Three-tier: `C:\` for tools, `D:\dev` (Dev Drive) for Windows projects, `~/dev` (WSL) for Linux projects.

**Rationale:** Dev Drive gives ReFS perf mode + block cloning on 24H2. WSL ext4 is already optimal for Linux. [MS confirms WSL doesn't benefit from Dev Drive](https://learn.microsoft.com/en-us/windows/dev-drive/#does-dev-drive-work-with-wsl-project-files). Short root paths avoid 260-char limit.

### 2025-02-25: paulprae-com on Windows (Not WSL)

**Decision:** Develop on Windows filesystem (Dev Drive).

**Rationale:** Pure Node.js/TypeScript with Vercel deploy. No Docker, WSL, or Python required per [technical design doc](technical-design-document.md).

### 2025-02-25: Dev Drive as VHDX (Not Partition)

**Decision:** 250 GB VHDX (dynamically expanding) instead of resizing C: partition.

**Rationale:** Safer (no partition resize risk), reproducible across machines, flexible. Overhead negligible on NVMe. See [MS docs on VHD vs partition](https://learn.microsoft.com/en-us/windows/dev-drive/#how-to-choose-between-using-a-disk-partition-or-vhd).

**Standard wizard values:** Name `DevDrive`, Location `C:\Users\<username>\`, 250 GB, VHDX, Dynamically expanding, Drive letter `D:`.

### 2026-02-27: WSL .wslconfig Added

**Decision:** Create `.wslconfig` on all machines with bounded memory (half of system RAM), 12 processors, mirrored networking, and experimental memory reclamation.

**Rationale:** Without `.wslconfig`, WSL defaults to 50% RAM and all CPUs with no memory reclamation. Mirrored networking simplifies localhost access between Windows and WSL. `autoMemoryReclaim=gradual` prevents the Vmmem process from hogging memory after WSL workloads complete. See [MS docs: .wslconfig](https://learn.microsoft.com/en-us/windows/wsl/wsl-config).

### 2026-02-28: WSL Kernel ≥ 6.2 Required for Claude Code Sandbox

**Decision:** Require WSL kernel ≥ 6.2 and document the `wsl --update` step in the setup guide.

**Rationale:** Claude Code's sandbox relies on Linux [Landlock v3](https://docs.kernel.org/userspace-api/landlock.html), available from kernel 6.2+. WSL's default kernel (5.15) is too old — Claude Code falls back to unsandboxed execution with a warning. Running `wsl --update` from an Admin PowerShell upgrades the kernel (e.g., to 6.6.x). This is a one-time step per machine.

### 2026-02-27: Git Repos Must Not Live in Cloud-Synced Folders

**Decision:** Never store git repositories in OneDrive, iCloudDrive, or other cloud-synced directories.

**Rationale:** Cloud sync services cause `.git` directory corruption from file-locking race conditions, bloat cloud storage with `node_modules` and `.git/objects`, and create phantom merge conflicts. All repos should live on Dev Drive (`D:\dev\`) or WSL (`~/dev/`) and sync exclusively through GitHub.

---

## 10. Troubleshooting

### `npm install` fails with EPERM or long path errors

```bash
git config --global core.longpaths true
```

```powershell
# Enable Win32 long paths (admin PowerShell)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

> See [MS docs: Maximum path length limitation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation)

### Dev Drive not showing as trusted

```powershell
fsutil devdrv trust D:
fsutil devdrv query D:
```

> See [MS docs: How do I designate a Dev Drive as trusted?](https://learn.microsoft.com/en-us/windows/dev-drive/#how-do-i-designate-a-dev-drive-as-trusted)

### Cross-filesystem performance is slow

You're crossing filesystems. Move the project to where its tools run. See [Filesystem Layout](#3-filesystem-layout).

### Node.js not found after install

Restart terminal. If using nvm-windows: `nvm use lts`. See [nvm-windows](https://github.com/coreybutler/nvm-windows).

### Dev Drive not mounted after reboot

```powershell
Mount-VHD -Path "C:\Users\<username>\DevDrive.vhdx"
```

> See [MS docs: Manage virtual hard disks](https://learn.microsoft.com/en-us/windows-server/storage/disk-management/manage-virtual-hard-disks)

### Claude Code sandbox warning in WSL

**Symptom:** Claude Code prints "Sandbox is available on macOS (>v2.0) and Linux (>= v6.2)."

**Cause:** WSL kernel is below 6.2 (default is 5.15).

**Fix:** From Admin PowerShell: `wsl --update` then `wsl --shutdown`. See [section 5.1](#51-install--update-wsl).

### `claude` in WSL resolves to wrong binary

**Symptom:** `which claude` shows `/mnt/c/Users/.../npm/claude` instead of `~/.nvm/.../bin/claude`.

**Cause:** A hardcoded `export PATH=` line in `~/.bashrc` (often with Windows/MINGW paths) overwrites PATH after nvm loads.

**Fix:** Find and remove the offending line: `grep -n 'export PATH=' ~/.bashrc`. See [Linux guide troubleshooting](linux-dev-environment-setup.md#10-troubleshooting).

### `cursor: command not found` in Ubuntu terminal

**Symptom:** `cursor` works in the Cursor integrated terminal but not in the native Ubuntu terminal app.

**Cause:** Native Ubuntu terminal doesn't inherit Windows PATH interop as reliably.

**Fix:** Create a wrapper script at `~/.local/bin/cursor`. See the [Linux guide's Cursor section](linux-dev-environment-setup.md#7-cursor-ide).

### `node`/`nvm` not found after opening new WSL terminal

**Symptom:** `node --version` works in one terminal but not after opening a new one.

**Cause:** A `export PATH=` line in `~/.bashrc` after the nvm block is overwriting the nvm-managed PATH.

**Fix:** Remove hardcoded PATH exports. See [Linux guide: shell health check](linux-dev-environment-setup.md#3-shell-configuration-health-check).

### `.cargo/env: No such file or directory` on shell startup

**Symptom:** Error when opening a new terminal: `. "$HOME/.cargo/env": No such file or directory`.

**Cause:** `~/.bashrc` unconditionally sources cargo's env file, but Rust/cargo isn't installed.

**Fix:** Replace `. "$HOME/.cargo/env"` with `[ -s "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"` in `~/.bashrc`.
