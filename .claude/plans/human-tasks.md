# Human Tasks -- paulprae.com

Tasks requiring manual action: Vercel dashboard, GitHub UI, DNS provider, browser testing, Anthropic console, or personal decisions. Cannot be automated by Claude Code.

> Last updated: 2026-04-02

---

## Current: Merge PR #28 (Book Interview CTA)

PR #28 is `feat/interview-booking-cta` — adds the Book Interview scheduling CTA across all pages, UX polish, and branch consolidation (phase3 reference library + data model plan).

### YOU — Pre-merge QA (do before merging PR #28)

- [ ] Run `docs/uat-checklist.md` on the Vercel preview deployment for PR #28
- [ ] Confirm Book Interview CTA appears in header (all pages), chat hero chip, and resume contact row
- [ ] Confirm all 12 UAT sections pass

### YOU — Merge PR #28

- [ ] Merge PR #28 on GitHub when UAT passes

---

## Post-Merge Verification (PRs #27–28)

These tasks were pending after PRs #26 and #27 and still apply after PR #28 deploys to production.

### YOU — Mobile browser test

- [ ] Visit `https://paulprae.com/` → tap "Resume" link → confirm skip-nav does NOT flash
- [ ] Visit `https://paulprae.com/resume` directly on mobile → confirm no skip-nav flash
- [ ] On desktop, Tab through resume page → confirm skip-nav appears on first Tab press

### YOU — Book Interview CTA (mobile, production)

- [ ] On mobile: header shows icon-only "Book Interview" button on all three pages
- [ ] On mobile: tapping the button opens Microsoft Bookings in a new tab

### YOU — CORS verification

- [ ] Run: `curl -sI https://paulprae.com | grep -i access-control` → should show `https://paulprae.com` (not `*`)
- [ ] If still showing `*`, Vercel CDN cache may need time to propagate the new header

### YOU — Monitor dashboards (first 48 hours post-merge)

- [ ] Monitor Anthropic API costs: console.anthropic.com > Usage
- [ ] Check Vercel Dashboard > Functions — verify `/api/chat` executions with successful status
- [ ] Check Vercel Dashboard > Analytics — verify real user visits
- [ ] Monitor Upstash Redis dashboard (console.upstash.com) — verify rate limiting counters

---

## DNS & Domain Configuration

### Current State

| Domain             | Resolves To                                       | Status                 |
| ------------------ | ------------------------------------------------- | ---------------------- |
| `paulprae.com`     | `216.198.79.1` (Vercel Anycast)                   | Working -- serves site |
| `www.paulprae.com` | `216.150.1.1`, `216.150.16.1` (DreamHost default) | NOT pointing to Vercel |

- **Registrar/DNS:** DreamHost (nameservers: ns1/ns2/ns3.dreamhost.com)
- **Vercel project domains:** `paulprae.com` + `www.paulprae.com` (both assigned)
- **Canonical URL in code:** `https://paulprae.com` (non-www, set in `lib/constants.ts`)

### What Needs to Happen

**Goal:** `paulprae.com` is the canonical URL. `www.paulprae.com` redirects to it. Both resolve through Vercel.

#### Step 1: Verify Apex Domain A Record

The apex domain (`paulprae.com`) appears to already resolve to a Vercel IP (`216.198.79.1`). Verify this is correct:

