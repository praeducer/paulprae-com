#!/usr/bin/env bash
#
# install-pipeline-deps.sh — Install system dependencies for the resume pipeline
#
# Installs pandoc, typst, Node.js (via nvm), npm dependencies, Claude Code CLI,
# and (on WSL) creates a Cursor wrapper script. Also runs a shell health check.
#
# Supports: Ubuntu/Debian (including WSL), macOS (via Homebrew)
#
# References:
#   - Pandoc:      https://pandoc.org/installing.html
#   - Typst:       https://github.com/typst/typst/releases
#   - Claude Code: https://docs.anthropic.com/en/docs/claude-code
#   - Pipeline:    docs/technical-design-document.md §5.6
#   - Full guide:  docs/linux-dev-environment-setup.md
#
# Usage:
#   bash scripts/setup/install-pipeline-deps.sh
#
# On Windows (non-WSL), use:
#   winget install JohnMacFarlane.Pandoc
#   winget install Typst.Typst

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
skip()  { echo -e "${YELLOW}[SKIP]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

confirm() {
    local prompt="$1"
    if [[ -t 0 ]]; then
        read -r -p "$prompt [y/N]: " reply
        [[ "$reply" =~ ^[Yy]$ ]]
    else
        return 1
    fi
}

echo ""
echo "=== Resume Pipeline Dependencies Installer ==="
echo ""

# ─── Detect Platform ──────────────────────────────────────────────────────────

OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

if [[ "$OS" == "unknown" ]]; then
    fail "Unsupported platform: $OSTYPE"
    echo "  On Windows (non-WSL), install manually:"
    echo "    winget install JohnMacFarlane.Pandoc"
    echo "    winget install Typst.Typst"
    exit 1
fi

# ─── Detect WSL ──────────────────────────────────────────────────────────────

IS_WSL=false
if grep -qi microsoft /proc/version 2>/dev/null; then
    IS_WSL=true
    info "Running inside WSL"
fi

# ─── Install Pandoc ───────────────────────────────────────────────────────────

if command -v pandoc &>/dev/null; then
    skip "pandoc already installed: $(pandoc --version | head -1)"
else
    info "Installing pandoc..."
    if [[ "$OS" == "linux" ]]; then
        sudo apt-get update -qq
        sudo apt-get install -y -qq pandoc
    elif [[ "$OS" == "macos" ]]; then
        brew install pandoc
    fi

    if command -v pandoc &>/dev/null; then
        ok "pandoc installed: $(pandoc --version | head -1)"
    else
        fail "pandoc installation failed"
        exit 1
    fi
fi

# ─── Install Typst ────────────────────────────────────────────────────────────

if command -v typst &>/dev/null; then
    skip "typst already installed: $(typst --version)"
else
    info "Installing typst..."
    if [[ "$OS" == "linux" ]]; then
        # Prefer cargo if available (gets latest version)
        if command -v cargo &>/dev/null; then
            info "Installing via cargo (this may take a few minutes)..."
            cargo install typst-cli
        else
            # Download prebuilt binary from GitHub releases
            info "cargo not found — downloading prebuilt binary from GitHub..."
            TYPST_VERSION=$(curl -sL https://api.github.com/repos/typst/typst/releases/latest | grep '"tag_name"' | head -1 | cut -d'"' -f4)
            if [[ -z "$TYPST_VERSION" ]]; then
                fail "Could not determine latest typst version from GitHub"
                echo "  Install manually: cargo install typst-cli"
                echo "  Or: https://github.com/typst/typst/releases"
                exit 1
            fi

            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  TYPST_ARCH="x86_64-unknown-linux-musl" ;;
                aarch64) TYPST_ARCH="aarch64-unknown-linux-musl" ;;
                *)
                    fail "Unsupported architecture: $ARCH"
                    echo "  Install manually: cargo install typst-cli"
                    exit 1
                    ;;
            esac

            TYPST_URL="https://github.com/typst/typst/releases/download/${TYPST_VERSION}/typst-${TYPST_ARCH}.tar.xz"
            TEMP_DIR=$(mktemp -d)
            info "Downloading $TYPST_URL"
            curl -fsSL "$TYPST_URL" -o "$TEMP_DIR/typst.tar.xz"
            tar -xf "$TEMP_DIR/typst.tar.xz" -C "$TEMP_DIR"

            TYPST_BIN="$TEMP_DIR/typst-${TYPST_ARCH}/typst"
            if [[ ! -f "$TYPST_BIN" ]]; then
                fail "Could not locate typst binary in downloaded archive"
                echo "  Install manually: cargo install typst-cli"
                rm -rf "$TEMP_DIR"
                exit 1
            fi

            chmod +x "$TYPST_BIN"

            sudo mv "$TYPST_BIN" /usr/local/bin/typst
            rm -rf "$TEMP_DIR"
        fi
    elif [[ "$OS" == "macos" ]]; then
        brew install typst
    fi

    if command -v typst &>/dev/null; then
        ok "typst installed: $(typst --version)"
    else
        fail "typst installation failed"
        echo "  Install manually: cargo install typst-cli"
        echo "  Or: https://github.com/typst/typst/releases"
        exit 1
    fi
fi

# ─── Install Node.js (if missing) ────────────────────────────────────────────

if command -v node &>/dev/null; then
    skip "node already installed: $(node --version)"
