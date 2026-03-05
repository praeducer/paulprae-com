# Technical Design Document — paulprae.com

This document is the canonical technical narrative for the project.
It describes what exists today, why it is designed this way, and what changes are planned by phase.

## 1. Objectives

### Primary objective

Deliver a fast, shareable professional site at `https://paulprae.com` that presents a high-quality AI-generated resume, downloadable artifacts (PDF, DOCX, Markdown), and an AI-powered career assistant for recruiters.

### Engineering objectives

- Keep Phase 1 simple, reproducible, and low-cost.
- Generate recruiter-facing artifacts from structured career data.
- Build an interactive AI chat interface that showcases both the platform and the engineer's capabilities.
- Leverage the existing tech stack (Next.js, Vercel, TypeScript) before introducing new platforms.
- Preserve clear migration paths for Phase 3 (knowledge graph, autonomous agents).

## 2. Phase 1 Architecture (Implemented)

### 2.1 Runtime model

- **Frontend:** Next.js App Router (server-rendered with static pre-rendering for `/resume`)
- **Backend:** `/api/chat` streaming endpoint via AI SDK 6 + Claude
- **Build-time AI:** Claude API invoked locally by pipeline scripts
- **Hosting:** Vercel with Fluid Compute (Pro plan) — `.next/` output

### 2.2 Core stack (implemented)

| Layer              | Technology                            |
| ------------------ | ------------------------------------- |
| Framework          | Next.js 16 + TypeScript               |
| Styling            | Tailwind CSS 4                        |
| Markdown rendering | `react-markdown` + `remark-gfm`       |
| AI generation      | `@anthropic-ai/sdk` (Claude Opus 4.6) |
| Validation         | Zod                                   |
| Testing            | Vitest                                |
| Export             | Pandoc (DOCX) + Typst (PDF)           |
| Deployment         | Vercel (static)                       |

### 2.3 Constraints and guardrails

- Site must remain static-export compatible in Phase 1.
- No server runtime secrets are needed in Vercel for generation.
- Generated resume markdown is an artifact; source-of-truth logic is in generation scripts.
- Recruiter-facing data is versioned in git; raw LinkedIn exports remain local/gitignored.

## 3. Phase 2 Architecture (In Progress)

> **Implementation status:** Sprint 2 in progress on `feat/phase2-implementation` branch. Sprint 1 delivered chat homepage, resume page, tools page, and streaming API. Sprint 2 adds tool-calling for tailored resume generation. See `docs/phase2-redesign-plan.md` for the redesign plan.

Phase 2 transforms the static site into an interactive career platform with a chat-first homepage and job search tools. The architecture adds server-side capabilities while preserving the existing resume pipeline.

### 3.1 Runtime model

- **Frontend:** Next.js App Router with mixed static/dynamic rendering
- **Chat homepage (`/`):** Client component with `@assistant-ui/react` chat interface
- **Resume page (`/resume`):** Statically pre-rendered at build time (extracted from Phase 1 homepage)
- **API routes:** Next.js API routes on Vercel Fluid Compute
- **AI runtime:** Vercel AI SDK 6 calling Anthropic's API via `@ai-sdk/anthropic`
- **Hosting:** Vercel Pro with Fluid Compute (server-rendered Next.js)

### 3.2 Core stack (Phase 2 additions)

| Layer           | Technology                              | Purpose                                           |
| --------------- | --------------------------------------- | ------------------------------------------------- |
| AI SDK          | Vercel AI SDK 6 (`ai@^6.0`)             | streamText, convertToModelMessages, UIMessage     |
| Claude provider | `@ai-sdk/anthropic`                     | Prompt caching, extended thinking                 |
| Chat UI         | `@assistant-ui/react` + `react-ai-sdk`  | Radix-primitive chat components, AI SDK transport |
| Markdown        | `@assistant-ui/react-markdown`          | Rich markdown rendering in chat messages          |
| AI Gateway      | `@ai-sdk/gateway` (Sprint 2+)           | Unified routing, observability                    |
| Rate limiting   | `@upstash/ratelimit` + `@upstash/redis` | Distributed rate limiting                         |
| Chat model      | Claude Sonnet 4.6                       | Fast Q&A ($3/$15 per MTok)                        |
| Resume model    | Claude Opus 4.6                         | Quality generation ($5/$25)                       |
| Compute         | Vercel Fluid Compute (Pro)              | Up to 800s function duration                      |

### 3.3 Why NOT Modal

The original Phase 2 plan called for hosting the agent on Modal. This was dropped because:

