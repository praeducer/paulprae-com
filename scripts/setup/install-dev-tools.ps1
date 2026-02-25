# install-dev-tools.ps1
#
# Convenience wrapper that installs dev tools for paulprae-com via winget and npm.
# Idempotent — safe to re-run. Skips tools that are already installed.
#
# This script uses:
#   - winget (Microsoft's package manager): https://learn.microsoft.com/en-us/windows/package-manager/winget/
#   - npm (Node.js package manager): https://docs.npmjs.com/cli/
#
# For manual installation or additional configuration, see each tool's official docs:
#   - Git: https://git-scm.com/doc
#   - Node.js: https://nodejs.org/en/download/
#   - VS Code: https://code.visualstudio.com/docs
#   - GitHub CLI: https://cli.github.com/manual/
#   - Vercel CLI: https://vercel.com/docs/cli
#   - Claude Code: https://docs.anthropic.com/en/docs/claude-code
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup\install-dev-tools.ps1
# Requires: Run as Administrator

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "`n=== Dev Tools Installer ===" -ForegroundColor Cyan

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget not available. See: https://learn.microsoft.com/en-us/windows/package-manager/winget/"
    exit 1
}

function Install-IfMissing {
    param([string]$Command, [string]$WingetId, [string]$DisplayName)
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        $version = & $Command --version 2>&1 | Select-Object -First 1
        Write-Host "[SKIP] $DisplayName already installed: $version" -ForegroundColor Yellow
    } else {
        Write-Host "[INSTALL] $DisplayName..." -ForegroundColor Green
        winget install --id $WingetId --accept-source-agreements --accept-package-agreements
    }
}

# winget packages (see each tool's docs linked above)
Install-IfMissing -Command "git"  -WingetId "Git.Git"                    -DisplayName "Git"
Install-IfMissing -Command "node" -WingetId "OpenJS.NodeJS.LTS"          -DisplayName "Node.js LTS"
Install-IfMissing -Command "gh"   -WingetId "GitHub.cli"                 -DisplayName "GitHub CLI"
Install-IfMissing -Command "code" -WingetId "Microsoft.VisualStudioCode" -DisplayName "VS Code"

# Refresh PATH for npm-based installs
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# npm global packages (require Node.js)
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmGlobals = npm list -g --depth=0 2>&1
    if ($npmGlobals -notmatch "vercel") {
        Write-Host "[INSTALL] Vercel CLI..." -ForegroundColor Green
        npm install -g vercel
    } else {
        Write-Host "[SKIP] Vercel CLI already installed" -ForegroundColor Yellow
    }
    if ($npmGlobals -notmatch "claude-code") {
        Write-Host "[INSTALL] Claude Code CLI..." -ForegroundColor Green
        npm install -g @anthropic-ai/claude-code
    } else {
        Write-Host "[SKIP] Claude Code CLI already installed" -ForegroundColor Yellow
    }
} else {
    Write-Warning "Node.js not in PATH. Restart terminal and re-run to install npm packages."
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Next: See docs/windows-dev-environment-setup.md for git config and Dev Drive setup.`n"
