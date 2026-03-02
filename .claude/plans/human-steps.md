# Human Steps — Active Action Items

Tasks that require manual action outside of code.

## DNS: Update A Record at DreamHost

**Status:** Pending — current A record (216.198.79.1) points to DreamHost IP.
Site works via Vercel anyway, but Vercel recommends 76.76.21.21 for optimal performance and SSL.
CNAME for www is already correct (cname.vercel-dns.com).

**Steps:**

1. Log in to panel.dreamhost.com
2. Navigate to Domains → DNS Records
3. Change the A record for `@` from `216.198.79.1` to `76.76.21.21`
4. Wait for propagation (up to 48h)
5. Verify: `dig paulprae.com +short` should return `76.76.21.21`

## Vercel: Configure www → non-www Redirect

**Status:** Pending. Both `paulprae.com` and `www.paulprae.com` serve content without a 301 redirect.

**Steps:**

1. Go to Vercel dashboard → paulprae-com → Settings → Domains
2. Configure `www.paulprae.com` to redirect to `paulprae.com`

## Monitor: Speed Insights Vitals 503

**Status:** Monitoring. Vitals POST to `va.vercel-scripts.com` returned 503 during QA.
May be transient — re-check after a few days of production traffic.
