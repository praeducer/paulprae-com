# Plan 2A: Backend — Career Agent Core + API Routes

> **Status:** Sprint 1+2 COMPLETE on `feat/phase2-implementation`. Only AI Gateway and prompt caching optimization remain.
> **Sequence:** Plan 2A (this) → Plan 2B (frontend) → Plan 2C (devops)
> **Branch:** `feat/phase2-implementation` (combined 2A+2B Sprint 1 work)
> **Depends on:** Nothing (first in sequence)
> **Blocks:** Plan 2B (frontend needs API routes), Plan 2C (devops needs new config)
> **Human steps:** See `human-steps-phase2.md` Steps 1-3 (Vercel Pro, Upstash Redis, AI Gateway)
> **Authoritative redesign plan:** `docs/phase2-redesign-plan.md` (merged plan with full user stories, QA strategy, sprint breakdown)

### Claude Code Execution Notes

This plan is optimized for autonomous execution by Claude Code. To run remaining work:

```
"Continue Phase 2 implementation on feat/phase2-implementation branch. Read docs/phase2-redesign-plan.md
for full context. Sprint 1 backend work is complete — focus on Sprint 2 items: agent tools, /api/resume
route, resume-generator prompt. Run npm test and npm run build after each step."
```

- The feature branch has 1 commit with Sprint 1 work (builds, 315 tests pass, lint clean)
- All code uses real AI SDK 6 API signatures verified against actual type definitions
- Run `npm test` after every step to catch regressions immediately

---

## Objective

Build Next.js API routes for chat and resume generation, powered by a career context loader that assembles system prompts from career data + knowledge base files. Remove the static-export constraint. The frontend (Plan 2B) and deployment config (Plan 2C) are handled in subsequent plans.

---

## Architecture Decisions

### Drop Modal — Use Vercel Fluid Compute

The original plan called for a Modal container. This was dropped:

- Modal requires Python — language mismatch with TypeScript codebase
- We proxy to Anthropic's API, not running custom inference — Modal's GPU infra adds zero value
- Vercel Pro ($20/mo) with Fluid Compute supports 800s function duration
- Eliminates an entire deployment platform, billing, and network hop

**Decision:** All AI workloads run as Next.js API routes on Vercel Fluid Compute.

### Vercel AI SDK 6 (not raw Anthropic SDK)

Use `ai@6.x` + `@ai-sdk/anthropic` for all API route handlers:

- `streamText()` with built-in SSE response formatting via `toUIMessageStreamResponse()`
- `convertToModelMessages()` to convert `UIMessage[]` (from client) to model-compatible format
- Prompt caching via `providerOptions.anthropic.cacheControl`
- Extended thinking via `providerOptions.anthropic.thinking`
- Provider-agnostic model switching

> **Note:** The original plan referenced `ToolLoopAgent` and `stopWhen(stepCountIs(n))`. The Sprint 1 implementation uses plain `streamText()` — agent tools (generate_resume, etc.) will be added in Sprint 2 using AI SDK 6's tool-calling pattern.

### Vercel AI Gateway (Recommended Default)

Use `@ai-sdk/gateway` as the **primary model interface** rather than calling `@ai-sdk/anthropic` directly. Benefits:

- Unified API key management (`AI_GATEWAY_API_KEY` env var)
- Built-in observability (latency, tokens, errors) in Vercel dashboard
- Budget controls and spend alerts
- Hot-swap models from dashboard without code changes

**Fallback:** Current implementation uses `@ai-sdk/anthropic` directly. AI Gateway integration is a Sprint 2+ enhancement.

### Model Routing

| Use Case                       | Model               | Rationale                        |
| ------------------------------ | ------------------- | -------------------------------- |
| Chat Q&A                       | `claude-sonnet-4-6` | Fast, $3/$15 per MTok            |
| Resume generation              | `claude-opus-4-6`   | Highest quality, $5/$25 per MTok |
| Intent classification (future) | `claude-haiku-4-5`  | $1/$5 per MTok                   |

### Rate Limiting: Why Upstash Redis (Not Supabase)

The project uses `@upstash/redis` + `@upstash/ratelimit` for distributed rate limiting. This was evaluated against alternatives:

