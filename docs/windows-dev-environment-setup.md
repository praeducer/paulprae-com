# Windows Development Environment Setup Guide

> **Purpose:** Windows-specific environment setup for developing paulprae.com and related projects. Covers Dev Drive, filesystem layout, and cross-machine parity. For project installation, dependencies, and running the app, see the [project README](../README.md).
>
> **Last updated:** 2025-02-25
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

### Laptop: PRAI (Primary)

| Spec | Detail |
|---|---|
| **Machine** | ASUS ROG Strix SCAR 18 (G835LX) |
| **Computer Name** | PRAI |
| **CPU** | Intel Core Ultra 9 275HX (24 cores / 24 threads) |
| **RAM** | 32 GB |
| **GPU** | NVIDIA GeForce RTX 5090 Laptop GPU + Intel integrated |
| **Storage** | WD PC SN8000S NVMe 2 TB (~1.7 TB free as of 2025-02-25) |
| **OS** | Windows 11 Pro 24H2 (Build 26200.7922) |
| **WSL** | WSL 2.6.3.0, Kernel 6.6.87.2-1, Ubuntu installed |
| **WSL User** | praeducer |
| **Windows User** | paulp |
| **Dev Drive** | D: — 250 GB VHDX (dynamically expanding), ReFS, labeled "DevDrive" |
| **Setup date** | 2025-02-25 |
| **Setup status** | In progress |

### Desktop: Alienware Aurora 16

| Spec | Detail |
|---|---|
| **Machine** | Alienware Aurora 16 Desktop |
| **Computer Name** | TBD |
| **CPU** | Intel Core i9 |
| **RAM** | TBD |
| **GPU** | NVIDIA GeForce RTX 4090 (24 GB VRAM) |
| **Storage** | TBD |
| **OS** | Windows + WSL2 (Ubuntu) |
| **WSL** | WSL2, Ubuntu, Docker Desktop with WSL2 integration |
| **Dev Drive** | Replicate laptop: D: — 250 GB VHDX, dynamically expanding, ReFS |
| **Additional software** | CUDA Toolkit 12.8, NVIDIA Container Toolkit, Docker Desktop, Neo4j Desktop, Ollama, Open WebUI |
| **Related repo** | [praeducer/my-local-ai-env](https://github.com/praeducer/my-local-ai-env) — local AI stack setup (separate from paulprae-com) |
| **Setup date** | TBD |
| **Setup status** | Not started — Dev Drive setup pending |

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

### Initial Setup

```bash
# Windows (any terminal) — temporary workspace before Dev Drive
mkdir -p /c/dev

# WSL/Ubuntu
mkdir -p ~/dev
```

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
fsutil devdrv setfiltersallowed "PrjFlt, MsSecFlt, WdFilter, bindFlt, wcifs, FileInfo"
```

### Create Directory Structure

```powershell
mkdir D:\dev
mkdir D:\packages\npm
mkdir D:\packages\pip
```

Or run the automated script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup\setup-dev-drive.ps1
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

paulprae-com does **not** require WSL (pure Node.js/TypeScript, Vercel deploy). WSL is for other projects (Docker, Python ML, etc.). The desktop's AI/ML stack is documented in [my-local-ai-env](https://github.com/praeducer/my-local-ai-env).

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

### When to Use WSL vs Windows (Dev Drive)

| Use WSL (`~/dev`) | Use Windows (`D:\dev`) |
|---|---|
| Docker-based projects | Node.js / Next.js (e.g., paulprae-com) |
| Python ML/AI (CUDA, PyTorch) | .NET / C# projects |
| Linux-specific toolchains | Vercel-deployed projects |

---

## 6. Windows Dev Tools

Install tools on `C:\` using [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) (Microsoft's official package manager). See each tool's docs for configuration:

| Tool | Install Command | Docs |
|---|---|---|
| **Git** | `winget install Git.Git` | [git-scm.com](https://git-scm.com/doc) |
| **Node.js LTS** | `winget install OpenJS.NodeJS.LTS` | [nodejs.org](https://nodejs.org/en/download/) |
| **VS Code** | `winget install Microsoft.VisualStudioCode` | [code.visualstudio.com](https://code.visualstudio.com/docs) |
| **GitHub CLI** | `winget install GitHub.cli` | [cli.github.com](https://cli.github.com/manual/) |

After Node.js is installed (restart terminal first):

| Tool | Install Command | Docs |
|---|---|---|
| **Vercel CLI** | `npm install -g vercel` | [vercel.com/docs/cli](https://vercel.com/docs/cli) |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |

Or run the convenience script which installs all of the above idempotently:

```powershell
# Admin PowerShell
powershell -ExecutionPolicy Bypass -File scripts\setup\install-dev-tools.ps1
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
# Admin PowerShell
setx /M npm_config_cache D:\packages\npm

# Move existing cache (if any)
robocopy "%AppData%\npm-cache" D:\packages\npm /E /MOVE

# Verify (restart terminal first)
npm config get cache
```

> See [npm docs: cache](https://docs.npmjs.com/cli/v10/commands/npm-cache) for details.

### pip Cache (for Python projects)

```powershell
setx /M PIP_CACHE_DIR D:\packages\pip
```

> See [pip docs: caching](https://pip.pypa.io/en/stable/topics/caching/) for details.

Or run the automated script which handles all of this:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup\setup-dev-drive.ps1
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
| npm cache location | `D:\packages\npm` | `setup-dev-drive.ps1` |
| Node.js major version | Same LTS across machines | `node --version` |
| WSL distro | Ubuntu with `~/dev` | `wsl --install -d Ubuntu` |
| .env.local contents | Same API keys | Manual — use a password manager |

### What Can Differ

VHD file path (varies by Windows username), computer name, hardware specs, additional software (desktop has CUDA/Docker stack, laptop does not).

### New Machine Quick Reference

1. `git clone https://github.com/praeducer/paulprae-com.git C:\dev\paulprae-com`
2. Run `scripts\setup\install-dev-tools.ps1` (admin PowerShell)
3. Restart terminal, run git config commands from section 6
4. Create Dev Drive via Settings wizard (section 4 values)
5. Run `scripts\setup\setup-dev-drive.ps1` (admin PowerShell)
6. `robocopy C:\dev\paulprae-com D:\dev\paulprae-com /E /MOVE`
7. Follow [project README](../README.md) for `npm install`, `.env.local`, and first run
8. `wsl -e bash -c 'mkdir -p ~/dev'`
9. Update Machine Inventory (section 1) and commit

### Keeping Machines in Sync

- **Code:** Push/pull via GitHub. Never transfer directly.
- **Secrets (.env.local):** Password manager. Copy manually per machine.
- **Tool versions:** Periodically verify `node --version`, `git --version` match.
- **This guide:** Commit environment changes here so the other machine can replicate.

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
