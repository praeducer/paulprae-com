# Linux / WSL Development Environment Setup

This guide covers Linux-side setup for this repository (native Linux or WSL Ubuntu).
It is intentionally operational and concise; machine-specific history is excluded.

For Windows host setup, use `docs/windows-dev-environment-setup.md`.
For project install/run, use `README.md`.

## 1. Requirements

| Requirement | Minimum                                           |
| ----------- | ------------------------------------------------- |
| OS          | Ubuntu 22.04+ (or compatible Debian-based distro) |
| Kernel      | 6.2+ (required for Claude Code sandbox support)   |
| RAM         | 4 GB+ (8 GB recommended)                          |
| Node.js     | LTS (installed via nvm)                           |

Check kernel:

```bash
uname -r
```

If using WSL and kernel is too old, update from Windows admin PowerShell:

```powershell
wsl --update
wsl --shutdown
```

## 2. Quick Setup (scripted)

From repo root:

```bash
bash scripts/setup/install-pipeline-deps.sh
```

This script installs:

- nvm + Node.js
- npm dependencies
- pandoc + typst tooling
- Claude Code CLI
- WSL cursor wrapper when applicable

## 3. Manual Setup (if needed)

### 3.1 nvm + Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install   # reads version from .nvmrc (Node 24)
nvm alias default 24
```

The project includes a `.nvmrc` file pinning the Node.js major version. Running `nvm install` or `nvm use` in the repo root picks up this version automatically.

### 3.2 Export dependencies

```bash
sudo apt-get update
sudo apt-get install -y pandoc
```

Install Typst via package manager, release binary, or cargo:

```bash
typst --version
```

### 3.3 Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
claude /login
```

### 3.4 Cursor command in WSL (optional)

If `cursor` is not available in native Ubuntu terminal, use the wrapper installed by `install-pipeline-deps.sh`, or create an equivalent script in `~/.local/bin`.

## 4. MCP Setup

From repo root:

```bash
bash scripts/setup/install-mcp.sh
```

Then:

- restart Cursor
- in Claude Code, run `/mcp` and complete OAuth for Vercel/GitHub

Details: `docs/mcp-setup.md`.

## 5. Project Bootstrap

```bash
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/praeducer/paulprae-com.git
cd paulprae-com
npm install
cp .env.local.example .env.local
```

Then follow `README.md` for data inputs and pipeline execution.

## 6. Verification Checklist

```bash
uname -r
node --version
npm --version
which node
which claude
claude --version
pandoc --version
typst --version
```

From repo root:

```bash
npm run lint
npm run format:check
npm test
```

## 7. Troubleshooting

### `node` or `claude` not found in non-interactive shells

Source nvm explicitly in command context:

```bash
source ~/.nvm/nvm.sh && node --version
```

### PATH contamination from Windows binaries in WSL

Avoid hardcoded PATH overrides in shell startup files that prepend Windows paths ahead of nvm paths.

### `cursor` missing in Ubuntu terminal

Ensure `~/.local/bin` is on PATH and wrapper script exists.

### Pre-commit hook fails with exit code 127

On Ubuntu/Debian, `sh` is `dash` (not `bash`). Husky runs hooks via `sh -e`, so sourcing `nvm.sh` (which requires bash) silently fails, leaving `npx` missing from PATH.

The project's pre-commit hook uses POSIX-safe PATH detection instead of sourcing `nvm.sh`. If you still see code 127:

1. Run the setup script to create husky's global init file:

   ```bash
   bash scripts/setup/install-pipeline-deps.sh
   ```

   This creates `~/.config/husky/init.sh` which adds nvm-managed Node.js to PATH before any hook runs.

2. Verify manually:
   ```bash
   sh -e .husky/pre-commit
   ```

### Sandbox warning in Claude Code

Update to kernel 6.2+ (WSL: `wsl --update`) and restart WSL.
