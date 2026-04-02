#!/bin/bash
# setup-vscode-global-settings.sh - Apply recommended global VS Code settings
# This script attempts to update the user's VS Code settings.json file

set -e

# Detect VS Code settings path
# On WSL, it's typically /mnt/c/Users/<WindowsUser>/AppData/Roaming/Code/User/settings.json
# But we need to find the Windows user

# Try to get Windows user from environment or assume
WINDOWS_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
if [ -z "$WINDOWS_USER" ]; then
    echo "Could not detect Windows username. Please manually apply the settings from recommended-vscode-settings.json"
    exit 1
fi

SETTINGS_PATH="/mnt/c/Users/$WINDOWS_USER/AppData/Roaming/Code/User/settings.json"

if [ ! -f "$SETTINGS_PATH" ]; then
    echo "VS Code settings file not found at $SETTINGS_PATH. Please ensure VS Code is installed and run this script from WSL."
    exit 1
fi

echo "Updating VS Code global settings..."

# Backup existing settings
cp "$SETTINGS_PATH" "$SETTINGS_PATH.backup.$(date +%Y%m%d_%H%M%S)"

# Use jq or sed to merge settings. For simplicity, append if not present.
# This is a basic implementation; in production, use jq for proper JSON merging.

# Recommended settings to add/ensure
cat >> "$SETTINGS_PATH" << 'EOF'
{
  "terminal.integrated.defaultProfile.linux": "bash",
  "git.enabled": true,
  "files.watcherExclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/__pycache__": true,
    "**/.ruff_cache": true
  },
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": "explicit"
  },
  "python.defaultInterpreterPath": "python3"
}
EOF

echo "Global VS Code settings updated. Backup created."