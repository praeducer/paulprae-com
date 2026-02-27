# setup-dev-drive.ps1
#
# Post-Dev-Drive-creation setup: directory structure, package cache redirection,
# trust verification, and filter configuration.
#
# Run AFTER creating the Dev Drive via Windows Settings wizard.
# See: https://learn.microsoft.com/en-us/windows/dev-drive/
#
# What this script does (that vendor docs don't automate):
#   - Creates the project workspace and package cache directories
#   - Redirects npm/pip caches to Dev Drive (per MS recommendation:
#     https://learn.microsoft.com/en-us/windows/dev-drive/#storing-package-cache-on-dev-drive)
#   - Verifies trust and configures filesystem filters
#     (https://learn.microsoft.com/en-us/windows/dev-drive/#filters-for-common-scenarios)
#
# Usage: powershell -NoProfile -File scripts\setup\setup-dev-drive.ps1
# Requires: Run as Administrator. Dev Drive already mounted at D:

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$DevDrive = "D:"

Write-Host "`n=== Dev Drive Post-Setup ===" -ForegroundColor Cyan

# Verify Dev Drive exists
if (-not (Test-Path $DevDrive)) {
    Write-Error "Dev Drive not found at $DevDrive. Create it first via Settings > Storage > Disks & volumes."
    exit 1
}

# Check if it's a Dev Drive
fsutil devdrv query $DevDrive 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "$DevDrive exists but may not be a Dev Drive."
} else {
    Write-Host "[OK] Dev Drive detected at $DevDrive" -ForegroundColor Green
}

# Create directory structure
Write-Host "`n--- Directories ---" -ForegroundColor Cyan
foreach ($dir in @("$DevDrive\dev", "$DevDrive\packages\npm", "$DevDrive\packages\pip")) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "[CREATED] $dir" -ForegroundColor Green
    } else {
        Write-Host "[EXISTS]  $dir" -ForegroundColor Yellow
    }
}

# Redirect package caches
# See: https://learn.microsoft.com/en-us/windows/dev-drive/#storing-package-cache-on-dev-drive
Write-Host "`n--- Package caches ---" -ForegroundColor Cyan

# npm: https://docs.npmjs.com/cli/v10/using-npm/config#cache
$npmTarget = "$DevDrive\packages\npm"
if ([System.Environment]::GetEnvironmentVariable("npm_config_cache", "User") -ne $npmTarget) {
    [System.Environment]::SetEnvironmentVariable("npm_config_cache", $npmTarget, "User")
    Write-Host "[SET] npm_config_cache -> $npmTarget" -ForegroundColor Green
} else {
    Write-Host "[SKIP] npm cache already configured" -ForegroundColor Yellow
}

# pip: https://pip.pypa.io/en/stable/topics/caching/
$pipTarget = "$DevDrive\packages\pip"
if ([System.Environment]::GetEnvironmentVariable("PIP_CACHE_DIR", "User") -ne $pipTarget) {
    [System.Environment]::SetEnvironmentVariable("PIP_CACHE_DIR", $pipTarget, "User")
    Write-Host "[SET] PIP_CACHE_DIR -> $pipTarget" -ForegroundColor Green
} else {
    Write-Host "[SKIP] pip cache already configured" -ForegroundColor Yellow
}

# Trust and filters
# See: https://learn.microsoft.com/en-us/windows/dev-drive/#filters-for-common-scenarios
Write-Host "`n--- Trust & filters ---" -ForegroundColor Cyan
fsutil devdrv trust $DevDrive 2>&1 | Out-Null
Write-Host "[OK] $DevDrive trusted" -ForegroundColor Green

fsutil devdrv setFiltersAllowed /volume $DevDrive "PrjFlt, MsSecFlt, WdFilter, bindFlt, wcifs, FileInfo" 2>&1 | Out-Null
Write-Host "[OK] Common dev filters allowed" -ForegroundColor Green

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Next steps:"
Write-Host "  1. Restart terminal for env var changes"
Write-Host "  2. Move repos: robocopy C:\dev\paulprae-com D:\dev\paulprae-com /E /MOVE"
Write-Host "  3. Verify: npm config get cache`n"
