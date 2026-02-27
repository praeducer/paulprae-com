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
#   - Pandoc: https://pandoc.org/installing.html
#   - Typst: https://github.com/typst/typst
#   - Vercel CLI: https://vercel.com/docs/cli
#   - Claude Code: https://docs.anthropic.com/en/docs/claude-code
#
# Usage: powershell -NoProfile -File scripts\setup\install-dev-tools.ps1
# Requires: Internet access. Administrator is not required.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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
        winget install --id $WingetId --exact --silent --disable-interactivity --accept-source-agreements --accept-package-agreements
    }
}

# winget packages (see each tool's docs linked above)
Install-IfMissing -Command "git"  -WingetId "Git.Git"                    -DisplayName "Git"
Install-IfMissing -Command "node" -WingetId "OpenJS.NodeJS.LTS"          -DisplayName "Node.js LTS"
Install-IfMissing -Command "gh"   -WingetId "GitHub.cli"                 -DisplayName "GitHub CLI"
Install-IfMissing -Command "code"   -WingetId "Microsoft.VisualStudioCode" -DisplayName "VS Code"
Install-IfMissing -Command "pandoc" -WingetId "JohnMacFarlane.Pandoc"      -DisplayName "Pandoc"
Install-IfMissing -Command "typst"  -WingetId "Typst.Typst"               -DisplayName "Typst"

# Refresh PATH for npm-based installs
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"

# npm global packages (require Node.js)
if ((Get-Command npm -ErrorAction SilentlyContinue) -and -not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $vercelInstalled = $null -ne (npm list -g vercel --depth=0 2>$null | Select-String "vercel@")
    if (-not $vercelInstalled) {
        Write-Host "[INSTALL] Vercel CLI..." -ForegroundColor Green
        npm install -g vercel
    } else {
        Write-Host "[SKIP] Vercel CLI already installed" -ForegroundColor Yellow
    }

    $claudeInstalled = $null -ne (npm list -g @anthropic-ai/claude-code --depth=0 2>$null | Select-String "@anthropic-ai/claude-code@")
    if (-not $claudeInstalled) {
        Write-Host "[INSTALL] Claude Code CLI..." -ForegroundColor Green
        npm install -g @anthropic-ai/claude-code
    } else {
        Write-Host "[SKIP] Claude Code CLI already installed" -ForegroundColor Yellow
    }
} elseif ((Get-Command npm -ErrorAction SilentlyContinue) -and ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Skipping npm global installs in elevated shell (least-privilege best practice). Re-run this script in a non-admin terminal to install Vercel/Claude CLIs."
} else {
    Write-Warning "Node.js not in PATH. Restart terminal and re-run to install npm packages."
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Next: See docs/windows-dev-environment-setup.md for git config and Dev Drive setup.`n"
