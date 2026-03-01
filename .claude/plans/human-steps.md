# Human-Only Steps — paulprae.com Deployment

> **Updated:** 2026-03-01
> **Status:** Site deployed at https://paulprae-com-one.vercel.app/ — custom domain DNS pending

These steps require human action (browser logins, DNS panels, design decisions). They cannot be automated by Claude Code.

---

## 1. Custom Domain DNS Configuration (IN PROGRESS — DO THIS FIRST)

The Vercel deployment is live and waiting on DreamHost DNS. This section walks through
every change needed in DreamHost, explains what to keep and why, and what to verify after.

### 1.1 Context: What's Happening

- **Vercel** hosts paulprae.com (static Next.js site deployed from this repo)
- **DreamHost** manages DNS for paulprae.com (nameservers stay at DreamHost)
- **Office 365 / Outlook** handles email (paul@paulprae.com, hireme@paulprae.com)
- **Ghost (prae.ghost.io)** still hosts blog.paulprae.com

The current DreamHost DNS points the root domain and www to old Ghost/DigitalOcean IPs.
We need to redirect them to Vercel while preserving email and blog records.

### 1.2 DreamHost DNS: Records to MODIFY (2 changes)

Go to: https://panel.dreamhost.com/index.cgi?tree=domain.dashboard#/site/paulprae.com/dns

#### Change 1: Root A Record (paulprae.com)

| Field | Old Value | New Value |
|-------|-----------|-----------|
| Name  | `@`       | `@`       |
| Type  | A         | A         |
| Value | `178.128.137.126` | **`216.198.79.1`** |

**How:** Click the pencil/edit icon on the `@ A 178.128.137.126` row. Change the value to `216.198.79.1`. Save.

**Why:** The old IP (178.128.137.126) was a DigitalOcean droplet for the old Ghost site. The new IP is Vercel's.

#### Change 2: www CNAME Record (www.paulprae.com)

| Field | Old Value | New Value |
|-------|-----------|-----------|
| Name  | `www`     | `www`     |
| Type  | CNAME     | CNAME     |
| Value | `paulprae.ghost.io.` | **`d534831e0ceab67a.vercel-dns-017.com.`** |

**How:** Click the pencil/edit icon on the `www CNAME paulprae.ghost.io.` row. Change the value to `d534831e0ceab67a.vercel-dns-017.com.`. Save.

**Why:** www was pointing to Ghost. Now it points to Vercel, which serves the static site and redirects www to the apex domain (307 redirect configured in Vercel).

### 1.3 DreamHost DNS: Records to REMOVE (4 deletions)

These are legacy records from old Azure and Ghost hosting. They serve no current purpose
and create confusion in the DNS panel.

| # | Name | Type | Value | Why Remove |
|---|------|------|-------|------------|
| 1 | `test` | A | `13.92.40.39` | Old Azure VM test server. No longer in use. |
| 2 | `cdn` | CNAME | `az793767.vo.msecnd.net.` | Old Azure CDN endpoint. No longer in use. |
| 3 | `portfolio` | CNAME | `praeducer.ghost.io.` | Old Ghost portfolio site. No longer needed. |
| 4 | `test` | TXT | `paulprae.eastus.cloudapp.azure.com` | Old Azure domain verification. No longer needed. |

**How:** For each row, click the pencil/edit icon and look for a delete/remove option. DreamHost
typically shows a trash icon or "Delete Record" button in the edit view.

### 1.4 DreamHost DNS: Records to KEEP (do NOT touch these)

These records are critical for email delivery and other active services.

| Name | Type | Value | Why Keep |
|------|------|-------|----------|
| `@` | TXT | `MS=ms21247817` | **Office 365 domain verification.** Proves you own paulprae.com for Microsoft. |
| `@` | TXT | `v=spf1 include:spf.protection.outlook.com -all` | **Email SPF record.** Authorizes Outlook to send email as @paulprae.com. Removing this will cause emails to land in spam. |
| `autodiscover` | CNAME | `autodiscover.outlook.com.` | **Outlook email auto-configuration.** Lets email clients (Outlook, mobile) auto-discover mailbox settings. |
| `blog` | CNAME | `prae.ghost.io.` | **Active blog.** blog.paulprae.com still serves content from Ghost. |
| `@` | MX | `0 Paulprae-com.mail.protection.outlook.com.` | **Email routing.** All inbound email (paul@, hireme@) routes through this. **DO NOT DELETE.** |
| `@` | NS | `ns1/ns2/ns3.dreamhost.com.` | **Nameservers.** Removing these breaks ALL DNS. **NEVER DELETE.** |

### 1.5 Final DNS State After Changes

After completing all modifications and deletions, your Custom Records should look like this:

| Name | Type | Value |
|------|------|-------|
| `@` | A | `216.198.79.1` |
| `autodiscover` | CNAME | `autodiscover.outlook.com.` |
| `blog` | CNAME | `prae.ghost.io.` |
| `www` | CNAME | `d534831e0ceab67a.vercel-dns-017.com.` |
| `@` | TXT | `MS=ms21247817` |
| `@` | TXT | `v=spf1 include:spf.protection.outlook.com -all` |

