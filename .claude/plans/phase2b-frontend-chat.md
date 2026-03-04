# Plan 2B: Frontend — Chat Interface + Navigation

> **Sequence:** Plan 2A (backend) → Plan 2B (this) → Plan 2C (devops)
> **Branch:** `feat/phase2b-frontend` from `feat/phase2a-backend` (or `main` after 2A merges)
> **Depends on:** Plan 2A (API routes must exist at `/api/chat` and `/api/resume`)
> **Blocks:** Plan 2C (devops needs to know all routes for CSP/CI updates)

---

## Objective

Build the recruiter-facing chat interface at `/chat` using Vercel AI SDK 6's `useChat` hook. Add navigation between the resume page and chat page. All styling via Tailwind CSS per project convention.

---

## Architecture Decisions

### AI SDK 6 `useChat` (v6 API)

The `useChat` hook in `@ai-sdk/react` v6 has breaking changes from v4:

| v4 (old plan)                                 | v6 (this plan)                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `append(message)`                             | `sendMessage({ text })`                                                |
| `input` / `handleInputChange` managed by hook | `useState` managed by component                                        |
| `isLoading` boolean                           | `status: 'submitted' \| 'streaming' \| 'ready' \| 'error'`             |
| `message.content` string                      | `message.parts[]` array (text, reasoning, tool-invocation, source-url) |
| `maxSteps` on client                          | `stopWhen` on server (Plan 2A)                                         |
| implicit transport                            | `transport: new DefaultChatTransport({ api })`                         |

### Message Parts Rendering

Each `UIMessage` carries a `.parts` array. The UI must render each part type:

- `text` — markdown content (use `react-markdown`)
- `reasoning` — collapsible thinking block (for Opus resume generation)
- `tool-invocation` — show tool call in progress
- `tool-result` — show tool output
- `source-url` — clickable citation link

### No Component Library

Per CLAUDE.md: no shadcn/ui for Phase 1/2. All components are hand-built with Tailwind CSS. This keeps the dependency count minimal and the code portfolio-worthy.

### Dedicated Page (Not Floating Widget)

The chat lives at `/chat` as a full-page experience. Recruiters arrive from a CTA on the resume page. This gives maximum screen real estate for conversation and resume preview.

---

## Implementation Steps

### Step 1: Chat Page Server Component (`app/chat/page.tsx`)

```typescript
import type { Metadata } from "next";
import ChatInterface from "./components/ChatInterface";

export const metadata: Metadata = {
  title: "Chat with Paul's AI Assistant | paulprae.com",
  description: "Ask questions about Paul Prae's experience, skills, and career history.",
};

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ChatInterface />
    </main>
  );
}
```

### Step 2: Chat Client Components

```
app/chat/
  page.tsx                    # Server component (metadata)
  components/
    ChatInterface.tsx         # "use client" — useChat hook, mode state
    MessageList.tsx           # Message rendering with parts
    MessageBubble.tsx         # Individual message with part-type rendering
    ChatInput.tsx             # Auto-resizing textarea
    ModeSelector.tsx          # "Ask about Paul" / "Generate Resume" tabs
```

#### ChatInterface.tsx (main client component)

```typescript
"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export default function ChatInterface() {
  const [mode, setMode] = useState<"chat" | "resume">("chat");
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: mode === "resume" ? "/api/resume" : "/api/chat",
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== "ready") return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col">
      <ModeSelector mode={mode} onModeChange={setMode} />
      <MessageList messages={messages} status={status} />
      {error && <ErrorBanner error={error} />}
      <ChatInput
        input={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isDisabled={status !== "ready"}
        mode={mode}
      />
    </div>
  );
}
```

#### MessageBubble.tsx (part-aware rendering)

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MessageBubble({ message }: { message: UIMessage }) {
  return (
    <div className={message.role === "user" ? "chat-message-user" : "chat-message-assistant"}>
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>;
          case "reasoning":
            return (
              <details key={i} className="text-sm text-slate-500">
                <summary>Thinking...</summary>
                <pre className="whitespace-pre-wrap">{part.text}</pre>
              </details>
            );
          case "tool-invocation":
            return <ToolCallIndicator key={i} toolName={part.toolName} />;
          case "source-url":
            return <Citation key={i} url={part.url} title={part.title} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
```

### Step 3: Styling

All Tailwind CSS. Add chat-specific utilities to `app/globals.css`:

```css
/* Chat message bubbles */
.chat-message-user {
  @apply rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-950;
}
.chat-message-assistant {
  @apply rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900;
}
```

Design principles:

- Clean, minimal UI that showcases the AI conversation quality
- Responsive (mobile-first) — recruiters may view on phones
- Dark mode support via Tailwind's `dark:` variants
- Streaming indicator (pulsing dot or typing animation)
- Auto-scroll to latest message

### Step 4: Navigation

Add bidirectional navigation between resume and chat:

**Resume page (`app/page.tsx`):**

- Add "Chat with AI" CTA button/link in the header alongside Email/LinkedIn/GitHub
- Style as a prominent action (not just another link) — this is the portfolio differentiator

**Chat page header:**

- "Back to Resume" link
- Paul's name/title as heading
- Brief description: "Ask me anything about Paul's career"

**Root layout (`app/layout.tsx`):**

- Update metadata for multi-page site
- Add consistent nav bar if needed (or keep page-specific headers)

### Step 5: Chat UX Polish

- **Welcome message:** Pre-populated assistant message with suggested questions:
  - "What is Paul's experience with AI/ML?"
  - "Tell me about his healthcare work"
  - "What programming languages does he use?"
- **Resume mode UX:** When in "Generate Resume" mode, show a textarea for pasting a job description instead of a chat input
- **Streaming indicator:** Animated dots or cursor while `status === 'streaming'`
- **Error handling:** Retry button on error, rate limit message when 429'd
- **Mobile:** Full-screen chat on small screens, keyboard-aware input positioning

---

## Tests

| Test                             | Coverage                                        |
| -------------------------------- | ----------------------------------------------- |
| `tests/chat-components.test.tsx` | ChatInterface, MessageList, ChatInput rendering |
| `tests/chat-page.test.tsx`       | /chat page metadata, server component rendering |

**Note:** `useChat` tests should mock the transport layer, not hit real API routes. Test that messages render correctly for each part type.

---

## Verification Checklist

- [ ] `npm run dev` → visit `/chat` → send message → streaming response renders
- [ ] Mode toggle switches between chat and resume generation
- [ ] Resume page has "Chat" navigation link
- [ ] Chat page has "Back to Resume" link
- [ ] Mobile responsive — chat usable on phone-width viewport
- [ ] Dark mode renders correctly
- [ ] Error state shows retry option
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — builds successfully

---

## What This Plan Does NOT Cover

- API route implementation (Plan 2A)
- Agent logic, prompt engineering (Plan 2A)
- Rate limiting backend (Plan 2A)
- CI/CD changes, vercel.json updates (Plan 2C)
- Documentation updates (Plan 2C)
