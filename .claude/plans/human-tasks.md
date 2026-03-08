# Human Tasks -- paulprae.com

Tasks requiring manual action: Vercel dashboard, GitHub UI, DNS provider, browser testing, Anthropic console, or personal decisions. Cannot be automated by Claude Code.

> Last updated: 2026-03-08

---

## Critical Blocker

- [ ] **Fund Anthropic API credits** -- console.anthropic.com > Plans & Billing > add credits. The `ANTHROPIC_API_KEY` on Vercel has zero balance. Chat returns empty bubbles until this is resolved. Verify the same key is used locally (`.env.local`) and on Vercel (`ANTHROPIC_API_KEY` env var).

---

## Pre-Merge Checklist

Complete these before merging PR #21 (`feat/phase2-implementation`) to `main`.

### API & Runtime

- [ ] Fund Anthropic API credits (see Critical Blocker above)
- [ ] Test chat on the latest preview deployment -- send a message and confirm a real streaming response (not an empty bubble)
- [ ] Verify Vercel env vars are correct for all 3 environments (Production, Preview, Development):
  - `ANTHROPIC_API_KEY` -- required, must have funded balance
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN` -- Upstash Redis for rate limiting (optional but recommended)
  - Remove any stale Phase 3 vars if not needed yet (Supabase, Postgres)

### Git & GitHub

- [ ] Tag current `main` as `v1.0.0` (Phase 1 milestone): `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Review PR #21 description -- ensure it reflects the final scope
- [ ] Mark PR #21 as ready for review, then merge to `main`

---

## Post-Deploy Verification

Complete these after merging to `main` and confirming the Vercel production deploy is live.

### Smoke Test

- [ ] Visit `https://paulprae.com/` -- confirm Phase 2 chat UI is deployed (composer, quick action chips visible)
- [ ] Send a chat message -- confirm streaming response with real content (not empty bubble)
- [ ] Visit `https://paulprae.com/resume` -- confirm resume page renders
- [ ] Download PDF and DOCX -- confirm real files
- [ ] Visit `https://paulprae.com/nonexistent` -- confirm branded 404 page

### Full QA

- [ ] Run the production QA plan in browser: [`.claude/plans/production-qa-plan.md`](production-qa-plan.md)
  - Use Claude Code with `--chrome` flag, or manually follow the 12-phase plan
  - Covers: recruiter journey, hiring manager probes, engineering peer questions, tailored resume generation, tools page, security, SEO, mobile, accessibility, multi-turn conversations

### Monitoring (First 48 Hours)

- [ ] Monitor Anthropic API costs: console.anthropic.com > Usage
- [ ] Check Vercel Dashboard > Functions -- verify `/api/chat` executions appear with successful status
- [ ] Check Vercel Dashboard > Analytics -- verify real user visits are being tracked
- [ ] Monitor Upstash Redis dashboard (if configured) -- verify rate limiting counters are active
- [ ] Watch for any Vercel deployment errors or function timeout alerts

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
