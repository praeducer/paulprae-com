# Human Steps — Phase 2 Setup & v0 Workflow

Tasks requiring manual action, Vercel dashboard configuration, or v0 agent collaboration. Complements the AI-first plans (phase2a/b/c) which are optimized for Claude Code execution.

> **Prerequisites:** Complete the v2.1 human steps first (secrets, metrics, deploy verification).
> **Sequence:** Steps 1-3 can happen in any order. Step 4 after Plan 2A merges. Step 5 after Plan 2B merges. Step 6 after Plan 2C merges.

---

## Step 1: Upgrade to Vercel Pro ($20/mo)

Phase 2 requires Vercel Pro for Fluid Compute (800s function duration for Opus resume generation).

1. Go to: https://vercel.com/account/billing
2. Upgrade to Pro plan ($20/month)
3. Verify: Dashboard shows "Pro" badge

**Why:** Hobby plan has a 10-second function timeout — Opus resume generation takes 30-60 seconds. Pro's Fluid Compute supports up to 800 seconds.

---

## Step 2: Provision Upstash KV for Rate Limiting

1. Go to: https://vercel.com → paulprae-com project → **Storage** → **Create** → **KV**
2. Select Upstash KV (Vercel's integrated Redis provider)
3. Choose the free tier (10,000 requests/day — sufficient for a portfolio site)
4. Click "Create" — Vercel auto-populates `KV_REST_API_URL` and `KV_REST_API_TOKEN` as environment variables
5. Verify: Go to Settings → Environment Variables, confirm both `KV_*` vars exist for Production and Preview

**Why:** Distributed rate limiting across Vercel's edge regions. In-memory rate limiting doesn't work across serverless function instances.

---

## Step 3: Configure AI Gateway (Optional but Recommended)

1. Go to: https://vercel.com → paulprae-com project → **AI** → **Gateway**
2. Enable AI Gateway for the project
3. Copy the generated `AI_GATEWAY_API_KEY`
4. Add it as an environment variable: Settings → Environment Variables → `AI_GATEWAY_API_KEY` (Production + Preview)
5. Set budget alerts: AI → Gateway → Budget → Set monthly alert threshold (e.g., $10)

**Benefits:** Zero-markup model routing, per-call observability, budget controls, ability to hot-swap models from the dashboard without code changes.

---

## Step 4: Use v0 to Prototype Chat UI (During/After Plan 2B)

[v0](https://v0.app) is Vercel's collaborative AI builder. Use it to rapidly prototype the chat interface before or during Plan 2B implementation.

### 4.1 Access v0

1. Open https://v0.app
2. Log in with your Vercel/GitHub account
3. Connect the `praeducer/paulprae-com` repository (v0 → Settings → GitHub)

### 4.2 Prototype the Chat Page

Start a new v0 chat with a prompt like:

> Build a chat interface page for a professional career site. Requirements:
>
> - Full-page `/chat` route for a Next.js App Router site
> - Two modes: "Ask about Paul" (Q&A) and "Generate Resume" (job description input)
> - Uses `useChat` from `@ai-sdk/react` v6 (sendMessage, not append; status not isLoading; message.parts[] not message.content)
> - Message bubbles with markdown rendering via react-markdown
> - Streaming indicator while AI responds
> - Collapsible "thinking" blocks for reasoning parts
> - Clean, minimal Tailwind CSS (no shadcn/ui)
> - Dark mode support
> - Mobile responsive
> - Welcome message with 3 suggested questions
> - "Back to Resume" navigation link

### 4.3 Iterate and Export

- v0 generates a live preview — iterate on layout, colors, spacing
- Ask v0 to adjust specific components ("make the input auto-resize", "add a typing animation")
- When satisfied, export the code to the repo via v0's GitHub integration (creates a PR)
- Refine in Claude Code/Cursor for integration with the actual API routes

### 4.4 What v0 Is Good At (vs Claude Code)

| Task                                                | Best Tool              |
| --------------------------------------------------- | ---------------------- |
| Rapid UI/UX prototyping, visual iteration           | **v0**                 |
| Live preview with instant deploys                   | **v0**                 |
| Iterating with non-dev stakeholders (design review) | **v0**                 |
| Backend logic, API routes, agent code               | **Claude Code**        |
| Multi-file refactoring, test writing                | **Claude Code**        |
| Complex TypeScript, type safety, architecture       | **Claude Code/Cursor** |
| Fine-grained code editing, debugging                | **Cursor**             |

**Pattern:** Prototype UI in v0 → Export scaffold → Integrate backend with Claude Code → Polish in Cursor.

---

## Step 5: Add Vercel Environment Variables for Phase 2

After Plan 2A merges and API routes exist:

1. Go to: https://vercel.com → paulprae-com project → **Settings** → **Environment Variables**
2. Add `ANTHROPIC_API_KEY` for Production + Preview environments (same key from `.env.local`)
3. Verify KV variables from Step 2 are present
4. Verify AI Gateway key from Step 3 is present (if configured)
5. Trigger a deploy and verify the chat API responds

---

## Step 6: Post-Deploy Verification

After Plan 2C merges and production deploys:

1. Visit https://paulprae.com — verify resume page loads correctly
2. Visit https://paulprae.com/chat — verify chat page loads
3. Send a test message: "What is Paul's experience with AI?"
4. Verify streaming response renders correctly
5. Try "Generate Resume" mode with a sample job description
6. Check Vercel dashboard → AI Gateway → verify calls are logged
7. Check Vercel dashboard → Functions → verify Fluid Compute is active
8. Monitor costs for the first few days (Vercel AI → Usage)

---

## Step 7: Update DNS A Record (Carried Forward)

**Status:** Still pending from v2.1 human steps.

1. Log in to panel.dreamhost.com
2. Navigate to Domains → DNS Records
3. Change the A record for `@` from `216.198.79.1` to `76.76.21.21`
4. Wait for propagation (up to 48h)
5. Verify: `dig paulprae.com +short` should return `76.76.21.21`

---

## Cost Summary (Phase 2 Monthly)

| Service       | Cost              | Notes                                             |
| ------------- | ----------------- | ------------------------------------------------- |
| Vercel Pro    | $20/mo            | Required for Fluid Compute                        |
| Upstash KV    | Free tier         | 10K requests/day                                  |
| AI Gateway    | $5/mo free credit | Covers most portfolio-site usage                  |
| Anthropic API | ~$5-20/mo         | Depends on chat traffic; prompt caching saves 90% |
| **Total**     | **~$20-40/mo**    | Scales with usage                                 |