| Option                                  | Verdict        | Why                                                                                                                                                                 |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@upstash/redis` + `@upstash/ratelimit` | **Winner**     | Purpose-built sliding window algorithms, edge-compatible HTTP client, 1-5ms latency, Vercel's official recommended approach                                         |
| `@vercel/kv`                            | **Eliminated** | Deprecated/sunset in 2025. Vercel removed it from dashboard; redirects to Upstash directly                                                                          |
| Supabase PostgreSQL                     | **Not viable** | Read replicas can't write rate counters, 5-20ms latency, no edge runtime compatibility, no library support. Supabase's own docs recommend Upstash for rate limiting |
| In-memory `Map`                         | **Dev only**   | State not shared across serverless instances, lost on cold starts. Used as graceful fallback when Upstash env vars not configured                                   |

**Provider strategy:** Minimal 3-provider stack: **Vercel** (hosting) + **Supabase** (database + auth + pgvector in Phase 3) + **Upstash** (rate limiting only). Upstash Vector is NOT used — pgvector handles vector search in Phase 3.

### Prompt Caching Strategy

Career data (~90K tokens) goes in the system prompt with `cache_control: { type: "ephemeral" }` (5-min TTL):

- Cache write: 1.25x base input ($3.75/MTok for Sonnet)
- Cache read: 0.1x base input ($0.30/MTok for Sonnet)
- 10-message conversation: ~$0.60

### Two System Prompt Modes

The chat API accepts a `mode` parameter that switches between two system prompts:

| Prompt                  | Mode               | Purpose                                         |
| ----------------------- | ------------------ | ----------------------------------------------- |
| `career-chat.system.md` | `"chat"` (default) | Recruiter Q&A, third-person voice               |
| `job-tools.system.md`   | `"tools"`          | Content generation for Paul, first-person voice |

A third prompt (`resume-generator.system.md`) will power the separate `/api/resume` route in Sprint 2.

---

## File Structure (Actual Implementation)

> **Important:** The original plan referenced `packages/agent/` and `packages/career-data/` monorepo structure. The actual implementation uses a flat `lib/` structure — simpler, no path aliases needed.

```
lib/
├── agent/
│   └── context.ts          # buildCareerContext(), buildSystemPrompt(), CareerContext interface
├── prompts/
│   ├── career-chat.system.md   # Recruiter Q&A system prompt (grounding rules G1-G8)
│   ├── job-tools.system.md     # Content generation system prompt (STAR, AIDA, PAS, BAB)
│   └── resume-writer.system.md # Existing pipeline prompt (unchanged)
├── career-data.ts          # loadCareerData() — existing, unchanged
├── config.ts               # PATHS, RESUME_FILE_BASE — existing, unchanged
├── types.ts                # CareerData types — existing, unchanged
└── ...

app/
├── api/
│   └── chat/
│       └── route.ts        # POST handler: mode switching, rate limiting, streaming
└── ...
```

---

## Implementation Steps

### Step 1: Dependencies + Config — COMPLETE ✅

**Installed dependencies:**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/react @assistant-ui/react @assistant-ui/react-ai-sdk @assistant-ui/react-markdown @upstash/ratelimit @upstash/redis
```

| Package              | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `ai@^6.0`            | Vercel AI SDK 6 core (streamText, convertToModelMessages, UIMessage) |
| `@ai-sdk/anthropic`  | Claude provider                                                      |
| `@ai-sdk/react`      | React hooks (used by assistant-ui transport layer)                   |
| `@upstash/ratelimit` | Distributed rate limiting                                            |
| `@upstash/redis`     | Redis client for rate limit state                                    |

> **Changed from original plan:** `@vercel/kv` → `@upstash/redis` (direct Upstash client, no Vercel KV wrapper needed). `@ai-sdk/gateway` deferred to Sprint 2+.

**Updated `next.config.ts`:**

```typescript
const nextConfig: NextConfig = {
  // Phase 2: removed output: 'export' for API routes + dynamic rendering
  // Resume page auto-detected as static by Next.js
};
```

### Step 2: Career Context Loader (`lib/agent/context.ts`) — COMPLETE ✅

> **Changed from original plan:** Not extracted to `packages/career-data/` — lives in `lib/agent/context.ts`.

Loads and assembles all data needed for system prompts:

- `career-data.json` — structured career data
- 5 knowledge base files: `platform-constraints.json`, `message-templates.json`, `writing-formulas.json`, `audience-frameworks.json`, `communication-styles.json`

Key exports:

- `loadCareerContext(): CareerContext` — loads all data, caches on first call
- `buildSystemPrompt(mode: "chat" | "tools"): string` — reads markdown template, injects data via template placeholders
- `stripEmpty(obj)` — removes null/empty fields to save tokens

Template placeholders: `{{CAREER_DATA}}`, `{{AUDIENCE_FRAMEWORKS}}`, `{{PLATFORM_CONSTRAINTS}}`, `{{WRITING_FORMULAS}}`, `{{MESSAGE_TEMPLATES}}`, `{{COMMUNICATION_STYLES}}`

### Step 3: System Prompts — COMPLETE ✅

**`lib/prompts/career-chat.system.md`:**

- Role: Paul Prae's career assistant (third-person)
- Grounding rules G1-G8 preserved from resume writer
- Audience framework data injected via template
- Career data embedded in prompt for caching

**`lib/prompts/job-tools.system.md`:**

- Role: Paul's job search content generator (first-person)
- Platform constraints, writing formulas (STAR, AIDA, PAS, BAB), message templates injected
- Content type instructions for cover letters, LinkedIn, emails, STAR answers, elevator pitches

### Step 4: Chat API Route (`app/api/chat/route.ts`) — COMPLETE ✅

