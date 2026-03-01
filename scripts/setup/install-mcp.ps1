# install-mcp.ps1
#
# Installs project MCP config for Claude Code and Cursor.
# Copies scripts/setup/mcp-servers.json to project root .mcp.json and .cursor/mcp.json.
# Idempotent; safe to re-run.
#
# Usage: powershell -NoProfile -File scripts\setup\install-mcp.ps1
# See: docs/mcp-setup.md

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$Template = Join-Path $ScriptDir "mcp-servers.json"

if (-not (Test-Path $Template)) {
    Write-Error "Template not found: $Template"
    exit 1
}

Write-Host "`n=== MCP config installer ===" -ForegroundColor Cyan
Write-Host "  Project root: $ProjectRoot`n"

Copy-Item -Path $Template -Destination (Join-Path $ProjectRoot ".mcp.json") -Force
Write-Host "[OK] Wrote $ProjectRoot\.mcp.json" -ForegroundColor Green

$CursorDir = Join-Path $ProjectRoot ".cursor"
if (-not (Test-Path $CursorDir)) {
    New-Item -ItemType Directory -Path $CursorDir | Out-Null
}
Copy-Item -Path $Template -Destination (Join-Path $CursorDir "mcp.json") -Force
Write-Host "[OK] Wrote $CursorDir\mcp.json" -ForegroundColor Green

Write-Host "`nNext steps:"
Write-Host "  - Claude Code: run from this directory; use /mcp to authenticate (Vercel, GitHub)."
Write-Host "  - Cursor: restart Cursor to pick up .cursor/mcp.json; authenticate via MCP UI if prompted."
Write-Host "  - See docs/mcp-setup.md for env vars and troubleshooting.`n"
