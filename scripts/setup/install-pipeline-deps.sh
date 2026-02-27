#!/usr/bin/env bash
#
# install-pipeline-deps.sh — Install system dependencies for the resume export pipeline
#
# Installs pandoc and typst, which are required by scripts/export-resume.ts
# to convert the AI-generated resume.md into PDF and DOCX formats.
#
# Supports: Ubuntu/Debian (including WSL), macOS (via Homebrew)
#
# References:
#   - Pandoc: https://pandoc.org/installing.html
#   - Typst:  https://github.com/typst/typst/releases
#   - Pipeline docs: docs/technical-design-document.md §5.6
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

# ─── Generate reference.docx (if missing) ────────────────────────────────────

REFERENCE_DOCX="$PROJECT_ROOT/templates/reference.docx"
if [[ -f "$REFERENCE_DOCX" ]]; then
    skip "templates/reference.docx exists"
else
    if command -v pandoc &>/dev/null; then
        info "Generating templates/reference.docx from pandoc defaults..."
        mkdir -p "$PROJECT_ROOT/templates"
        pandoc -o "$REFERENCE_DOCX" --print-default-data-file reference.docx
        ok "templates/reference.docx created — customize in Word/LibreOffice for professional styling"
    else
        skip "pandoc not available — skipping reference.docx generation"
    fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=== Summary ==="
echo ""
echo "  pandoc: $(command -v pandoc &>/dev/null && pandoc --version | head -1 || echo 'NOT INSTALLED')"
echo "  typst:  $(command -v typst &>/dev/null && typst --version || echo 'NOT INSTALLED')"
echo "  node:   $(command -v node &>/dev/null && node --version || echo 'NOT INSTALLED')"
echo "  npm:    $(command -v npm &>/dev/null && npm --version || echo 'NOT INSTALLED')"
echo ""
echo "  Next steps:"
echo "    1. Add your data files (see README.md)"
echo "    2. Create .env.local with ANTHROPIC_API_KEY"
echo "    3. Run: npm run pipeline"
echo ""
