# Plan 2A: Backend — Career Agent Core + API Routes

> **Sequence:** Plan 2A (this) → Plan 2B (frontend) → Plan 2C (devops)
> **Branch:** `feat/phase2a-backend` from `main` → merge via PR
> **Depends on:** Nothing (first in sequence)
> **Blocks:** Plan 2B (frontend needs API routes), Plan 2C (devops needs new config)

---

## Objective

Extract the AI generation logic from CLI scripts into a reusable agent package, stand up Next.js API routes for chat and resume generation, and remove the static-export constraint. The frontend (Plan 2B) and deployment config (Plan 2C) are handled in subsequent plans.

---

## Architecture Decisions

### Drop Modal — Use Vercel Fluid Compute

The original plan called for a Modal container to host the agent. This is wrong for this workload:

- Modal requires Python functions — language mismatch with our TypeScript codebase
- We are proxying to Anthropic's API, not running custom inference — Modal's GPU infra adds zero value
- Vercel Pro ($20/mo) with Fluid Compute supports 800-second function durations, more than enough for Opus resume generation (30-60s)
- Eliminates an entire deployment platform, billing relationship, and network hop

**Decision:** All AI workloads run as Next.js API routes on Vercel Fluid Compute.

### Vercel AI SDK 6 (not raw Anthropic SDK)

Use `ai@6.x` + `@ai-sdk/anthropic` for all API route handlers. This gives us:

- `streamText()` with built-in SSE response formatting
- `ToolLoopAgent` class for multi-step tool use
- `stopWhen(stepCountIs(n))` for bounded agent loops
- Prompt caching via `providerOptions.anthropic.cacheControl`
- Extended thinking via `providerOptions.anthropic.thinking`
- Structured outputs for resume JSON validation
- Anthropic built-in tools (web search, code execution) if needed later
- Provider-agnostic model switching

### Vercel AI Gateway

Use `@ai-sdk/gateway` for model routing. Benefits:

- Unified API key management (`AI_GATEWAY_API_KEY` env var)
- Zero markup on token costs + $5/mo free credit
- Built-in observability (latency, tokens, errors per call)
- Budget controls per project
- Failover/retry across providers

### Model Routing

| Use Case                       | Model               | Rationale                        |
| ------------------------------ | ------------------- | -------------------------------- |
| Chat Q&A                       | `claude-sonnet-4-6` | Fast, $3/$15 per MTok            |
| Resume generation              | `claude-opus-4-6`   | Highest quality, $5/$25 per MTok |
| Intent classification (future) | `claude-haiku-4-5`  | $1/$5 per MTok                   |

### Prompt Caching Strategy

Career data (~90K tokens) goes in the system prompt with `cache_control: { type: "ephemeral" }` (5-min TTL). Cost impact:

- Cache write: 1.25x base input ($3.75/MTok for Sonnet)
- Cache read: 0.1x base input ($0.30/MTok for Sonnet)
- First message: ~$0.34 (cache creation)
- Subsequent messages: ~$0.03 each (cache read + small output)
- 10-message conversation: ~$0.60

---

## Implementation Steps

### Step 1: Dependencies + Config

**New dependencies:**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/react @ai-sdk/gateway @upstash/ratelimit @vercel/kv
```

| Package              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `ai@^6.0`            | Vercel AI SDK 6 core (streamText, ToolLoopAgent, stopWhen) |
| `@ai-sdk/anthropic`  | Claude provider (caching, thinking, built-in tools)        |
| `@ai-sdk/react`      | React hooks (useChat) — installed here, used in Plan 2B    |
| `@ai-sdk/gateway`    | Vercel AI Gateway provider                                 |
| `@upstash/ratelimit` | Distributed rate limiting                                  |
| `@vercel/kv`         | Serverless KV store for rate limit state                   |

**Update `next.config.ts`:**

```typescript
const nextConfig: NextConfig = {
  // output: "export" — REMOVED for Phase 2 (API routes require server runtime)
  // Resume page auto-detected as static by Next.js and pre-rendered at build time
};
```

**Update `tsconfig.json`** — add path aliases:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@paulprae/agent": ["./packages/agent/src/index.ts"],
      "@paulprae/agent/*": ["./packages/agent/src/*"],
      "@paulprae/career-data": ["./packages/career-data/src/index.ts"],
      "@paulprae/career-data/*": ["./packages/career-data/src/*"],
    },
  },
}
```

