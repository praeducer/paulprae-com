# Plan 2B: Frontend — Chat-First Homepage + Resume Route

> **Status:** Sprint 1 COMPLETE on `feat/phase2-implementation`. Sprint 2+ remaining.
> **Sequence:** Plan 2A (backend) → Plan 2B (this) → Plan 2C (devops)
> **Branch:** `feat/phase2-implementation` (combined 2A+2B Sprint 1 work)
> **Depends on:** Plan 2A (API routes must exist at `/api/chat`)
> **Blocks:** Plan 2C (devops needs to know all routes for CSP/CI updates)
> **Authoritative redesign plan:** `docs/phase2-redesign-plan.md` (merged plan with full user stories, QA strategy)

### Claude Code Execution Notes

This plan is optimized for autonomous execution by Claude Code:

```
"Continue Phase 2 frontend work on feat/phase2-implementation branch. Read docs/phase2-redesign-plan.md
for full context including user stories. Sprint 1 is complete — focus on Sprint 2 items:
1. Welcome message enhancement (elegant, memorable, focused on recruiter audience)
2. Tailored resume generation (inline in chat, Opus 4.6, recruiter feature)
3. Component tests (iterative, agile — site always in working state)
4. Cleanup (delete dead components)"
```

- The feature branch builds, 315 tests pass, lint clean
- All components use `@assistant-ui/react` primitives (NOT pre-built `<Thread />`)
- Two routes share `ChatHome` component: `/` (chat) and `/tools` (Paul's tools, noindex)
- Test with `npm run dev` — verify `/` renders chat, `/tools` renders tools, `/resume` renders resume
- Mock the transport layer in component tests

---

## Objective

Build a chat-first homepage at `/` using `@assistant-ui/react` primitives that serves as a **single unified experience** for recruiters, hiring managers, and potential teammates. The chat handles Q&A, resume downloads, and content generation (including tailored resumes). A separate `/tools` route (unlisted, noindex) provides Paul's personal job search tools. The original resume is served at `/resume` with bidirectional navigation.

---

## Architecture Decisions

### @assistant-ui/react (NOT hand-rolled)

> **Changed from original plan:** The original Plan 2B specified hand-rolled chat UI with `useChat` from `@ai-sdk/react`. The redesign uses `@assistant-ui/react` — a Radix-primitive-based chat component library that integrates natively with AI SDK 6.

**Why the change:**

- Handles streaming, markdown, code blocks, auto-scroll, copy, retry — all built-in
- Radix-primitive architecture allows deep customization without fighting the library
- `@assistant-ui/react-ai-sdk` provides `useChatRuntime` that wraps AI SDK transport
- MIT licensed, actively maintained, has explicit AI SDK v6 examples
- Works with existing Tailwind — no shadcn/ui initialization needed

**Key implementation detail:** The library exposes primitives (ThreadPrimitive, MessagePrimitive, ComposerPrimitive, ActionBarPrimitive), NOT a pre-built `<Thread />` component. The implementation builds custom UI from these primitives.

### Route Restructuring

> **Changed from original plan:** Original Plan 2B put chat at `/chat`. The redesign makes chat the homepage (`/`) and moves resume to `/resume`.

| Route      | Content                               | Rendering                            |
| ---------- | ------------------------------------- | ------------------------------------ |
| `/` (home) | Chat interface (recruiter Q&A)        | Dynamic (client component)           |
| `/tools`   | Job search tools (semi-secret)        | Dynamic (client component, noindex)  |
| `/resume`  | Full resume (moved from original `/`) | Static pre-render (server component) |

### Two Modes via Separate Routes

| Mode               | Route    | Audience             | System Prompt            |
| ------------------ | -------- | -------------------- | ------------------------ |
| "Ask About Paul"   | `/`      | Recruiters, visitors | Third-person career Q&A  |
| "Job Search Tools" | `/tools` | Paul (site owner)    | First-person content gen |

No authentication needed — `/tools` is unlisted (noindex) but accessible by URL. Both routes share the same `ChatHome` component with a `mode` prop.

---

## File Structure (Actual Implementation)

```
app/
├── page.tsx                           # Chat homepage — <ChatHome /> (default chat mode)
├── tools/
│   └── page.tsx                       # Job search tools — <ChatHome mode="tools" /> (noindex)
├── resume/
│   ├── page.tsx                       # Resume page (extracted from old page.tsx)
│   └── components/
│       ├── SectionNav.tsx             # Section navigation bar
│       └── BackToTop.tsx              # Back-to-top button
├── components/
│   ├── ChatHome.tsx                   # Shared chat client component ("use client", accepts mode prop)
│   ├── ModeToggle.tsx                 # (Legacy — kept but unused, toggle removed from UI)
│   └── QuickActions.tsx               # Mode-specific action chips
├── api/chat/route.ts                  # Chat API (see Plan 2A)
└── layout.tsx                         # Updated metadata for multi-page site
```

---

## Implementation Steps

### Step 1: Route Restructure — COMPLETE ✅

**`app/resume/page.tsx`** — Full extraction of original `app/page.tsx`:

- Same server component pattern (reads markdown at build time)
- Has own `Metadata` export for `/resume`
- Imports SectionNav and BackToTop from `app/resume/components/`
- Added "Chat with AI" navigation link in header (with chat icon SVG)

**`app/page.tsx`** — New chat homepage:

```typescript
import type { Metadata } from "next";
import ChatHome from "./components/ChatHome";

export const metadata: Metadata = {
  title: "Paul Prae — AI Career Assistant | paulprae.com",
  description: "Chat with an AI assistant about Paul Prae's career...",
};

export default function Home() {
  return <ChatHome />;
}
```

### Step 2: Chat Client Component (`app/components/ChatHome.tsx`) — COMPLETE ✅

Uses `@assistant-ui/react` primitives (not pre-built Thread):

```typescript
"use client";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive, ActionBarPrimitive } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";

interface ChatHomeProps {
  mode?: "chat" | "tools";
}

export default function ChatHome({ mode = "chat" }: ChatHomeProps) {
  // Mode comes from the route: `/` passes "chat", `/tools` passes "tools"
  const transport = useMemo(
    () => new AssistantChatTransport({ api: "/api/chat", body: { mode } }),
    [mode],
  );
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Header with View Resume link, PDF download */}
      <ThreadPrimitive.Root>
        <ThreadPrimitive.Viewport>
          <ThreadPrimitive.Empty>{/* Welcome state + QuickActions */}</ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          <ThreadPrimitive.ViewportFooter>
            <ThreadPrimitive.ScrollToBottom />
            <ChatComposer />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
```

**Key API patterns discovered during implementation:**

- `useChatRuntime` takes `{ transport }`, NOT `{ api, body }` directly
- Must create `AssistantChatTransport` explicitly with `{ api, body }` and pass as transport
- `useMemo` on transport, keyed on `mode`, so it recreates when mode changes
- `MarkdownTextPrimitive` has different props than `TextMessagePartComponent` — requires a wrapper function
- Mode is a **prop** (not state) — each route renders `<ChatHome mode="..." />`, no toggle needed

### Step 3: Mode Toggle (`app/components/ModeToggle.tsx`) — SUPERSEDED

Originally a tab-style toggle. **Replaced by route-based mode switching** — `/` for chat, `/tools` for tools. `ModeToggle.tsx` still exists in the codebase but is unused and can be deleted during cleanup.

### Step 4: Quick Actions (`app/components/QuickActions.tsx`) — COMPLETE ✅

Mode-specific action chips:

**Chat mode (4 chips):** "What does Paul do?", "Key skills", "Recent experience", "Download resume"

**Tools mode (8 chips):** Cover Letter, LinkedIn Connection, LinkedIn InMail, Email Intro, Thank You Note, Follow-Up, STAR Answer, Elevator Pitch

### Step 5: Navigation — COMPLETE ✅

| From               | To                 | Element                                               |
| ------------------ | ------------------ | ----------------------------------------------------- |
| Homepage (`/`)     | Resume (`/resume`) | "View Resume →" link in chat header                   |
| Homepage (`/`)     | Resume PDF         | "PDF ↓" download button in chat header                |
| Resume (`/resume`) | Homepage (`/`)     | "Chat with AI ←" link with chat icon in resume header |

### Step 6: Layout Metadata (`app/layout.tsx`) — COMPLETE ✅

```typescript
title: { default: "Paul Prae — AI Career Assistant | paulprae.com", template: "%s | paulprae.com" },
description: "Chat with an AI assistant about Paul Prae's career...",
```

---

## Design Decisions (Finalized)

### Tools Mode: Route-Based Separation — RESOLVED ✅

Tools mode lives at `/tools` as a separate route (noindex). Recruiters visiting `/` only see the unified chat experience. Both routes share the same `ChatHome` component with a `mode` prop.

### Unified Recruiter Experience — DECIDED

The main chat at `/` is a **single unified UI** for recruiters, hiring managers, and potential teammates. It handles:

- Career Q&A (existing)
- Resume downloads (existing)
- **Tailored resume generation** (Sprint 2) — recruiters commonly ask for custom resumes for specific JDs. This happens inline in the chat thread, not in a separate panel.

The `/tools` route is Paul's **personal workspace** for outreach content generation (cover letters, LinkedIn messages, etc.) — features recruiters don't need.

### Welcome Message — DECIDED

The empty state should be **more elaborate but elegant**. Focus on serving the target audience (recruiters, HMs, potential teammates) exactly what they need. Make the experience fun and memorable. No fluff — just what makes Paul stand out.

### Chat Always Present — DECIDED

Chat is the primary interface and should always be present. Content generation (like tailored resumes) appears **inline in the chat thread** — not in a separate panel. Users can always trivially return to chatting.

---

## Remaining Work (Sprint 2+)

### Welcome Message Enhancement — NOT STARTED

**Priority: HIGH.** Replace the current minimal `ThreadPrimitive.Empty` state with an elegant, memorable welcome that:

- Summarizes Paul's value proposition for the target audience
- Includes suggested questions as quick action chips (already exists)
- Makes a strong first impression — fun and memorable, not generic
- Stays focused: exactly what recruiters/HMs need, nothing more

### Tailored Resume Generation — NOT STARTED

**Priority: HIGH.** Recruiters commonly request custom resumes for specific JDs. This is a core feature of the unified `/` experience, not a tools-mode feature.

- Agent tool in `/api/chat` that generates a tailored resume via Opus 4.6
- Content appears inline in the chat thread (chat is always present)
- Progress indicator for generation (30-60s)
- Download links for PDF/DOCX/MD formats in the response
- Quick action chip: "Generate tailored resume" (add to chat mode chips)

### Platform-Aware Copy-to-Clipboard — NOT STARTED

Every AI response in `/tools` mode needs platform-aware copy:

- LinkedIn connection: strip markdown → plain text, show char count
- Email: preserve basic formatting, separate subject/body copy
- STAR answer: full markdown copy + section-level copy
- Cover letter: "Copy as plain text" + "Copy as Markdown"

Use assistant-ui's `ActionBarPrimitive` to add custom copy actions.

### Character Count Display — NOT STARTED

Show real-time character count sourced from `platform-constraints.json` when in `/tools` mode.

### Component Tests — NOT STARTED

**Priority: HIGH.** Test iteratively as features are built (agile — site always in working state).

| Test                         | Status                                          |
| ---------------------------- | ----------------------------------------------- |
| `tests/chat-home.test.tsx`   | ❌ ChatHome component, quick actions, mode prop |
| `tests/resume-page.test.tsx` | ❌ Resume page rendering                        |

### Cleanup — NOT STARTED

- [ ] Delete old `app/components/SectionNav.tsx` and `app/components/BackToTop.tsx` (dead code after move to `app/resume/components/`)
- [ ] Delete `app/components/ModeToggle.tsx` (toggle removed from UI, mode is now route-driven)

---

## Verification Checklist

- [x] `npm run dev` → visit `/` → chat UI renders with quick actions
- [x] `npm run dev` → visit `/resume` → resume renders with downloads
- [x] Resume page has "Chat with AI" navigation link
- [x] Chat page has "View Resume" navigation link
- [x] `npm test` — all 315 tests pass
- [x] `npm run build` — builds successfully (all routes present)
- [x] TypeScript passes (`tsc --noEmit` — 0 errors)
- [x] ESLint passes (0 errors)
- [ ] `/tools` route renders with tools-mode quick actions (needs live test)
- [ ] Send message → streaming response renders (needs `ANTHROPIC_API_KEY`)
- [ ] Mobile responsive — chat usable on 375px viewport
- [ ] Dark mode renders correctly
- [ ] Tailored resume generation works inline in chat (Sprint 2)
- [ ] Platform-aware copy buttons work in `/tools` mode (Sprint 2+)
- [ ] Character count shows for `/tools` mode outputs (Sprint 2+)

---

## What This Plan Does NOT Cover

- API route implementation (Plan 2A — Sprint 1 COMPLETE)
- Agent logic, system prompts (Plan 2A — Sprint 1 COMPLETE)
- Rate limiting backend (Plan 2A — Sprint 1 COMPLETE)
- CI/CD changes, vercel.json updates (Plan 2C)
- Documentation updates (Plan 2C)
- Supabase Auth for tools mode gating (Phase 3)
