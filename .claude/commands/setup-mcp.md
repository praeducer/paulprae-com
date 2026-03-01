---
description: Install MCP config for Claude Code and Cursor (project .mcp.json and .cursor/mcp.json)
allowed-tools: Bash
---

Run the MCP setup script so this project has the same MCP config for Claude Code and Cursor.

- **Linux / WSL / macOS:** `bash scripts/setup/install-mcp.sh`
- **Windows (PowerShell):** `powershell -NoProfile -File scripts\setup\install-mcp.ps1`

After running, tell the user to restart Cursor if they use it, and to use `/mcp` in Claude Code to authenticate with Vercel and GitHub (HTTP servers). See [docs/mcp-setup.md](../../docs/mcp-setup.md) for details.