And your DreamHost-managed records stay unchanged:

| Name | Type | Value |
|------|------|-------|
| `@` | MX | `0 Paulprae-com.mail.protection.outlook.com.` |
| `@` | NS | `ns1.dreamhost.com.` |
| `@` | NS | `ns2.dreamhost.com.` |
| `@` | NS | `ns3.dreamhost.com.` |

**Total: 6 custom records (down from 10) + 4 DreamHost-managed records.**

### 1.6 Verify on Vercel

After saving DNS changes in DreamHost:

1. Go to: https://vercel.com/praeducers-projects/paulprae-com/settings/domains
2. Click **Refresh** next to both `paulprae.com` and `www.paulprae.com`
3. Wait for status to change from "Invalid Configuration" to "Valid Configuration"
4. DNS propagation typically takes 5-30 minutes, but can take up to 48 hours
5. Vercel auto-provisions SSL certificates once DNS validates

### 1.7 Verify Everything Works

Run these checks after Vercel shows "Valid Configuration":

**Website routing:**
```bash
# Root domain resolves to Vercel
dig paulprae.com A
# Expected: 216.198.79.1

# www redirects to root (307)
curl -I https://www.paulprae.com
# Expected: HTTP/2 307, Location: https://paulprae.com

# Site loads with valid SSL
curl -I https://paulprae.com
# Expected: HTTP/2 200, valid certificate

# Resume downloads work
curl -I https://paulprae.com/Paul-Prae-Resume.pdf
# Expected: HTTP/2 200, content-type: application/pdf
```

**Email still works (critical):**
```bash
# MX record intact
dig paulprae.com MX
# Expected: 0 Paulprae-com.mail.protection.outlook.com.

# SPF record intact
dig paulprae.com TXT
# Expected: includes "v=spf1 include:spf.protection.outlook.com -all"

# Send a test email to paul@paulprae.com from an external account
# Send a test email FROM paul@paulprae.com to an external account
# Both should work without landing in spam
```

**Blog still works:**
```bash
# Blog subdomain resolves
dig blog.paulprae.com CNAME
# Expected: prae.ghost.io.

# Blog loads
curl -I https://blog.paulprae.com
# Expected: HTTP/2 200
```

### 1.8 Troubleshooting

- **Vercel still shows "Invalid Configuration" after 1 hour:** Check that DreamHost doesn't have conflicting records. Use `dig paulprae.com A` to confirm the new IP is propagated. Try `dig @8.8.8.8 paulprae.com A` to check Google DNS specifically.
- **SSL certificate error:** Vercel provisions SSL automatically but only after DNS validates. Give it up to 1 hour after DNS propagates.
- **Email broken after changes:** Verify MX, SPF TXT, and autodiscover CNAME are still present. These should not have been touched. If accidentally deleted, re-add them immediately (values in section 1.4).
- **blog.paulprae.com broken:** Verify `blog CNAME prae.ghost.io.` still exists.

### 1.9 Rollback Plan

If something goes critically wrong and you need to revert:

| Record | Revert To |
|--------|-----------|
| `@ A` | `178.128.137.126` (old DigitalOcean/Ghost IP) |
| `www CNAME` | `paulprae.ghost.io.` (old Ghost site) |

This restores the pre-migration state. The deleted test/cdn/portfolio records are not needed for rollback.

---

## 2. Post-DNS: Update Repo References

Once `paulprae.com` resolves correctly and Vercel shows "Valid Configuration":

1. Update `CLAUDE.md` line mentioning "DNS pending" — remove that note
2. Update `README.md` deployment section — change URL to `https://paulprae.com`
3. Update `.claude/plans/backlog.md` status line
4. Test all download links at the custom domain

---

## 3. OG Image

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

## 4. Favicon

Add a favicon for browser tabs and bookmarks.

**Options:**

- "PP" monogram or initials design
- SVG favicon (`public/favicon.svg`) for modern browsers
- ICO fallback (`public/favicon.ico`) for legacy browsers
- Generate from text at https://favicon.io/favicon-generator/

---

## 5. Cross-Platform Profile Links

Update external profiles to point to the live site:

- [ ] **LinkedIn:** Edit profile > Contact info > Website > `https://paulprae.com`
- [ ] **GitHub:** Profile settings > Website > `https://paulprae.com`
- [ ] **GitHub repo:** Update repo description/URL at github.com/praeducer/paulprae-com

---

## 6. Vercel Project Settings (Already Done)

These were completed during initial setup:

- [x] Import `praeducer/paulprae-com` repo
- [x] Framework Preset: Other (not Next.js -- static export needs plain static serving)
- [x] Build Command: `npm run build`
- [x] Output Directory: `out`
- [x] No `ANTHROPIC_API_KEY` needed in Vercel env vars

---

## 7. GitHub Actions Secret (Phase 2 -- Not Needed Now)

When automated CI/CD regeneration is added in Phase 2:

1. Repo Settings > Secrets and variables > Actions > New repository secret
2. Name: `ANTHROPIC_API_KEY`, value: your API key
3. Only needed for automated pipeline runs in CI
