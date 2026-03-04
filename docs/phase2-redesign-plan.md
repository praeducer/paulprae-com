# Plan: Redesign Phase 2 — Chat-First Homepage with Job Search Tools

## Context

The Phase 2 plans (2A/2B/2C) need a significant update to reflect three new requirements:

1. **Chat becomes the homepage** (`/`) and the resume moves to `/resume`
2. **The AI assistant must handle the full job-finding workflow** — not just recruiter Q&A but all outbound content generation (cover letters, LinkedIn messages, STAR answers, etc.)
3. **Use pre-built, authoritative chat UI components** instead of hand-rolling everything

The knowledge base already contains the complete job-finding-assistant data model (platform constraints, message templates, writing formulas, audience frameworks, agent definitions) at `data/sources/knowledge/`. This data powers the AI agent's content generation capabilities.

---

## Key Decisions

### Chat UI Library: `@assistant-ui/react`

**Winner over alternatives** based on research:

| Library                      | AI SDK 6 Native      | message.parts[] | Requires shadcn | Stars           |
| ---------------------------- | -------------------- | --------------- | --------------- | --------------- |
| **@assistant-ui/react**      | Yes (useChatRuntime) | Yes             | No              | ~8,700          |
| shadcn.io/ai (AI Elements)   | Yes                  | Yes             | Yes             | Vercel official |
| shadcn-chatbot-kit (Blazity) | Partial              | Partial         | Yes             | 755             |
| chatscope                    | No                   | No              | No              | 1,700           |

**Why assistant-ui wins for this project:**

- Works with existing Tailwind — no shadcn/ui initialization needed (CLAUDE.md rule respected)
- The `Thread` component is a genuine drop-in: `useChatRuntime({ api })` + `<Thread />`
- Handles streaming, markdown, code blocks, reasoning blocks, tool calls, auto-scroll, copy, retry — all built-in
- Radix-primitive architecture allows deep customization without fighting the library
- MIT licensed, actively maintained, has an explicit `with-ai-sdk-v6` example
- `@assistant-ui/react-markdown` or `@assistant-ui/react-streamdown` for rich rendering

**New dependencies (Plan 2B):**

```
@assistant-ui/react
@assistant-ui/react-ai-sdk
@assistant-ui/react-markdown (or @assistant-ui/react-streamdown)
```

### Route Restructuring

| Route      | Content                              | Rendering                                      |
| ---------- | ------------------------------------ | ---------------------------------------------- |
| `/` (home) | Chat interface with mode toggle      | Dynamic (client component, useChat)            |
| `/resume`  | Full resume (moved from current `/`) | Static pre-render (unchanged server component) |

### Two Modes on the Homepage

| Mode                   | Audience                              | System Prompt                   | Default                  |
| ---------------------- | ------------------------------------- | ------------------------------- | ------------------------ |
| **"Ask About Paul"**   | Recruiters, hiring managers, visitors | Third-person career Q&A         | Yes (public default)     |
| **"Job Search Tools"** | Paul (site owner)                     | First-person content generation | Via toggle or `?tools=1` |

No authentication needed — tools mode is a simple toggle. The knowledge base is Paul's own career data (already public). Phase 3 adds Supabase Auth if gating is desired.

---

## User Stories

### Recruiter Stories (Ask About Paul mode)

| ID  | Story                                                                                                                                  | Sprint |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| R1  | As a recruiter, I want a welcome message that summarizes Paul's value proposition, so I can decide in 30 seconds whether to dig deeper | 1      |
| R2  | As a recruiter, I want to ask about specific skills (e.g., "does Paul know Snowflake?") and get a cited yes/no with evidence           | 1      |
| R3  | As a recruiter, I want to download Paul's resume in PDF/DOCX/MD from within the chat                                                   | 1      |
| R4  | As a hiring manager, I want to deep-dive into Paul's technical experience at specific companies                                        | 2      |
| R5  | As a hiring manager, I want to see quantified project outcomes for building a business case                                            | 2      |
| R6  | As a recruiter, I want to request a tailored resume for a specific JD and get it in 30-60 seconds                                      | 2      |

### Job Search Tools Stories (Paul's workspace)

