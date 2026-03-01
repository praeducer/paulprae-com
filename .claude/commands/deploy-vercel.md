---
description: Deploy resume static site to Vercel
allowed-tools: Bash
---

Deploy the single-page resume site to Vercel. The app reads `data/generated/Paul-Prae-Resume.md` at build time.

1. Ensure the resume exists: if not, run `npm run pipeline` (or at least `npm run generate`).
2. Build the static export: `npm run build`
3. Deploy: `npx vercel --prod` (or `vercel --prod` if CLI is installed globally)

Report the deployment URL and any errors. If Vercel is linked to this repo, pushing to `main` may auto-deploy; in that case, building locally and running `vercel --prod` still gives a one-command deploy from the agent.
