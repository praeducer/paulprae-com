---
description: Deploy resume static site to Vercel
allowed-tools: Bash
---

Deploy paulprae.com to Vercel. The app is a server-rendered Next.js site with AI chat (`/api/chat`) and static resume pages.

1. Ensure the resume exists: if not, run `npm run pipeline` (or at least `npm run generate`).
2. Run quality checks: `npm run check`
3. Build: `npm run build`
4. Deploy: `npx vercel --prod` (or `vercel --prod` if CLI is installed globally)

Report the deployment URL and any errors. Pushing to `main` deploys through this repo's GitHub Actions workflows (`CI` -> `Deploy`), not Vercel Git integration.
