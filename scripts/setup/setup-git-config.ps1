# setup-git-config.ps1 - Enforce recommended Git configuration for Windows development
# Run this script to set Git config values for consistent behavior across Windows/WSL

param()

Write-Host "Setting up Git configuration..."

# Enforce CRLF handling for cross-platform compatibility
git config --global core.autocrlf true

# Enable long paths to avoid issues with deep directory structures
git config --global core.longpaths true

# Disable rebase on pull to avoid conflicts with merge commits
git config --global pull.rebase false

# Auto-setup remote tracking branches
git config --global push.autoSetupRemote true

# Set default branch to main
git config --global init.defaultBranch main

Write-Host "Git configuration updated successfully."
Write-Host "Current config:"
git config --list --show-origin | Select-String -Pattern "(autocrlf|longpaths|pull\.rebase|push\.autoSetupRemote|init\.defaultBranch)"