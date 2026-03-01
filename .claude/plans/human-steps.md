# Human-Only Steps — paulprae.com Deployment

> **Updated:** 2026-03-01
> **Status:** Site deployed at https://paulprae-com-one.vercel.app/ — custom domain DNS pending

These steps require human action (browser logins, DNS panels, design decisions). They cannot be automated by Claude Code.

---

## 1. Custom Domain DNS (In Progress)

**Where:** https://panel.dreamhost.com/index.cgi?tree=domain.dashboard#/site/paulprae.com/dns

Add these DNS records at DreamHost:

| Type  | Name             | Value                | TTL  |
| ----- | ---------------- | -------------------- | ---- |
| A     | paulprae.com     | 76.76.21.21          | 3600 |
| CNAME | www.paulprae.com | cname.vercel-dns.com | 3600 |

**After adding records:**

1. In Vercel Dashboard > Project > Settings > Domains: add `paulprae.com` and `www.paulprae.com`
2. Vercel will verify DNS and auto-provision SSL (1-5 minutes after propagation)
3. Verify: `dig paulprae.com A` should return `76.76.21.21`
4. Verify: `curl -I https://paulprae.com` should return 200 with valid SSL

**DreamHost note:** If DreamHost has existing A records or hosting configured for paulprae.com, you may need to remove their default records first. DreamHost's "DNS Only" hosting mode is ideal for Vercel-hosted sites.

---

## 2. OG Image

Create a 1200x630 PNG for social media link previews (Slack, LinkedIn, Twitter).

**Options:**

- AI-generated via DALL-E, Midjourney, or Ideogram
- Text-on-gradient using Figma, Canva, or a simple HTML-to-image tool
- Minimalist: name + title + subtle tech pattern on dark background

**Requirements:**

- Save to `public/og-image.png`
- Already wired in `app/layout.tsx` metadata (openGraph.images and twitter.images)
- Test with: https://www.opengraph.xyz/ after deploying

---

## 3. Favicon

Add a favicon for browser tabs and bookmarks.

**Options:**

- "PP" monogram or initials design
- SVG favicon (`public/favicon.svg`) for modern browsers
- ICO fallback (`public/favicon.ico`) for legacy browsers
- Generate from text at https://favicon.io/favicon-generator/

---

## 4. Cross-Platform Profile Links

Update external profiles to point to the live site:

- [ ] **LinkedIn:** Edit profile > Contact info > Website > `https://paulprae.com`
- [ ] **GitHub:** Profile settings > Website > `https://paulprae.com`
- [ ] **GitHub repo:** Update repo description/URL at github.com/praeducer/paulprae-com

---

## 5. Vercel Project Settings (Already Done)

These were completed during initial setup:

- [x] Import `praeducer/paulprae-com` repo
- [x] Framework Preset: Other (not Next.js — static export needs plain static serving)
- [x] Build Command: `npm run build`
- [x] Output Directory: `out`
- [x] No `ANTHROPIC_API_KEY` needed in Vercel env vars

---

## 6. Update CLAUDE.md and README After DNS Propagates

Once `paulprae.com` resolves correctly:

1. Update `CLAUDE.md` line 9: remove "DNS pending"
2. Update `README.md` deployment section: remove "DNS pending"
3. Update `vercel.json` ignoreCommand if needed
4. Test all download links at the custom domain

---

## 7. GitHub Actions Secret (Phase 2 — Not Needed Now)

When automated CI/CD regeneration is added in Phase 2:

1. Repo Settings > Secrets and variables > Actions > New repository secret
2. Name: `ANTHROPIC_API_KEY`, value: your API key
3. Only needed for automated pipeline runs in CI