1. Go to Vercel Dashboard > Project Settings > Domains
2. Check the status indicator next to `paulprae.com` -- it should show a green checkmark
3. If Vercel shows a configuration issue, the A record may need updating:
   - Go to DreamHost Panel > Manage Websites > paulprae.com > DNS Settings
   - Verify the A record for the root domain points to `76.76.21.21` (Vercel's standard Anycast IP)
   - If you see a different IP, check `vercel domains inspect paulprae.com` for the recommended value -- Vercel sometimes assigns project-specific IPs

#### Step 2: Configure www CNAME Record at DreamHost

The `www` subdomain currently points to DreamHost servers, not Vercel. Fix this:

1. **Set domain to DNS Only** (if not already):
   - DreamHost Panel > Manage Websites > paulprae.com
   - If hosting is active, switch to "DNS Only" under Non-Hosting Options
   - This removes DreamHost's default A/CNAME records so custom ones take effect
   - **Note:** Only do this if paulprae.com is already serving from Vercel (it is)

2. **Remove any existing www record** that points to DreamHost:
   - DreamHost Panel > DNS Settings for paulprae.com
   - Look for an A record or CNAME for `www` pointing to DreamHost IPs
   - Delete it (you may see "You already have a record for this name" errors otherwise)

3. **Add CNAME record for www:**
   - DreamHost Panel > DNS Settings > Add Record > CNAME
   - **Host:** `www`
   - **Points to:** `cname.vercel-dns.com` (Vercel's standard CNAME target)
   - If Vercel shows a project-specific CNAME target in the dashboard (e.g., `d1d4fc829fe7bc7c.vercel-dns-017.com`), use that instead
   - Save and wait for DNS propagation (up to 24 hours, typically 1-4 hours)

4. **Verify in Vercel:**
   - Run `npx vercel domains inspect paulprae.com` -- both domains should show verified
   - Or check Vercel Dashboard > Project Settings > Domains -- green checkmarks on both

#### Step 3: Configure www-to-non-www Redirect in Vercel

1. Vercel Dashboard > Project Settings > Domains
2. Click "Edit" on `www.paulprae.com`
3. Set **Redirect to:** `paulprae.com`
4. This creates a 308 redirect at Vercel's CDN edge -- fast, cached by browsers

#### Why Non-www as Canonical?

Vercel technically recommends `www` as primary because CNAME records give the CDN more traffic control than A records. However, for paulprae.com:

- **Personal branding:** `paulprae.com` is shorter and cleaner for a personal career site
- **Already canonical in code:** `SITE_URL`, `<link rel="canonical">`, sitemap, OG tags, and JSON-LD all use `https://paulprae.com`
- **Vercel supports apex domains well:** They use Anycast methodology for geographically routed traffic at the A record level
- **Google doesn't care:** Google treats www vs non-www as a preference, not a ranking factor. Consistency matters more than which you choose.
- **Chrome hides www anyway:** Google Chrome strips the `www.` prefix in the address bar

### DNS Best Practices Reference

From [Vercel](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting) and [Google](https://developers.google.com/search/docs/crawling-indexing/canonicalization):

- **Pick one canonical version and be consistent.** All internal links, canonical tags, sitemaps, and OG tags should use the same base URL. (Already done: `https://paulprae.com`)
- **301/308 redirect the non-canonical version.** Redirects are the strongest canonicalization signal to Google. Vercel's domain redirect handles this at the CDN edge.
- **Use `<link rel="canonical">` on every page.** Already implemented in `layout.tsx` via Next.js `alternates.canonical`.
- **Include canonical URLs in sitemap.xml.** Already done -- sitemap lists `https://paulprae.com/` and `https://paulprae.com/resume`.
- **Handle vercel.app duplicate content.** Vercel automatically adds `X-Robots-Tag: noindex` to preview deployments. For the production `vercel.app` alias (`paulprae-com-one.vercel.app`), the canonical tags in HTML point to `paulprae.com`, which is sufficient for Google. Optionally, add a Vercel WAF rule to redirect the `.vercel.app` URL to the custom domain.

### DreamHost-Specific Notes

- **CNAME on apex is impossible.** DNS spec forbids CNAME records on root/apex domains. That's why `paulprae.com` uses an A record and `www.paulprae.com` uses a CNAME. DreamHost does support ALIAS records (which work like CNAME on apex), but the A record approach is standard for Vercel.
- **DNS Only vs Fully Hosted.** To add custom A/CNAME records pointing away from DreamHost, the domain must be set to "DNS Only" first. This removes DreamHost's default hosting records.
- **Propagation time.** DreamHost DNS changes can take several hours to propagate globally. Vercel will show the domain as "pending" until propagation completes.
- **Conflicting records.** DreamHost won't let you add a CNAME for `www` if an existing A record already exists for `www`. Delete the old record first.

---

## SEO Verification (Post-DNS)

After DNS changes propagate and both domains work:

- [ ] Verify `https://paulprae.com` loads the site (HTTPS, no redirect)
- [ ] Verify `https://www.paulprae.com` redirects to `https://paulprae.com` (308)
- [ ] Verify `http://paulprae.com` redirects to `https://paulprae.com` (HSTS)
- [ ] Submit `https://paulprae.com` to Google Search Console (if not already)
- [ ] Request indexing for `/` and `/resume` pages
- [ ] Verify `/tools` is NOT indexed (noindex meta tag + not in sitemap)
- [ ] Test OG tags with the Facebook Sharing Debugger or Twitter Card Validator
- [ ] Test structured data with Google's Rich Results Test

---

## Content & Branding

- [ ] Obtain and add professional headshot to header/OG image
- [ ] Update OG image with headshot (run `npm run brand` after adding image)

---

## Future Considerations (Not Blocking Launch)

- [ ] Consider Vercel WAF rule to redirect `paulprae-com-one.vercel.app` to `paulprae.com` (prevents direct access to the vercel.app alias)
- [ ] Set up Google Search Console and Bing Webmaster Tools for indexing monitoring
- [ ] Consider moving nameservers to Vercel for unified DNS management (optional -- current DreamHost setup works fine)
- [ ] Review Anthropic API usage after 1 week and adjust rate limits if needed
