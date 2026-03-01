#!/usr/bin/env bash
#
# install-mcp.sh — Install project MCP config for Claude Code and Cursor
#
# Writes .mcp.json (project root, for Claude Code) and .cursor/mcp.json (for Cursor)
# from the canonical template scripts/setup/mcp-servers.json. Idempotent; safe to re-run.
#
# Requires: bash, cp or cat. Optional: claude (for verification).
# See: docs/mcp-setup.md
#
# Usage: bash scripts/setup/install-mcp.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE="$SCRIPT_DIR/mcp-servers.json"

if [[ ! -f "$TEMPLATE" ]]; then
    echo "[FAIL] Template not found: $TEMPLATE" >&2
    exit 1
fi

echo ""
echo "=== MCP config installer ==="
echo "  Project root: $PROJECT_ROOT"
echo ""

# Write project-root .mcp.json (Claude Code project scope)
cp "$TEMPLATE" "$PROJECT_ROOT/.mcp.json"
echo "[OK] Wrote $PROJECT_ROOT/.mcp.json"

# Write .cursor/mcp.json (Cursor)
mkdir -p "$PROJECT_ROOT/.cursor"
cp "$TEMPLATE" "$PROJECT_ROOT/.cursor/mcp.json"
echo "[OK] Wrote $PROJECT_ROOT/.cursor/mcp.json"

echo ""
echo "Next steps:"
echo "  - Claude Code: use project from this directory; run 'claude' and /mcp to authenticate (Vercel, GitHub)."
echo "  - Cursor: restart Cursor so it picks up .cursor/mcp.json; then authenticate via MCP UI if prompted."
echo "  - See docs/mcp-setup.md for env vars and troubleshooting."
echo ""
