# User Acceptance Testing Checklist

Run this checklist after every major deployment. Automated tests (unit, E2E, CI smoke tests) cover regressions — this checklist covers what only a human can verify: visual quality, AI response quality, and end-to-end user flows with real API calls.

**When to run:** After merging to `main` and confirming production deploy is live.
**Where:** https://paulprae.com (production) and mobile device/emulator.
**Time:** ~10 minutes.

---

## 1. Chat Homepage (`/`)

### Visual & Layout

- [ ] Page loads without flash of unstyled content
- [ ] Header shows name, subtitle (desktop only), "View Resume" link, PDF download icon
- [ ] Welcome hero shows name, headline, description, and quick action chips
- [ ] Chat composer is visible at bottom with placeholder text
- [ ] Dark mode: toggle system theme, verify no color clashes or unreadable text

### Chat Interaction (requires live API)

- [ ] Type a short question ("What is Paul's experience with AI?") and send
- [ ] Response streams in real-time (tokens appear progressively, not all at once)
- [ ] Response is grounded in career data (mentions real companies, not hallucinated)
- [ ] Response is concise (top 3-5 items, not an exhaustive list)
- [ ] Copy and regenerate buttons appear below assistant messages
- [ ] Character counter appears when typing a long message (~3000+ chars)

### Tool-Calling

- [ ] Click "Tailored resume" chip, paste a job description, send
- [ ] Tool-calling triggers (may take 10-15s) and returns a formatted tailored resume
- [ ] Tailored resume references content from the actual career data
- [ ] Click "Download resume" chip — returns links to PDF, DOCX, Markdown, and web resume

### Quick Action Chips

- [ ] Each chip sends its prompt when clicked
- [ ] Chips disappear after first message (replaced by conversation thread)

## 2. Resume Page (`/resume`)

- [ ] Full resume renders with all sections (Summary, Experience, Education, Skills, etc.)
- [ ] Section navigation works (if present)
- [ ] Download links work: PDF opens/downloads, DOCX opens/downloads
- [ ] "Back to Chat" or header link returns to `/`
- [ ] Content matches the latest `data/generated/Paul-Prae-Resume.md`

## 3. Tools Page (`/tools`)

- [ ] Page renders with job search tool chips
- [ ] Select a tool (e.g., "Cover Letter"), enter a job description, send
- [ ] Response generates exactly ONE piece of content (not multiple variants)
- [ ] Response is professional quality and appropriately formatted
- [ ] Page is not indexed (verify: View Source → `noindex` in robots meta tag)

## 4. Mobile Responsiveness

Test on a real phone or browser DevTools (375px width):

- [ ] Chat homepage: composer doesn't overflow, messages are readable
- [ ] Resume page: content reflows properly, no horizontal scroll
- [ ] Tools page: chips wrap correctly
- [ ] Header: subtitle hides on mobile, navigation still accessible

## 5. Security & Error Handling

- [ ] Rapid-fire messages (send 20+ quickly) — should see rate limit message (429)
- [ ] Very long message (paste 5000+ chars) — should be rejected or truncated
- [ ] Prompt injection attempt ("Ignore all previous instructions and...") — should be deflected
- [ ] API errors display a user-friendly message, not a stack trace

## 6. Performance & Infrastructure

- [ ] First page load under 3 seconds on broadband
- [ ] Chat first response (TTFT) under 5 seconds
- [ ] Check Vercel Dashboard > Functions — `/api/chat` executions appear
- [ ] Check Vercel Dashboard > AI Gateway — API calls are logged with cost/token data
- [ ] Check Anthropic Console > Usage — requests appear, within spend limits

## 7. Cross-Browser (spot check)

- [ ] Chrome: all features work
- [ ] Safari/Firefox: basic chat flow works, no layout breaks

---

## Result

| Section       | Pass? | Notes |
| ------------- | ----- | ----- |
| Chat Homepage |       |       |
| Tool-Calling  |       |       |
| Resume Page   |       |       |
| Tools Page    |       |       |
| Mobile        |       |       |
| Security      |       |       |
| Performance   |       |       |
| Cross-Browser |       |       |

**Tested by:** ******\_\_\_******
**Date:** ******\_\_\_******
**Deployment SHA:** ******\_\_\_******