- **Language mismatch:** Modal functions must be Python; this is a TypeScript codebase
- **Unnecessary complexity:** We proxy to Anthropic's API, not running custom inference — Modal's GPU infrastructure adds zero value
- **Cost:** Modal Team plan is $250/mo; Vercel Pro is $20/mo
- **Network hop:** Vercel → Modal → Anthropic adds latency vs. Vercel → Anthropic directly
- **Operational overhead:** Separate deployment, billing, monitoring for no architectural benefit

Vercel Fluid Compute handles the entire workload:

- Chat Q&A (Sonnet, 2-8s) — well within any function timeout
- Resume generation (Opus, 30-60s) — within the 800s Fluid Compute ceiling on Pro

### 3.4 Agent architecture

```
Browser
  │
  ├── GET /  ─────────────────→ Chat homepage (client component, @assistant-ui/react)
  │     │                        useChatRuntime → AssistantChatTransport → /api/chat
  │     └── Two modes: "Ask About Paul" (chat) / "Job Search Tools" (tools)
  │
  ├── GET /resume  ───────────→ Static pre-render (Vercel CDN, instant)
  │
  └── POST /api/chat  ────────→ Fluid Compute function (maxDuration: 120)
        │                        Model: claude-sonnet-4-6
        │                        Pattern: streamText → toUIMessageStreamResponse → SSE
        │                        Mode param switches system prompt (chat vs tools)
        ├── Career data + knowledge base in system prompt with prompt caching
        │   (90K tokens cached, 10x cheaper after first turn)
        └── Tool-calling (chat mode only, maxSteps: 3):
              ├── generate_tailored_resume: JD → Sonnet → tailored resume markdown
              └── get_resume_links: returns PDF/DOCX/MD/web download URLs
```

### 3.5 Prompt caching strategy

Career data (~90K tokens after `stripEmpty()` compression) is placed in the system prompt with Anthropic's ephemeral cache control (5-min TTL):

| Conversation turn  | Cost (Sonnet 4.6) | Mechanism                 |
| ------------------ | ----------------- | ------------------------- |
| First message      | ~$0.34            | Cache write (1.25x input) |
| Each subsequent    | ~$0.03            | Cache read (0.1x input)   |
| 10-message session | ~$0.60            | Amortized across turns    |

### 3.6 Model routing

| Use case                      | Model               | Why                                                                |
| ----------------------------- | ------------------- | ------------------------------------------------------------------ |
| Chat Q&A                      | `claude-sonnet-4-6` | Fast, cheap, sufficient quality for career Q&A                     |
| Tailored resume (tool call)   | `claude-sonnet-4-6` | Same model as chat; fast turnaround for recruiter-facing tool call |
| Pipeline resume generation    | `claude-opus-4-6`   | Highest quality for the canonical resume artifact                  |
| Future: intent classification | `claude-haiku-4-5`  | Sub-second, $1/$5 per MTok                                         |

### 3.7 Key Anthropic API features used

- **Prompt caching** (GA) — `cache_control: { type: "ephemeral" }` on system prompt blocks
- **Structured outputs** (GA) — guaranteed JSON schema conformance for resume data
- **Search results / citations** (GA) — natural citations when answering from career data
- **Compaction API** (beta, Opus 4.6) — server-side context summarization for long conversations

### 3.8 Vercel AI SDK 6 patterns

**Server (API route):**

```typescript
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "../../../lib/agent/context";

const body = (await request.json()) as { messages: UIMessage[]; mode?: "chat" | "tools" };
const systemPrompt = buildSystemPrompt(body.mode === "tools" ? "tools" : "chat");
const modelMessages = await convertToModelMessages(body.messages);

const result = streamText({
  model: anthropic("claude-sonnet-4-6"),
  system: systemPrompt,
  messages: modelMessages,
  maxOutputTokens: 4096, // Note: renamed from maxTokens in AI SDK 6
});

return result.toUIMessageStreamResponse(); // Note: renamed from toDataStreamResponse in AI SDK 6
```

**Client (React — using @assistant-ui/react):**

```typescript
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from "@assistant-ui/react";

// Create transport with mode parameter
const transport = useMemo(
  () => new AssistantChatTransport({ api: "/api/chat", body: { mode } }),
  [mode],
);
const runtime = useChatRuntime({ transport });

// Render with Radix-style primitives
<AssistantRuntimeProvider runtime={runtime}>
  <ThreadPrimitive.Root>
    <ThreadPrimitive.Viewport>
      <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
</AssistantRuntimeProvider>
```

