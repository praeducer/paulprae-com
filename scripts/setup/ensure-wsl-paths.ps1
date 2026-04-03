# ensure-wsl-paths.ps1 - Verify and enforce WSL paths for optimal performance
# Ensures projects are in WSL filesystem, not /mnt/c

param()

Write-Host "Checking WSL paths..."

# Get current WSL distro
$distro = wsl -l -q | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1
if (-not $distro) {
    Write-Warning "Ubuntu WSL distro not found. Please install Ubuntu."
    exit 1
}

# Check if current directory is in /mnt/c
$currentPath = Get-Location
if ($currentPath.Path -like "*\mnt\c\*") {
    Write-Warning "Current path is in /mnt/c. For best performance, work in WSL filesystem (e.g., /home/user/dev)."
    Write-Host "Consider moving projects to ~/dev or similar."
}

# Check WSL status
$wslStatus = wsl --status
if ($wslStatus -match "Default Version: 1") {
    Write-Warning "WSL 2 is recommended for better performance."
}

Write-Host "WSL path check complete."