**Create directory skeleton:**

```
packages/agent/src/
packages/agent/prompts/
packages/agent/tests/
packages/career-data/src/
packages/career-data/tests/
```

**Verification:** `npm test` — all existing tests pass. `npm run build` — succeeds without `output: 'export'`.

---

### Step 2: Extract Career Data Package (`packages/career-data/`)

Move shared types, config, and data loading into a reusable package.

| Source                                    | Target                               | Content                                                   |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `lib/types.ts` (CareerData types)         | `packages/career-data/src/types.ts`  | CareerData, CareerProfile, CareerPosition, KnowledgeEntry |
| `lib/config.ts` (PATHS, RESUME_FILE_BASE) | `packages/career-data/src/config.ts` | File paths, resume naming                                 |
| `lib/career-data.ts`                      | `packages/career-data/src/loader.ts` | `loadCareerData()`                                        |

**Keep originals as re-exports** during migration (no breaking changes):

```typescript
// lib/types.ts
export * from "@paulprae/career-data/types";
// ... plus remaining types not moved
```

**Tests:** Port relevant tests from `tests/config.test.ts` → `packages/career-data/tests/`.

**Verification:** All existing imports resolve. All tests pass.

---

### Step 3: Build Agent Core (`packages/agent/`)

#### 3.1 Context Builder (`packages/agent/src/context.ts`)

Extract from `scripts/generate-resume.ts`:

- `stripEmpty()` — remove null/empty fields to save tokens
- `loadCompanyData()` — load knowledge base company entries
- `buildCareerDocuments()` — format career data as XML-tagged documents

**Interface:**

```typescript
export interface CareerContext {
  careerData: CareerData;
  companyData: CompanyEntry[];
  documentsXml: string;
  estimatedTokens: number;
}

export function buildCareerContext(): CareerContext;
```

**Key design:** Career documents go in the system prompt (not user message) to enable prompt caching across multi-turn conversations.

#### 3.2 Agent Prompts

**`packages/agent/prompts/career-chat.system.md`:**

- Role: Paul Prae's career assistant
- Grounding: Only answer from provided career data. Cite specific positions/companies.
- Tone: Professional, helpful, concise. Third-person about Paul.
- Include contact info and resume download links.
- Handle off-topic questions gracefully.

**`packages/agent/prompts/resume-generator.system.md`:**

- Adapted from existing `lib/prompts/resume-writer.system.md` (v2.0)
- All 8 grounding rules (G1-G8) preserved
- All 10 quality rules preserved
- New: `<job_description_instructions>` section for tailoring to JDs
- Few-shot examples from `resume-writer.few-shot.md`

#### 3.3 Agent Definition (`packages/agent/src/career-agent.ts`)

Use the **Vercel AI SDK 6 `ToolLoopAgent`** pattern:

```typescript
import { ToolLoopAgent, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const chatAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: chatSystemPrompt,
  tools: {
    generate_resume: {
      description: "Generate a custom resume tailored to a job description",
      inputSchema: z.object({
        jobDescription: z.string(),
        emphasisAreas: z.array(z.string()).optional(),
      }),
      execute: async ({ jobDescription, emphasisAreas }) => {
        // Calls Opus 4.6 for high-quality generation
        return generateTailoredResume(jobDescription, emphasisAreas);
      },
    },
    get_contact_info: {
      description: "Get Paul's contact information",
      inputSchema: z.object({}),
      execute: async () => extractContactInfo(careerContext),
    },
  },
  stopWhen: stepCountIs(5),
});
```

**Model routing:** Chat uses Sonnet 4.6. The `generate_resume` tool internally calls Opus 4.6 via a separate `generateText()` call with structured outputs.

**Prompt caching integration:**

```typescript
// System prompt with cached career data
const systemBlocks = [
  { type: "text" as const, text: agentPrompt },
  {
    type: "text" as const,
    text: context.documentsXml,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  },
];
```

#### 3.4 Resume Generation with Structured Outputs