### 3.9 File organization (Phase 2 additions)

> **Note:** The original plan referenced a `packages/` monorepo structure. The actual implementation uses a flat `lib/` structure — simpler, no path aliases or npm workspaces needed.

```
lib/
├── agent/
│   └── context.ts              # buildCareerContext(), buildSystemPrompt(), stripEmpty()
├── prompts/
│   ├── career-chat.system.md   # Recruiter Q&A prompt (grounding rules G1-G8)
│   ├── job-tools.system.md     # Content generation prompt (STAR, AIDA, PAS, BAB)
│   └── resume-writer.system.md # Existing pipeline prompt (unchanged)
├── career-data.ts              # loadCareerData() — existing, unchanged
├── config.ts                   # PATHS, RESUME_FILE_BASE — existing, unchanged
└── types.ts                    # CareerData types — existing, unchanged

app/
├── page.tsx                    # Chat homepage (imports ChatHome)
├── resume/
│   ├── page.tsx                # Resume page (extracted from Phase 1 homepage)
│   └── components/
│       ├── SectionNav.tsx      # Section navigation bar
│       └── BackToTop.tsx       # Back-to-top button
├── components/
│   ├── ChatHome.tsx            # Main chat client component ("use client")
│   ├── ModeToggle.tsx          # Ask About Paul / Job Tools toggle
│   └── QuickActions.tsx        # Mode-specific action chips
├── api/chat/route.ts           # POST handler: mode switching, rate limiting, streaming
└── layout.tsx                  # Updated metadata for multi-page site
```

Existing `lib/` files (types, config, career-data) are unchanged — the agent context loader imports from them directly.

### 3.10 Rate limiting: why Upstash Redis

Rate limiting uses `@upstash/redis` + `@upstash/ratelimit` (sliding window, 20 req/min/IP). This was chosen over alternatives:

- **`@vercel/kv`** — deprecated/sunset in 2025, no longer available
- **Supabase PostgreSQL** — read replicas can't write counters, no edge compatibility, no library. Supabase's own docs recommend Upstash for this use case
- **In-memory** — not shared across serverless instances; used only as dev fallback

Provider strategy: **Vercel** (hosting) + **Supabase** (database + auth + pgvector) + **Upstash** (rate limiting only). Upstash Vector is NOT used — pgvector handles vector search in Phase 3.

### 3.11 Security model

- API routes are server-side only — `ANTHROPIC_API_KEY` never exposed to client
- Rate limiting: 20 requests/minute per IP via Upstash (distributed, works across Vercel regions)
- CSP headers updated: `connect-src 'self'` allows same-origin API calls
- API routes return `Cache-Control: no-store` — no caching of AI responses
- Input validation via Zod on all API route request bodies

## 4. Data and Content Architecture

### 4.1 Inputs

- LinkedIn CSV exports under `data/sources/linkedin/` (gitignored)
- Curated knowledge JSON under `data/sources/knowledge/` (committed)

### 4.2 Generated artifacts

- `data/generated/career-data.json` (normalized structured data)
- `data/generated/Paul-Prae-Resume.md` (AI-generated source resume)
- `public/Paul-Prae-Resume.{pdf,docx,md}` (served downloadable assets)

### 4.3 Data policy

- Do not model private/sensitive information that should not be public.
- Keep generated public-facing data portable and reproducible.
- Keep credentials/tokens out of repository content and docs.

### 4.4 Runtime data access (Phase 2)

In Phase 2, career data is loaded at function cold start and cached in the Anthropic system prompt. No database is required. The same `career-data.json` and knowledge base files used by the pipeline are read by the agent at runtime.

## 5. Build and Generation Pipeline

Pipeline order:

1. `npm run ingest` -> parse CSV/knowledge inputs into `career-data.json`
2. `npm run generate` -> generate Markdown resume from structured data
3. `npm run export` -> produce PDF/DOCX artifacts from Markdown
4. `npm run build` -> Next.js server build to `.next/`
5. push to `main` -> Vercel builds and deploys

Supporting commands:

- `npm run pipeline` for end-to-end execution
- `npm run pipeline:content` for AI generation only
- `npm run pipeline:render` for export/build from existing markdown
- `npm run brand` for OG image and favicon assets

**Pipeline independence:** The resume generation pipeline and the website remain independent workflows. The pipeline produces data files; the website reads them. In Phase 2, API routes additionally read `career-data.json` at runtime for the chat agent's context.

## 6. Deployment and Domain Operations

### 6.1 Deployment source of truth

- Deployment behavior and commands are documented in `README.md`.

