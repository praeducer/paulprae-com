#!/bin/bash
# setup-git-config.sh - Enforce recommended Git configuration for WSL/Ubuntu development
# Run this script to set Git config values for consistent behavior across Windows/WSL

set -e

echo "Setting up Git configuration..."

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

echo "Git configuration updated successfully."
echo "Current config:"
git config --list --show-origin | grep -E "(autocrlf|longpaths|pull\.rebase|push\.autoSetupRemote|init\.defaultBranch)"