else
    info "Node.js not found — installing via nvm..."
    if ! command -v nvm &>/dev/null && [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
        info "nvm is not installed."
        if ! confirm "Install nvm from the official nvm-sh script (pinned tag v0.40.3)?"; then
            fail "nvm installation skipped by user."
            echo "  Install manually: https://github.com/nvm-sh/nvm#installing-and-updating"
            exit 1
        fi
        curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh" -o /tmp/install-nvm.sh
        bash /tmp/install-nvm.sh
        rm -f /tmp/install-nvm.sh
        export NVM_DIR="$HOME/.nvm"
        # shellcheck source=/dev/null
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    else
        export NVM_DIR="$HOME/.nvm"
        # shellcheck source=/dev/null
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    fi

    nvm install --lts
    nvm use --lts
    ok "node installed: $(node --version)"
fi

# ─── npm install (project dependencies) ──────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
    skip "node_modules exists — run 'npm install' manually to update"
else
    info "Installing npm dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    ok "npm dependencies installed"
fi

# ─── Claude Code CLI ─────────────────────────────────────────────────────────

if command -v claude &>/dev/null; then
    skip "claude already installed: $(claude --version 2>/dev/null || echo 'unknown version')"
else
    info "Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
    if command -v claude &>/dev/null; then
        ok "claude installed: $(claude --version 2>/dev/null)"
    else
        fail "Claude Code installation failed"
        echo "  Install manually: npm install -g @anthropic-ai/claude-code"
    fi
fi

# ─── Claude Code Settings ────────────────────────────────────────────────────

CLAUDE_DIR="$HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"

if [[ -f "$CLAUDE_SETTINGS" ]]; then
    skip "Claude Code settings already exist: $CLAUDE_SETTINGS"
else
    info "Creating Claude Code settings..."
    mkdir -p "$CLAUDE_DIR"
    cat > "$CLAUDE_SETTINGS" << 'SETTINGS_EOF'
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
SETTINGS_EOF
    ok "Created $CLAUDE_SETTINGS"
fi

# ─── Cursor Wrapper (WSL only) ───────────────────────────────────────────────

if $IS_WSL; then
    CURSOR_WRAPPER="$HOME/.local/bin/cursor"
    if [[ -f "$CURSOR_WRAPPER" ]]; then
        skip "Cursor wrapper already exists: $CURSOR_WRAPPER"
    else
        info "Creating Cursor wrapper for WSL..."
        mkdir -p "$HOME/.local/bin"
        cat > "$CURSOR_WRAPPER" << 'CURSOR_EOF'
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
CURSOR_EOF
        chmod +x "$CURSOR_WRAPPER"
        ok "Created Cursor wrapper at $CURSOR_WRAPPER"
        info "Prerequisite: Cursor must be installed on the Windows host (https://cursor.com)"
    fi
fi

# ─── Shell Health Check ──────────────────────────────────────────────────────

echo ""
echo "=== Shell Health Check ==="
echo ""

# Check for PATH corruption patterns in .bashrc
if grep -qE '^export PATH=.*(mingw|MINGW|/c/Users)' "$HOME/.bashrc" 2>/dev/null; then
    fail "Found hardcoded PATH export in ~/.bashrc that may overwrite nvm"
    echo "  This can cause node, npm, and claude to resolve to wrong binaries."
    echo "  See: docs/linux-dev-environment-setup.md#3-shell-configuration-health-check"
fi

# Check cargo env is guarded
if grep -q '^\. "\$HOME/.cargo/env"' "$HOME/.bashrc" 2>/dev/null; then
    if ! grep -q '\[ -s "\$HOME/.cargo/env" \]' "$HOME/.bashrc" 2>/dev/null; then
        fail "~/.bashrc sources cargo env without existence guard"
        echo "  Replace:  . \"\$HOME/.cargo/env\""
        echo "  With:     [ -s \"\$HOME/.cargo/env\" ] && . \"\$HOME/.cargo/env\""
    fi
fi

# Check WSL kernel version
if $IS_WSL; then
    KERNEL_VERSION=$(uname -r | cut -d. -f1-2)
    KERNEL_MAJOR=$(echo "$KERNEL_VERSION" | cut -d. -f1)
    KERNEL_MINOR=$(echo "$KERNEL_VERSION" | cut -d. -f2)
    if [[ "$KERNEL_MAJOR" -lt 6 ]] || { [[ "$KERNEL_MAJOR" -eq 6 ]] && [[ "$KERNEL_MINOR" -lt 2 ]]; }; then
        fail "WSL kernel $KERNEL_VERSION is below 6.2 — Claude Code sandbox requires >= 6.2"
        echo "  Fix from Admin PowerShell: wsl --update && wsl --shutdown"
    else
        ok "WSL kernel $(uname -r) — meets sandbox requirement (>= 6.2)"
    fi
fi

# Verify key tools resolve correctly
for cmd in node npm claude pandoc typst cursor; do
    if command -v "$cmd" &>/dev/null; then
        ok "$cmd → $(which "$cmd")"
    else
        skip "$cmd not found (optional for some workflows)"
    fi
done

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=== Summary ==="
echo ""
echo "  pandoc: $(command -v pandoc &>/dev/null && pandoc --version | head -1 || echo 'NOT INSTALLED')"
echo "  typst:  $(command -v typst &>/dev/null && typst --version || echo 'NOT INSTALLED')"
echo "  node:   $(command -v node &>/dev/null && node --version || echo 'NOT INSTALLED')"
echo "  npm:    $(command -v npm &>/dev/null && npm --version || echo 'NOT INSTALLED')"
echo "  claude: $(command -v claude &>/dev/null && claude --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "  cursor: $(command -v cursor &>/dev/null && echo 'AVAILABLE' || echo 'NOT INSTALLED')"
echo ""
echo "  Next steps:"
echo "    1. Add your data files (see README.md)"
echo "    2. Create .env.local with ANTHROPIC_API_KEY"
echo "    3. Run: npm run pipeline"
echo "    4. See docs/linux-dev-environment-setup.md for full guide"
echo ""
