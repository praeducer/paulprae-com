# Linux / WSL Development Environment Setup Guide

> **Purpose:** Linux-specific environment setup for developing paulprae.com and related projects. Covers shell configuration, Node.js, Claude Code CLI, Cursor IDE, and pipeline dependencies. Works for both native Linux and Windows Subsystem for Linux (WSL2).
>
> **Last updated:** 2026-02-28
> **Applies to:** Ubuntu 22.04+, WSL2 with Ubuntu

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements & Kernel Check](#2-system-requirements--kernel-check)
3. [Shell Configuration Health Check](#3-shell-configuration-health-check)
4. [Node.js via nvm](#4-nodejs-via-nvm)
5. [Pipeline Dependencies (Pandoc & Typst)](#5-pipeline-dependencies-pandoc--typst)
6. [Claude Code CLI](#6-claude-code-cli)
7. [Cursor IDE](#7-cursor-ide)
8. [Project Setup](#8-project-setup)
9. [Verification Checklist](#9-verification-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

This guide is for:

- **WSL contributors** who have Windows set up per the [Windows Dev Environment Setup Guide](windows-dev-environment-setup.md) and need the Linux side configured.
- **Native Linux contributors** running Ubuntu 22.04+ on bare metal or in a VM.

Both audiences follow the same steps unless marked **(WSL only)** or **(Native Linux only)**.

### Quick Start (Automated)

If you want to skip the manual steps, the setup script handles most of this:

```bash
bash scripts/setup/install-pipeline-deps.sh
```

The script installs pandoc, typst, nvm, Node.js, npm dependencies, Claude Code CLI, and (on WSL) creates the Cursor wrapper. Read the sections below to understand what it does and to troubleshoot issues.

---

## 2. System Requirements & Kernel Check

| Requirement | Minimum | Notes |
|---|---|---|
| OS | Ubuntu 22.04+ | Other Debian-based distros should work |
| Kernel | ≥ 6.2 | Required for Claude Code sandbox ([Landlock v3](https://docs.kernel.org/userspace-api/landlock.html)) |
| RAM | 4 GB | 8+ GB recommended |
| Node.js | 20+ (LTS) | Installed via nvm (section 4) |

Check your kernel version:

```bash
uname -r
```

### WSL Kernel Update (WSL only)

WSL's default kernel (5.15) is too old for Claude Code's sandbox mode. Update from an **Admin PowerShell** on Windows:

```powershell
wsl --update
wsl --shutdown
```

Then reopen your Ubuntu terminal and verify:

```bash
uname -r
# Expected: 6.x.x or higher
```

> **Why:** Claude Code uses Linux [Landlock v3](https://docs.kernel.org/userspace-api/landlock.html) for secure sandboxing of shell commands. Landlock v3 requires kernel ≥ 6.2. Without it, Claude Code falls back to unsandboxed execution and prints a warning.

### Native Linux Kernel (Native Linux only)

Ubuntu 24.04+ ships with kernel ≥ 6.8 by default. If you're on Ubuntu 22.04, check that your kernel has been updated to ≥ 6.2 via HWE:

```bash
uname -r
# If below 6.2:
sudo apt update && sudo apt install -y linux-generic-hwe-22.04
sudo reboot
```

---

## 3. Shell Configuration Health Check

Before installing tools, verify your shell is healthy. Common issues on WSL include corrupted PATH and broken nvm loading.

### Interactive Shell Guard

Ubuntu's default `~/.bashrc` starts with:

```bash
case $- in
    *i*) ;;
    *) return;;
esac
```

This causes `~/.bashrc` to exit early in non-interactive shells (e.g., `wsl.exe -- bash -c "..."`). This is **expected behavior** — nvm and other tools loaded in `.bashrc` will only be available in interactive shells or if explicitly sourced.

### Check for PATH Corruption

Look for hardcoded `export PATH=` lines in `~/.bashrc` that may overwrite PATH after nvm loads:

```bash
grep -n 'export PATH=' ~/.bashrc
```

If you see a line with Windows/MINGW paths like `/mingw64/bin` or `/c/Users/...`, it is likely overwriting your entire PATH. Remove or comment it out — nvm sets up PATH correctly on its own.

### Guard Cargo Environment

If you have (or plan to have) Rust/cargo installed, ensure the cargo env sourcing is guarded:

```bash
# Good — won't error if cargo isn't installed:
[ -s "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# Bad — errors if cargo isn't installed:
. "$HOME/.cargo/env"
```

### Verify `~/.local/bin` on PATH

Many user-installed tools (including the Cursor wrapper) live in `~/.local/bin`. Check it's on PATH:

```bash
echo "$PATH" | tr ':' '\n' | grep local/bin
```

If not, add to `~/.profile`:

```bash
# Add to ~/.profile (if not already present):
if [ -d "$HOME/.local/bin" ] ; then
    PATH="$HOME/.local/bin:$PATH"
fi
```

---

## 4. Node.js via nvm

We use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to install and manage Node.js. This is handled automatically by `install-pipeline-deps.sh`, but here are the manual steps.

### Install nvm

```bash
# Download and run the official install script (pinned version)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Then restart your terminal or run:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### Install Node.js LTS

```bash
nvm install --lts
nvm alias default lts/*
```

### Verify

```bash
node --version    # Expected: v22.x (or current LTS)
npm --version     # Expected: 10.x+
which node        # Expected: ~/.nvm/versions/node/.../bin/node
```

> **Important (WSL):** `which node` should show a path under `~/.nvm/`, **not** `/mnt/c/...`. If it shows a Windows path, see [Troubleshooting: claude resolves to Windows binary](#claude-resolves-to-windows-binary-wsl).

---

## 5. Pipeline Dependencies (Pandoc & Typst)

The resume export pipeline uses [Pandoc](https://pandoc.org/) (Markdown → DOCX) and [Typst](https://typst.app/) (Markdown → PDF). These are optional if you only need the web resume.

### Automated Install

```bash
bash scripts/setup/install-pipeline-deps.sh
```

### Manual Install

```bash
# Pandoc
sudo apt-get update && sudo apt-get install -y pandoc

# Typst — via prebuilt binary (or cargo install typst-cli if you have Rust)
# The install script handles this automatically.
```

### Verify

```bash
pandoc --version | head -1
typst --version
```

---

## 6. Claude Code CLI

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's AI coding assistant for the terminal. It's used for development on this project.

### Install

```bash
npm install -g @anthropic-ai/claude-code
```

### Verify

```bash
which claude
# Expected: ~/.nvm/versions/node/v22.x.x/bin/claude (under nvm)
# NOT: /mnt/c/.../claude (Windows binary — see troubleshooting)

claude --version
```

### Settings File

Claude Code reads permissions from `~/.claude/settings.json`. Create it if it doesn't exist:

```bash
mkdir -p ~/.claude
```

The canonical settings for this project are:

```json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(pnpm:*)",
      "Bash(gh:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(rg:*)",
      "Bash(which:*)",
      "Bash(echo:*)",
      "Bash(pwd:*)",
      "Bash(cd:*)",
      "Bash(mkdir:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(rm:*)",
      "Bash(touch:*)",
      "Bash(chmod:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(python:*)",
      "Bash(python3:*)",
      "Bash(pip:*)",
      "Bash(pip3:*)",
      "Bash(docker:*)",
      "Bash(docker-compose:*)",
      "Bash(pandoc:*)",
      "Bash(typst:*)",
      "Bash(vercel:*)",
      "Bash(code:*)",
      "Bash(cursor:*)",
      "Bash(whoami:*)",
      "Bash(hostname:*)",
      "Bash(uname:*)",
      "Bash(df:*)",
      "Bash(du:*)",
      "Bash(env:*)",
      "Bash(printenv:*)",
      "Bash(diff:*)",
      "Bash(sort:*)",
      "Bash(uniq:*)",
      "Bash(wc:*)",
      "Bash(sed:*)",
      "Bash(awk:*)",
      "Bash(tar:*)",
      "Bash(zip:*)",
      "Bash(unzip:*)",
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch"
    ],
    "deny": []
  }
}
```

Save this to `~/.claude/settings.json`. The setup script (`install-pipeline-deps.sh`) can create this automatically.

> **WSL note:** Windows (`C:\Users\<user>\.claude\settings.json`) and WSL (`~/.claude/settings.json`) have **separate** settings files. Keep them in sync manually. The WSL copy should omit Windows-specific entries like `additionalDirectories`.

---

## 7. Cursor IDE

[Cursor](https://cursor.com/) is an AI-powered code editor. On WSL, Cursor runs as a Windows application and connects to WSL via Remote.

### WSL Users: Create a Wrapper Script (WSL only)

The Windows Cursor binary isn't reliably available in native Ubuntu terminals because Windows PATH interop doesn't always work. Create a wrapper script:

```bash
mkdir -p ~/.local/bin

cat > ~/.local/bin/cursor << 'EOF'
#!/bin/bash
# Cursor CLI wrapper — calls the Windows Cursor binary via WSL interop.
# This lets "cursor ." open the current WSL directory in Cursor on Windows.
CURSOR_WIN="/mnt/c/Users/$(cmd.exe /C "echo %USERNAME%" 2>/dev/null | tr -d '\r')/AppData/Local/Programs/cursor/resources/app/bin/cursor"
if [ -x "$CURSOR_WIN" ]; then
    exec "$CURSOR_WIN" "$@"
else
    echo "Error: Cursor not found at $CURSOR_WIN" >&2
    echo "Install Cursor on Windows from https://cursor.com" >&2
    exit 1
fi
EOF

chmod +x ~/.local/bin/cursor
```

> **Prerequisite:** Cursor must be installed on your Windows host. Download from [cursor.com](https://cursor.com/).

### Native Linux Users: Install Cursor (Native Linux only)

Download the `.deb` or `.AppImage` from [cursor.com/download](https://cursor.com/download):

```bash
# Example for .deb:
sudo dpkg -i cursor-*.deb

# Or for AppImage:
chmod +x cursor-*.AppImage
mv cursor-*.AppImage ~/.local/bin/cursor
```

### Verify

```bash
cursor --version
```

---

## 8. Project Setup

With all tools installed, clone and set up the project:

```bash
# Clone (if you haven't already)
cd ~/dev
git clone https://github.com/praeducer/paulprae-com.git
cd paulprae-com

# Install npm dependencies
npm install

# Create environment file
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

For full pipeline setup (API keys, LinkedIn data, running the pipeline), see the [Pipeline Setup Checklist](pipeline-setup-checklist.md).

### Quick Smoke Test

```bash
npm run dev
# Open http://localhost:3000 in your browser
```

---

## 9. Verification Checklist

Run these commands to confirm everything is working:

| Command | Expected Output |
|---|---|
| `uname -r` | ≥ 6.2 |
| `node --version` | v22.x (or current LTS) |
| `npm --version` | 10.x+ |
| `which node` | `~/.nvm/versions/node/.../bin/node` |
| `claude --version` | Current version (e.g., 2.x.x) |
| `which claude` | `~/.nvm/versions/node/.../bin/claude` |
| `cursor --version` | Responds with version |
| `pandoc --version \| head -1` | pandoc 3.x+ |
| `typst --version` | typst 0.x.x |
| `cd ~/dev/paulprae-com && npm run dev` | Site at localhost:3000 |

---

## 10. Troubleshooting

### `claude` Resolves to Windows Binary (WSL)

**Symptom:** `which claude` shows `/mnt/c/Users/.../npm/claude` instead of a path under `~/.nvm/`.

**Cause:** A hardcoded `export PATH=` line in `~/.bashrc` (often with Windows/MINGW paths) is overwriting PATH after nvm loads, causing Windows binaries to take priority.

**Fix:**

```bash
# Find the offending line:
grep -n 'export PATH=' ~/.bashrc

# Remove or comment out any line that hardcodes Windows paths like:
#   export PATH="/c/Users/.../bin:/mingw64/bin:..."

# Restart your shell:
exec bash -l
```

### `cursor: command not found` in Native Ubuntu Terminal (WSL)

**Symptom:** `cursor` works from the VSCode/Cursor integrated terminal but not from the native Ubuntu terminal app.

**Cause:** The native Ubuntu terminal doesn't inherit the Windows PATH interop as reliably as the Cursor/VSCode integrated terminal.

**Fix:** Create the wrapper script described in [section 7](#wsl-users-create-a-wrapper-script-wsl-only). Verify `~/.local/bin` is on your PATH.

### Sandbox Warning When Running Claude Code

**Symptom:** Claude Code prints: "Sandbox is available on macOS (>v2.0) and Linux (>= v6.2)."

**Cause:** Your Linux kernel is below version 6.2 and doesn't support Landlock v3.

**Fix (WSL):**

```powershell
# From Admin PowerShell on Windows:
wsl --update
wsl --shutdown
```

**Fix (Native Linux):** Update your kernel (see [section 2](#native-linux-kernel-native-linux-only)).

### `nvm` / `node` / `npm` Not Found in Non-Interactive Shell

**Symptom:** Running `wsl.exe -- bash -c "node --version"` fails with "command not found", but `node` works in an interactive terminal.

**Cause:** `~/.bashrc` has an interactive guard (`case $- in *i*`) that skips the nvm loading block for non-interactive shells.

**Fix:** For non-interactive commands that need nvm, source it explicitly:

```bash
wsl.exe -- bash -c 'source ~/.nvm/nvm.sh && node --version'
# Or use an interactive login shell:
wsl.exe -- bash -ic 'node --version'
```

### `.cargo/env: No such file or directory`

**Symptom:** Shell startup shows an error sourcing `$HOME/.cargo/env`.

**Cause:** `~/.bashrc` unconditionally sources cargo's environment file, but Rust/cargo isn't installed.

**Fix:** Guard the source line in `~/.bashrc`:

```bash
# Replace:
. "$HOME/.cargo/env"

# With:
[ -s "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
```

### GitHub CLI (`gh`) Not Installed

**Symptom:** `gh` commands fail.

**Fix:**

```bash
# Ubuntu/Debian:
sudo apt-get install -y gh

# Or via conda-forge / snap — see https://cli.github.com/manual/installation
```