### 6.2 Domain and DNS source of truth

- DNS operations, verification, and rollback are documented in `domain-dns-runbook.md`.

### 6.3 Operational separation

- README: deployment workflow
- DNS runbook: domain records and propagation checks
- This document: architectural intent and system boundaries

### 6.4 Phase 2 deployment changes

| Aspect                | Phase 1               | Phase 2                                                                      |
| --------------------- | --------------------- | ---------------------------------------------------------------------------- |
| Vercel framework      | `null` (static files) | Auto-detected Next.js                                                        |
| Output directory      | `out/`                | `.next/` (managed by Vercel)                                                 |
| Build output          | Static HTML only      | Static pages + serverless functions                                          |
| Environment variables | None on Vercel        | `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_*`, optionally `AI_GATEWAY_API_KEY` |
| Compute               | CDN only              | CDN + Fluid Compute (Pro plan)                                               |

## 7. Quality Strategy

### 7.1 Automated checks

- Pre-commit: `lint-staged` runs Prettier on staged files (via husky `prepare` hook — installs on `npm install`). Uses POSIX-safe nvm PATH detection (not `nvm.sh` sourcing) so hooks work under `dash`/`sh`. Windows Git clients (GitHub Desktop, VS Code) auto-delegate to WSL when `npx` is unavailable
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run test:pipeline` (validates generated outputs when available)

### 7.2 Manual checks

- Validate live routing and downloadable assets after deployment
- Spot-check generated resume quality for factual consistency and tone
- Phase 2: Test chat responses for accuracy against career data (no hallucination)

## 8. Roadmap

### Phase 1 (Implemented)

AI-generated static resume: LinkedIn data + knowledge base → Claude → Markdown → Next.js static site → Vercel CDN.

### Phase 2 (Complete — see §3)

Interactive career platform with chat-first homepage:

- Chat homepage (`/`) — recruiter Q&A with AI career assistant
- Resume page (`/resume`) — extracted from Phase 1 homepage
- Tools page (`/tools`) — job search content tools (noindex)
- AI chat via `@assistant-ui/react` primitives with AI SDK 6 transport
- Tool-calling: `generate_tailored_resume` and `get_resume_links` (chat mode only)
- Vercel AI SDK 6 with streaming (`toUIMessageStreamResponse`)
- Vercel Fluid Compute for serverless AI functions (maxDuration: 120s)

**Sprint 1+2 complete** on `feat/phase2-implementation` branch (337 tests pass).
Implementation plans archived in `.claude/plans/archive/`.
Authoritative redesign plan: `docs/phase2-redesign-plan.md`.

### Phase 3 (Future)

- Supabase PostgreSQL + pgvector/pgvectorscale for career data embeddings and database-backed RAG (NOT Upstash Vector — data co-location, no sync needed, pgvectorscale benchmarks show 28x lower p95 latency vs Pinecone)
- Supabase Auth for admin-gated tools mode (optional)
- Neo4j AuraDB knowledge graph (Person → Role → Company → Project → Skill → Outcome)
- Claude Agent SDK for autonomous multi-step reasoning agents
- Vercel MCP Servers for agent tool access (DB queries, vector search, external APIs)
- Background ingest via Vercel Cron + Route Handlers for automated data refresh
- n8n automation workflows for data ingestion and enrichment

## 9. Non-goals

### Phase 1

- No auth-gated admin interface
- No production API routes
- No dynamic server-side personalization at request time
- No database dependency for current static-site operation

### Phase 2

- No database (career data loaded from committed files, not a DB)
- No separate backend platform (no Modal, no AWS Lambda — Vercel handles everything)
- No user authentication (chat is public, no login required)
- No component library beyond `@assistant-ui/react` (Tailwind CSS for all custom styling)

## 10. References

- `README.md` (setup, pipeline, deployment)
- `CLAUDE.md` (project memory and guardrails)
- `.claude/plans/archive/phase2a-backend-agent-api.md` (backend implementation plan — completed)
- `.claude/plans/archive/phase2b-frontend-chat.md` (frontend implementation plan — completed)
- `.claude/plans/archive/phase2c-devops-docs.md` (devops implementation plan — completed)
- `.claude/plans/remaining-work.md` (pre-merge checklist and remaining enhancements)
- `docs/domain-dns-runbook.md` (domain DNS operations)
- `docs/linux-dev-environment-setup.md` (Linux/WSL setup)
- `docs/windows-dev-environment-setup.md` (Windows setup)
- `docs/mcp-setup.md` (MCP configuration)