| ID  | Story                                                         | Content Type        | Platform Constraints               | Sprint |
| --- | ------------------------------------------------------------- | ------------------- | ---------------------------------- | ------ |
| P1  | Generate a tailored cover letter from a JD                    | Cover letter        | 1 page / 300-500 words             | 3      |
| P2  | Generate a LinkedIn connection request                        | LinkedIn connection | 300 chars                          | 3      |
| P3  | Generate a LinkedIn InMail with subject line                  | LinkedIn InMail     | 1900 chars body, 200 chars subject | 3      |
| P4  | Generate a cold email introduction                            | Email               | 50 char subject, 150-300 word body | 3      |
| P5  | Generate a thank-you note after an interview                  | Email               | 150-250 words                      | 3      |
| P6  | Generate a follow-up after no response                        | Email/LinkedIn      | Per follow_up_cadence rules        | 3      |
| P7  | Respond to recruiter outreach (advance or decline)            | Email/LinkedIn      | Platform-specific                  | 3      |
| P8  | Generate STAR-format interview answers                        | Interview prep      | 300-500 words (1.5-2 min spoken)   | 4      |
| P9  | Generate elevator pitches (30s and 60s variants)              | Networking          | 75 words / 150 words               | 4      |
| P10 | Generate job application short-answer responses               | Application form    | User-specified word/char limit     | 4      |
| P11 | Generate networking event talking points                      | Networking          | Structured briefing card           | 4      |
| P12 | Generate salary negotiation scripts                           | Interview prep      | Structured talking points          | 4      |
| P13 | Generate a tailored resume for a specific JD (Paul's own use) | Resume              | ≤ 2 pages                          | 2      |

### Cross-Cutting Requirements

- **Copy-to-clipboard on every output** — platform-aware (strips markdown for LinkedIn/SMS, preserves for email)
- **Character count display** — real-time, sourced from `data/sources/knowledge/content/platform-constraints.json`
- **Grounding** — all factual claims sourced from career data (G1-G8 rules preserved)
- **Streaming** — all responses stream token-by-token
- **Mobile responsive** — all templates usable on 375px width

---

## Updated Plan 2A: Backend Changes

### New: Multiple System Prompts

The agent needs three system prompt modes, not one:

| Prompt                       | Route/Mode                 | Model      | Purpose                                   |
| ---------------------------- | -------------------------- | ---------- | ----------------------------------------- |
| `career-chat.system.md`      | `/api/chat` (default mode) | Sonnet 4.6 | Recruiter Q&A, third-person               |
| `job-tools.system.md`        | `/api/chat` (tools mode)   | Sonnet 4.6 | Content generation, first-person for Paul |
| `resume-generator.system.md` | `/api/resume`              | Opus 4.6   | Tailored resume generation                |

### New: Mode Parameter on Chat Route

```typescript
// app/api/chat/route.ts
export async function POST(request: Request) {
  const { messages, mode } = await request.json(); // mode: "chat" | "tools"
  const systemPrompt = mode === "tools" ? jobToolsPrompt : careerChatPrompt;
  // ... streamText with appropriate prompt
}
```

### New: Knowledge Base in Agent Context

The agent's cached system prompt must include data from:

- `data/sources/knowledge/content/platform-constraints.json` — character limits per platform
- `data/sources/knowledge/content/message-templates.json` — effective openings, closings, credibility builders
- `data/sources/knowledge/content/writing-formulas.json` — STAR, AIDA, PAS, BAB formulas
- `data/sources/knowledge/strategy/audience-frameworks.json` — per-audience messaging guidelines
- `data/sources/knowledge/brand/*` — communication styles, personality, values

These are loaded alongside career data in `buildCareerContext()` and embedded in the system prompt for prompt caching.

### New: Tools for the Agent

```typescript
const agentTools = {
  generate_resume: {
    /* Opus 4.6 resume generation */
  },
  get_resume_links: {
    /* Returns download URLs for PDF/DOCX/MD */
  },
  get_platform_constraints: {
    /* Returns char limits for a given platform */
  },
};
```

### Unchanged from Current Plan 2A

- Vercel Fluid Compute architecture
- AI SDK 6 with ToolLoopAgent
- AI Gateway as default provider
- Upstash rate limiting
- Prompt caching strategy
- Career data package extraction

---

## Updated Plan 2B: Frontend Redesign

### New Dependencies

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk @assistant-ui/react-markdown
```

### Route Changes

| File                                   | Purpose                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `app/page.tsx`                         | **New homepage** — chat interface with assistant-ui Thread component |
| `app/resume/page.tsx`                  | **Moved resume** — extracted from current `app/page.tsx`             |
| `app/resume/components/SectionNav.tsx` | Moved from `app/components/`                                         |
| `app/resume/components/BackToTop.tsx`  | Moved from `app/components/`                                         |

### Homepage Architecture (`app/page.tsx`)

```
┌──────────────────────────────────────────────────┐
│  paulprae.com        [Ask About Paul] [Tools ⚙]  │
│                      [View Resume →] [PDF ↓]      │
├──────────────────────────────────────────────────┤
│                                                    │
│  <AssistantRuntimeProvider runtime={chatRuntime}>  │
│    <Thread />  ← assistant-ui drop-in component   │
│  </AssistantRuntimeProvider>                       │
│                                                    │
│  Quick actions (mode-specific chips)               │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Client Component (`app/components/ChatHome.tsx`)

```typescript
"use client";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@assistant-ui/react";
import { useState } from "react";

export default function ChatHome() {
  const [mode, setMode] = useState<"chat" | "tools">("chat");

  const runtime = useChatRuntime({
    api: "/api/chat",
    body: { mode },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ModeToggle mode={mode} onModeChange={setMode} />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

**What assistant-ui's Thread handles automatically:**

- Message list with auto-scroll
- Streaming text with cursor animation
- Markdown rendering (react-markdown integration)
- Code blocks with syntax highlighting
- Reasoning/thinking blocks (collapsible)
- Tool call indicators
- Copy button on every message
- Retry/regenerate actions
- Composer input with auto-resize
- Mobile responsive layout
- Dark mode support
- Keyboard navigation

**What we customize on top of Thread:**

- Mode toggle (Ask About Paul / Job Tools)
- Quick action chips (mode-specific)
- Resume download buttons in header
- Character count display for job tools output
- Platform-aware copy (strip markdown for LinkedIn/SMS)
- Welcome message with suggested questions

### Job Tools Mode UX

When in "Job Tools" mode, quick action chips change to template launchers:

**Row 1 — Outreach:** Cover Letter | LinkedIn Connection | LinkedIn InMail | Email Intro
**Row 2 — Follow-up:** Thank You Note | Follow-Up | Recruiter Response
**Row 3 — Prep:** STAR Answer | Elevator Pitch | Talking Points | Negotiation
**Row 4 — Application:** Short Answer | Tailored Resume

Clicking a template pre-fills the chat input with a structured prompt (e.g., "Generate a LinkedIn connection request for [name] at [company]") and optionally shows a structured form overlay for required fields.

### Copy-to-Clipboard Enhancement

Every AI response in tools mode gets a copy button. The copy behavior is platform-aware:

| Platform Context    | Copy Behavior                                         |
| ------------------- | ----------------------------------------------------- |
| LinkedIn connection | Strip markdown → plain text, show char count          |
| Email               | Preserve basic formatting, separate subject/body copy |
| STAR answer         | Full markdown copy + section-level copy               |
| Cover letter        | "Copy as plain text" + "Copy as Markdown"             |

Implementation: Use assistant-ui's `ActionBarPrimitive` to add custom copy actions that detect the content type from the AI response metadata.

### Resume Page (`app/resume/page.tsx`)

Extract all resume rendering logic from current `app/page.tsx`:

- Same server component pattern (reads markdown at build time)
- SectionNav and BackToTop components move to `app/resume/components/`
- Add "Chat with AI" navigation link in header
- All existing resume styling preserved (`resume-prose` class in globals.css)

### Navigation

| From               | To                 | Element                                   |
| ------------------ | ------------------ | ----------------------------------------- |
| Homepage (`/`)     | Resume (`/resume`) | "View Resume →" button in chat header     |
| Homepage (`/`)     | Resume downloads   | "PDF ↓" / "DOCX ↓" buttons in chat header |
| Resume (`/resume`) | Homepage (`/`)     | "Chat with AI ←" link in resume header    |

### Metadata Updates

- `/` metadata: "Paul Prae — AI Career Assistant | paulprae.com"
- `/resume` metadata: "Paul Prae — Resume | Principal AI Engineer & Solutions Architect"
- OpenGraph: `/` gets a chat-themed og:description, `/resume` keeps the current one
- JSON-LD: stays on `/resume` (Person schema for structured data)

---

## Updated Plan 2C: DevOps Changes

### Additional CI Validation

- Verify both `/` and `/resume` routes exist in build output
- Verify `/api/chat` route exists
- Update sitemap.xml to include `/resume`

### CSP Update

```
connect-src 'self' https://paulprae.com
```

(Same as before — both routes use same-origin API calls)

### Robots/Sitemap

```xml
<!-- sitemap.xml -->
<url><loc>https://paulprae.com/</loc></url>
<url><loc>https://paulprae.com/resume</loc></url>
```

---

## QA, Testing, and Validation Strategy

### Unit Tests

| Test File                     | Coverage                                                |
| ----------------------------- | ------------------------------------------------------- |
| `tests/agent-context.test.ts` | buildCareerContext(), knowledge base loading            |
| `tests/agent-prompts.test.ts` | System prompt loading for all 3 modes                   |
| `tests/chat-home.test.tsx`    | ChatHome component, mode toggle, quick actions          |
| `tests/resume-page.test.tsx`  | Resume page rendering (moved from current page tests)   |
| `tests/agent-api.test.ts`     | API routes: POST, mode param, rate limiting, SSE format |

### Integration Tests (E2E)

| Test                       | What It Validates                                                        |
| -------------------------- | ------------------------------------------------------------------------ |
| Chat flow: recruiter Q&A   | Send "what does Paul do?" → verify streaming response with career data   |
| Chat flow: skill inquiry   | Send "does Paul know Snowflake?" → verify cited answer                   |
| Chat flow: resume download | Send "can I get your resume?" → verify download links in response        |
| Chat flow: tailored resume | Send JD → verify Opus generation completes within timeout                |
| Tools flow: cover letter   | Select cover letter template → paste JD → verify output with copy button |
| Tools flow: LinkedIn msg   | Select LinkedIn connection → verify output ≤ 300 chars                   |
| Route: `/resume`           | Verify resume renders, SectionNav works, downloads work                  |
| Route: `/` → `/resume` nav | Verify bidirectional navigation                                          |
| Rate limiting              | Send 21 requests in 1 minute → verify 429 on 21st                        |
| Error recovery             | Kill API mid-stream → verify retry button appears                        |

---

## Sprint Plan Summary

| Sprint                             | Stories                                             | Branch                                              |
| ---------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| **1: MVP**                         | R1, R2, R3 + backend foundation + route restructure | `feat/phase2a-backend`                              |
| **2: Full Recruiter + Resume Gen** | R4, R5, R6, P13                                     | continues on same branch or `feat/phase2b-frontend` |
| **3: Job Tools Core**              | P1-P7 (outreach + follow-up content types)          | continues frontend work                             |
| **4: Interview Prep**              | P8-P12 (STAR, elevator pitch, negotiation, etc.)    | continues frontend work                             |
| **5: Polish + DevOps**             | Plan 2C, docs, CI/CD, final QA                      | `feat/phase2c-devops`                               |

---

## Files to Modify (Summary)

### Plan 2A (backend)

- `lib/prompts/career-chat.system.md` — recruiter Q&A prompt
- `lib/prompts/job-tools.system.md` — **new** content generation prompt
- `lib/agent/context.ts` — load knowledge base content (platform constraints, templates, etc.)
- `lib/agent/tools.ts` — add `get_resume_links`, `get_platform_constraints`
- `app/api/chat/route.ts` — accept `mode` parameter, switch system prompts

### Plan 2B (frontend)

- `app/page.tsx` — **replace** with chat homepage using assistant-ui
- `app/resume/page.tsx` — **new** (extracted from current page.tsx)
- `app/resume/components/SectionNav.tsx` — **moved** from `app/components/`
- `app/resume/components/BackToTop.tsx` — **moved** from `app/components/`
- `app/components/ChatHome.tsx` — **new** main chat client component
- `app/components/ModeToggle.tsx` — **new** Ask About Paul / Job Tools toggle
- `app/components/QuickActions.tsx` — **new** mode-specific action chips
- `app/layout.tsx` — update metadata for multi-page site
- `app/globals.css` — keep resume-prose styles, add any chat overrides
- `package.json` — add `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `@assistant-ui/react-markdown`

### Plan 2C (devops)

- `vercel.json` — CSP, headers
- `.github/workflows/ci.yml` — validate both `/` and `/resume` routes
- `public/sitemap.xml` — add `/resume` URL
- `CLAUDE.md`, `README.md`, `docs/technical-design-document.md` — update for new routes

---

## Implementation Status

### Sprint 1 Progress (feat/phase2-implementation branch)

**Completed:**

- [x] Route restructure: `/` is chat homepage, `/resume` is resume page
- [x] `next.config.ts` — removed `output: 'export'` for dynamic rendering
- [x] Installed Phase 2 dependencies: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`, `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `@assistant-ui/react-markdown`, `@upstash/ratelimit`, `@upstash/redis`
- [x] `app/resume/page.tsx` — full resume page extracted from original `app/page.tsx`
- [x] `app/resume/components/SectionNav.tsx` + `BackToTop.tsx` — moved from `app/components/`
- [x] `app/page.tsx` — new chat homepage with metadata
- [x] `app/components/ChatHome.tsx` — main chat client component using `@assistant-ui/react` primitives (ThreadPrimitive, MessagePrimitive, ComposerPrimitive, ActionBarPrimitive)
- [x] `app/components/ModeToggle.tsx` — Ask About Paul / Job Tools toggle
- [x] `app/components/QuickActions.tsx` — mode-specific action chips (4 chat + 8 tools)
- [x] `app/api/chat/route.ts` — POST handler with mode switching, UIMessage stream, Upstash rate limiting (graceful fallback when not configured)
- [x] `lib/prompts/career-chat.system.md` — recruiter Q&A system prompt with grounding rules G1-G8
- [x] `lib/prompts/job-tools.system.md` — content generation system prompt with platform constraints, writing formulas, STAR method
- [x] `lib/agent/context.ts` — loads career-data.json + 5 knowledge base files, assembles system prompts with template injection
- [x] `app/layout.tsx` — updated metadata for multi-page site with template titles
- [x] Bidirectional navigation: "Chat with AI" link on resume, "View Resume" + "PDF ↓" on chat
- [x] TypeScript passes (`tsc --noEmit` — 0 errors)
- [x] Build passes (`npm run build` — all routes present: `/`, `/resume`, `/api/chat`)
- [x] All 315 existing tests pass (`npm test`)
- [x] ESLint passes (0 errors, 1 pre-existing warning)

**Not yet done (remaining Sprint 1 work):**

- [ ] Delete old `app/components/SectionNav.tsx` and `app/components/BackToTop.tsx` (dead code after move)
- [ ] Set `ANTHROPIC_API_KEY` env var and test live chat end-to-end
- [ ] Update `public/sitemap.xml` with `/resume` route
- [ ] Update `CLAUDE.md` for Phase 2 conventions (new routes, API route, dynamic rendering)
- [ ] Update `docs/technical-design-document.md` with Phase 2 architecture
- [ ] Write unit tests for `lib/agent/context.ts` (buildCareerContext, buildSystemPrompt, stripEmpty)
- [ ] Write unit tests for API route (mode switching, rate limiting, error handling)
- [ ] Write tests for ChatHome component (mode toggle, quick actions rendering)

**Sprint 2+ backlog (not started):**

- [ ] Agent tools: `get_resume_links`, `get_platform_constraints`, `generate_resume`
- [ ] `resume-generator.system.md` — tailored resume generation prompt (Opus 4.6)
- [ ] `/api/resume` route for tailored resume generation
- [ ] Platform-aware copy-to-clipboard (strip markdown for LinkedIn, preserve for email)
- [ ] Character count display on tools mode output
- [ ] Welcome message with suggested questions (currently uses empty state + quick actions)
- [ ] Vercel preview deploy and production smoke tests
- [ ] Upstash Redis env vars for production rate limiting
- [ ] CSP headers in `vercel.json`
- [ ] CI validation for both routes
- [ ] Full persona-based QA (Rachel, Henry, Sam, Maya, Alex, Pete)

---

## Verification

After all sprints:

1. `npm test` — all tests pass (unit + integration)
2. `npm run build` — builds successfully
3. `npm run check` — full release checklist passes
4. Visit `/` — chat loads, welcome message appears, quick actions work
5. Visit `/resume` — resume renders with SectionNav, downloads work
6. Send chat message — streaming response with career data
7. Toggle to Job Tools → generate LinkedIn message → verify ≤ 300 chars + copy button
8. Generate tailored resume → verify 30-60s generation with progress indicator
9. Mobile test — both routes usable on 375px viewport
10. Vercel preview deploy — both routes work in production-like environment