```typescript
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function generateTailoredResume(jobDescription: string, emphasisAreas?: string[]) {
  const result = await generateText({
    model: anthropic("claude-opus-4-6"),
    system: resumeSystemPrompt,
    messages: [
      {
        role: "user",
        content: buildResumeUserMessage(careerContext, jobDescription, emphasisAreas),
      },
    ],
    providerOptions: {
      anthropic: {
        thinking: { type: "adaptive" },
        cacheControl: { type: "ephemeral" },
      },
    },
    maxOutputTokens: 8_192,
  });

  return {
    markdown: result.text,
    usage: result.usage,
  };
}
```

#### 3.5 Config (`lib/config.ts` additions)

```typescript
export const AGENT = {
  chatModel: "claude-sonnet-4-6" as const,
  resumeModel: "claude-opus-4-6" as const,
  chatMaxTokens: 4_096,
  resumeMaxTokens: 8_192,
  maxAgentSteps: 5,
  rateLimitPerMinute: 20,
} as const;
```

---

### Step 4: API Routes

#### 4.1 Chat Route (`app/api/chat/route.ts`)

```typescript
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildCareerContext } from "@paulprae/agent/context";
import { loadPrompt } from "@/lib/prompts/loader";

export const maxDuration = 60; // Vercel Fluid Compute timeout

const context = buildCareerContext(); // Loaded once at cold start
const chatPrompt = loadPrompt("career-chat");

export async function POST(request: Request) {
  // Rate limiting (see step 5)
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: [
      { type: "text", text: chatPrompt.content },
      {
        type: "text",
        text: context.documentsXml,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
    ],
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4_096,
  });

  return result.toUIMessageStreamResponse();
}
```

#### 4.2 Resume Route (`app/api/resume/route.ts`)

Separate route for long-running Opus generation:

```typescript
export const maxDuration = 300; // 5 minutes for Opus generation

export async function POST(request: Request) {
  const { jobDescription, emphasisAreas } = await request.json();
  // ... call generateTailoredResume(), return streamed result
}
```

#### 4.3 Rate Limiting (`packages/agent/src/rate-limit.ts`)

Production rate limiting with Upstash + Vercel KV:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import kv from "@vercel/kv";

export const chatRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(20, "60 s"),
});
```

Fallback: in-memory `Map<string, number[]>` for local development.

---

### Step 5: Tests

| Test File                                   | Coverage                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| `packages/agent/tests/context.test.ts`      | buildCareerContext(), buildCareerDocuments(), stripEmpty()   |
| `packages/agent/tests/career-agent.test.ts` | Agent definition, tool schemas, model routing                |
| `packages/career-data/tests/loader.test.ts` | loadCareerData(), config paths                               |
| `tests/agent-api.test.ts`                   | API routes: POST/GET methods, rate limiting, response format |

**Verification:** All existing tests pass. New tests pass. `npm run build` succeeds.

---

## Environment Variables (New)

| Variable             | Where                 | Purpose                                              |
| -------------------- | --------------------- | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | `.env.local` + Vercel | Claude API access                                    |
| `AI_GATEWAY_API_KEY` | Vercel only           | Vercel AI Gateway (optional, enhances observability) |
| `KV_REST_API_URL`    | Vercel only           | Upstash KV for rate limiting                         |
| `KV_REST_API_TOKEN`  | Vercel only           | Upstash KV auth                                      |

---

## Risk Mitigation

| Risk                                      | Impact | Mitigation                                                                                           |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Removing `output: 'export'` breaks Vercel | High   | Resume page auto-detected as static by Next.js. Verify with `npm run build` + Vercel preview deploy. |
| Career context exceeds token limits       | Low    | `stripEmpty()` compresses to ~90K tokens. Well within 200K standard window.                          |
| Cost explosion from chat abuse            | Medium | Rate limit 20 req/min/IP. Sonnet pricing ($3/$15). Prompt caching (10x cheaper after turn 1).        |
| Existing pipeline breaks                  | High   | Scripts NOT modified — agent extracts (copies) functions. Pipeline works independently.              |

---

## What This Plan Does NOT Cover

- Chat UI components (Plan 2B)
- Navigation changes (Plan 2B)
- CI/CD workflow updates (Plan 2C)
- Vercel config changes (Plan 2C)
- CLAUDE.md / README / TDD updates (Plan 2C)
- Modal deployment (dropped entirely)
