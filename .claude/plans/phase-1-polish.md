# Phase 1 Polish — Remaining Post-Deployment Tasks

> **Created:** 2026-02-28
> **Context:** Extracted from `docs/next-steps-planning-prompt.md` (now deleted; preserved in git history at commit 97d8f69+). These are optional post-deployment improvements — the core pipeline and site are fully functional.

---

## Public Assets (Favicon & OG Image)

`public/` directory is currently empty. Adding these improves link previews and browser tab branding.

1. **Favicon:** Add `favicon.ico` or `favicon.svg` to `public/`. A simple monogram "PP" or initials-based design works.
2. **OG Image:** Create `public/og-image.png` (1200x630px) for social media link previews. Update `app/layout.tsx` metadata:
   ```typescript
   openGraph: {
     images: [{ url: '/og-image.png', width: 1200, height: 630 }],
   }
   ```
3. **Apple Touch Icon:** Optional but recommended for iOS bookmarks.

---

## Analytics

Add privacy-respecting analytics to track recruiter engagement:
- **Vercel Analytics** (built-in, zero-config): Page views, visitors, referrers
- **Plausible or Fathom** (privacy-first alternatives)
- Note: May require removing `output: 'export'` or using a client-side script

---

## Sitemap & robots.txt

For SEO:
1. Add `public/robots.txt`:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://paulprae.com/sitemap.xml
   ```
2. Add `public/sitemap.xml` (single-page site):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url><loc>https://paulprae.com/</loc></url>
   </urlset>
   ```

---

## Linting & Formatting

Not in Phase 1 MVP scope but recommended before Phase 2:
- **ESLint** with Next.js config (`next lint`)
- **Prettier** for consistent formatting
- Add to pre-commit hooks