```typescript
// Actual implementation pattern (simplified)
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { buildSystemPrompt } from "../../../lib/agent/context";

export async function POST(request: Request) {
  // Rate limiting (Upstash, graceful fallback when env vars not set)
  const { messages, mode } = await request.json();
  const systemPrompt = getSystemPrompt(mode === "tools" ? "tools" : "chat");
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 4096,
    temperature: 0.7,
  });
  return result.toUIMessageStreamResponse();
}
```

**Key AI SDK 6 patterns used:**

- `UIMessage[]` from client → `convertToModelMessages()` → model-compatible format
- `streamText()` → `result.toUIMessageStreamResponse()` for SSE streaming
- `maxOutputTokens` (not `maxTokens` — renamed in v6)

### Step 5: Rate Limiting — COMPLETE ✅ (with graceful fallback)

```typescript
// Upstash rate limiting with fallback for local dev
let ratelimit = null;
async function initRateLimit() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: ..., token: ... });
    return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s") });
  }
  return { limit: async () => ({ success: true }) }; // Passthrough for local dev
}
```

> **Changed from original plan:** Uses `@upstash/redis` directly instead of `@vercel/kv`. Graceful fallback when env vars not configured (returns `success: true`).

---

## Remaining Work (Sprint 2+)

### Step 6: Agent Tools — COMPLETE ✅ (Sprint 2)

Tool-calling added to `/api/chat` (chat mode only) using AI SDK 6's `tool()` + `streamText({ tools, stopWhen })`:

- `generate_tailored_resume` — takes `jobDescription` + optional `emphasisAreas`, calls Sonnet via `generateText()` with `resume-generator.system.md`, returns tailored markdown + download links
- `get_resume_links` — returns PDF/DOCX/MD/web download URLs

> **Changed from plan:** No separate `/api/resume` route. Tool-calling within `/api/chat` is simpler — the model decides when to invoke tools based on conversation context. `maxDuration` bumped to 120s to accommodate tool execution. `get_platform_constraints` deferred (not needed for MVP).

### Step 7: Resume Generation Route — SUPERSEDED

Folded into Step 6 as a tool within `/api/chat`. No separate `/api/resume` route needed.

### Step 8: AI Gateway Integration — NOT STARTED (optional)

Replace direct `@ai-sdk/anthropic` calls with `@ai-sdk/gateway`. Low priority — direct Anthropic calls work well and AI Gateway adds complexity without clear benefit at current scale.

### Step 9: Prompt Caching Optimization — NOT STARTED (optional)

Current implementation passes system prompt as a single string. Could optimize to use block-level caching with `providerOptions.anthropic.cacheControl`. Worth measuring actual cache hit rates before optimizing.

### Step 10: Tests — COMPLETE ✅ (Sprint 2)

| Test                                         | Status                            |
| -------------------------------------------- | --------------------------------- |
| Existing 315 tests                           | ✅ All pass                       |
| `lib/agent/context.ts` unit tests            | ✅ `tests/context.test.ts`        |
| API route tests (validation, error handling) | ✅ `tests/chat-api.test.ts`       |
| QuickActions component tests                 | ✅ `tests/quick-actions.test.tsx` |
| ChatHome component tests                     | ✅ `tests/chat-home.test.tsx`     |
| Total: 337 tests passing                     | ✅                                |

---

## Environment Variables

| Variable                   | Where                 | Purpose                         | Status                        |
| -------------------------- | --------------------- | ------------------------------- | ----------------------------- |
| `ANTHROPIC_API_KEY`        | `.env.local` + Vercel | Claude API access               | Required for live testing     |
| `AI_GATEWAY_API_KEY`       | Vercel only           | Vercel AI Gateway (optional)    | Sprint 2+                     |
| `UPSTASH_REDIS_REST_URL`   | Vercel only           | Upstash Redis for rate limiting | Sprint 2+ (graceful fallback) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel only           | Upstash Redis auth              | Sprint 2+ (graceful fallback) |

> **Changed from original plan:** Env vars are `UPSTASH_REDIS_REST_*` (not `KV_REST_API_*`).

---

## Risk Mitigation

| Risk                                      | Impact | Mitigation                                                     |
| ----------------------------------------- | ------ | -------------------------------------------------------------- |
| Removing `output: 'export'` breaks Vercel | High   | ✅ Verified: `npm run build` succeeds, routes present          |
| Career context exceeds token limits       | Low    | `stripEmpty()` compresses data. Well within 200K window.       |
| Cost explosion from chat abuse            | Medium | Rate limit 20 req/min/IP. Graceful fallback for local dev.     |
| Existing pipeline breaks                  | High   | ✅ Verified: pipeline scripts NOT modified, all 315 tests pass |

---

## What This Plan Does NOT Cover

- Chat UI components (Plan 2B — Sprint 1 COMPLETE)
- Navigation changes (Plan 2B — Sprint 1 COMPLETE)
- CI/CD workflow updates (Plan 2C)
- Vercel config changes (Plan 2C)
- CLAUDE.md / README / TDD updates (Plan 2C)
- Database-backed RAG (Phase 3 — career data fits in prompt cache)
- Supabase Auth for tools mode gating (Phase 3)
