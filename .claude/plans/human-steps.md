# Human Steps — Manual Configuration

Tasks that require human action (GitHub UI, DNS panel, etc.).

## GitHub Branch Protection ✅

**Status:** Configured via `gh api` on 2026-03-02.

**Current rules on `main`:**

- Require a pull request before merging (0 approvals — solo project)
- Require status checks to pass (`ci` job)
- Require branches to be up to date before merging
- Admins can bypass in emergencies (`enforce_admins: false`)

**To modify:** Settings → Branches → `main` rule at
https://github.com/praeducer/paulprae-com/settings/branches

## DNS Configuration (paulprae.com)

**Status:** Pending — requires DreamHost panel access.

**Required records:**

| Type  | Name | Value                |
| ----- | ---- | -------------------- |
| A     | @    | 76.76.21.21          |
| CNAME | www  | cname.vercel-dns.com |

**Steps:**

1. Log in to panel.dreamhost.com
2. Navigate to Domains → DNS Records
3. Add/update the records above
4. Wait for propagation (up to 48h)
5. Verify: `dig paulprae.com +short` should return `76.76.21.21`

## Vercel Analytics Dashboard

**Status:** Code deployed. Verify data appears after first production deploy.

**Steps:**

1. After merging this PR, visit https://vercel.com/dashboard
2. Select the paulprae-com project
3. Click the Analytics tab — should show page views within minutes
4. Click Speed Insights tab — Core Web Vitals after some traffic
