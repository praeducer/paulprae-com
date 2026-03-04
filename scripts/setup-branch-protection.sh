#!/usr/bin/env bash
# Setup branch protection rules for paulprae-com via GitHub Rulesets API.
# Requires: gh CLI authenticated with admin access.
#
# Usage: ./scripts/setup-branch-protection.sh

set -euo pipefail

REPO="praeducer/paulprae-com"

echo "Configuring branch protection for $REPO..."

# Delete existing rulesets named "main-protection" to make this idempotent
EXISTING=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name == "main-protection") | .id' 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "Removing existing ruleset (id: $EXISTING)..."
  gh api -X DELETE "repos/$REPO/rulesets/$EXISTING"
fi

# Create ruleset
gh api "repos/$REPO/rulesets" \
  --method POST \
  --input - <<'EOF'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "ci" }
        ]
      }
    },
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
EOF

echo "Branch protection configured:"
echo "  - PRs required (0 approvals — solo dev, CI gates quality)"
echo "  - CI status check required"
echo "  - Deletion protection enabled"
echo "  - Force push protection enabled"
