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
for full context including user stories. Sprint 1 frontend is complete — focus on Sprint 2+ items:
welcome message, platform-aware copy, character count, /api/resume integration."
```

- The feature branch builds, 315 tests pass, lint clean
- All components use `@assistant-ui/react` primitives (NOT pre-built `<Thread />`)
- Test with `npm run dev` — verify `/` renders chat, `/resume` renders resume
- Mock the transport layer in component tests

---

## Objective

Build a chat-first homepage at `/` using `@assistant-ui/react` primitives, move the resume to `/resume`, and add bidirectional navigation. Two modes: "Ask About Paul" (recruiter Q&A) and "Job Search Tools" (content generation).

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
| `/` (home) | Chat interface with mode toggle       | Dynamic (client component)           |
| `/resume`  | Full resume (moved from original `/`) | Static pre-render (server component) |

### Two Modes on Homepage

| Mode               | Audience             | System Prompt            | Default    |
| ------------------ | -------------------- | ------------------------ | ---------- |
| "Ask About Paul"   | Recruiters, visitors | Third-person career Q&A  | Yes        |
| "Job Search Tools" | Paul (site owner)    | First-person content gen | Via toggle |

No authentication needed — tools mode is a simple toggle.

---

## File Structure (Actual Implementation)

```
app/
├── page.tsx                           # Chat homepage (imports ChatHome)
├── resume/
│   ├── page.tsx                       # Resume page (extracted from old page.tsx)
│   └── components/
│       ├── SectionNav.tsx             # Section navigation bar
│       └── BackToTop.tsx              # Back-to-top button
├── components/
│   ├── ChatHome.tsx                   # Main chat client component ("use client")
│   ├── ModeToggle.tsx                 # Ask About Paul / Job Tools toggle
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
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive, ActionBarPrimitive } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";

export default function ChatHome() {
  const [mode, setMode] = useState<"chat" | "tools">("chat");

  const transport = useMemo(
    () => new AssistantChatTransport({ api: "/api/chat", body: { mode } }),
    [mode],
  );
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Header with mode toggle, View Resume link, PDF download */}
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

### Step 3: Mode Toggle (`app/components/ModeToggle.tsx`) — COMPLETE ✅

Tab-style toggle with `role="tablist"` accessibility:

- "Ask About Paul" tab (default)
- "Job Tools" tab

### Step 4: Quick Actions (`app/components/QuickActions.tsx`) — COMPLETE ✅

Mode-specific action chips:

**Chat mode (4 chips):** "What does Paul do?", "AI/ML experience", "Healthcare work", "Download resume"

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

## Remaining Work (Sprint 2+)

### Welcome Message with Suggested Questions — NOT STARTED

Currently uses `ThreadPrimitive.Empty` with `QuickActions`. Enhance with a proper welcome message summarizing Paul's value proposition (user story R1).

### Frame "Job Search Tools" Mode for Public Visitors — NOT STARTED

Recruiters seeing "Job Search Tools" may be confused. Add framing copy that presents it as a portfolio showcase (e.g., "See the AI tools Paul built to automate his job search") rather than an internal utility. Consider whether to keep it publicly visible or hide behind `?mode=tools` URL parameter.

### Platform-Aware Copy-to-Clipboard — NOT STARTED

Every AI response in tools mode needs a copy button:

- LinkedIn connection: strip markdown → plain text, show char count
- Email: preserve basic formatting, separate subject/body copy
- STAR answer: full markdown copy + section-level copy
- Cover letter: "Copy as plain text" + "Copy as Markdown"

Use assistant-ui's `ActionBarPrimitive` to add custom copy actions.

### Character Count Display — NOT STARTED

Show real-time character count sourced from `platform-constraints.json` when in tools mode.

### Resume Generation UI — NOT STARTED

- Integration with `/api/resume` route (Plan 2A Step 7)
- Progress indicator for Opus 4.6 generation (30-60s)
- Preview generated resume inline in chat

### Component Tests — NOT STARTED

| Test                         | Status                                            |
| ---------------------------- | ------------------------------------------------- |
| `tests/chat-home.test.tsx`   | ❌ ChatHome component, mode toggle, quick actions |
| `tests/resume-page.test.tsx` | ❌ Resume page rendering                          |

### Cleanup — NOT STARTED

- [ ] Delete old `app/components/SectionNav.tsx` and `app/components/BackToTop.tsx` (dead code after move to `app/resume/components/`)

---

## Verification Checklist

- [x] `npm run dev` → visit `/` → chat UI renders with mode toggle and quick actions
- [x] `npm run dev` → visit `/resume` → resume renders with downloads
- [x] Resume page has "Chat with AI" navigation link
- [x] Chat page has "View Resume" navigation link
- [x] `npm test` — all 315 tests pass
- [x] `npm run build` — builds successfully (all routes present)
- [x] TypeScript passes (`tsc --noEmit` — 0 errors)
- [x] ESLint passes (0 errors)
- [ ] Mode toggle switches between chat and tools modes (needs live API test)
- [ ] Send message → streaming response renders (needs `ANTHROPIC_API_KEY`)
- [ ] Mobile responsive — chat usable on 375px viewport
- [ ] Dark mode renders correctly
- [ ] Platform-aware copy buttons work in tools mode
- [ ] Character count shows for tools mode outputs

---

## What This Plan Does NOT Cover

- API route implementation (Plan 2A — Sprint 1 COMPLETE)
- Agent logic, system prompts (Plan 2A — Sprint 1 COMPLETE)
- Rate limiting backend (Plan 2A — Sprint 1 COMPLETE)
- CI/CD changes, vercel.json updates (Plan 2C)
- Documentation updates (Plan 2C)
- Supabase Auth for tools mode gating (Phase 3)
