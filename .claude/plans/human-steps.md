# Human Steps — Active Action Items

Tasks that require manual action outside of code.

> **v2.1 CI/CD human steps are COMPLETE** — see `human-steps-v2.1.md` for details.
> These remaining items are lower-priority DNS/monitoring tasks.

## DNS: Update A Record at DreamHost

**Status:** Pending (low priority — site works fine on current IP).
Last checked 2026-03-04: site resolves and serves via Vercel (HTTP 200).
Vercel recommends `76.76.21.21` for optimal routing and SSL behavior.
CNAME for www is already correct (cname.vercel-dns.com).

**Steps:**

1. Log in to panel.dreamhost.com
2. Navigate to Domains → DNS Records
3. Change the A record for `@` from `216.198.79.1` to `76.76.21.21`
4. Wait for propagation (up to 48h)
5. Verify: `dig paulprae.com +short` should return `76.76.21.21`

## Vercel: Configure www → non-www Redirect

**Status:** Pending.
Last checked 2026-03-03 via `curl -I https://www.paulprae.com`: response is `HTTP/2 200` (no redirect), so canonical redirect is still not configured.

**Steps:**

1. Go to Vercel dashboard → paulprae-com → Settings → Domains
2. Configure `www.paulprae.com` to redirect to `paulprae.com`
3. Verify: `curl -I https://www.paulprae.com` returns `301` or `308` with `location: https://paulprae.com/...`

## Monitor: Speed Insights Vitals 503

**Status:** Monitoring.
Vitals POST to `va.vercel-scripts.com` returned 503 during earlier QA.
May be transient — re-check after a few days of production traffic.
