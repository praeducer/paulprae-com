# Plan: Career Agent — Monorepo Refactor + Deployable AI Agent

## Context

paulprae.com is currently a Phase 1 static site with a CLI-based resume generation pipeline. The AI generation logic (Claude Opus 4.6 calls, prompt engineering, validation) is tightly coupled to the `scripts/generate-resume.ts` script, which also depends on the data ingestion step and feeds into the document export step.

**Goal:** Refactor into a well-organized monorepo and build a deployable career agent that:

1. Powers a `/chat` page where recruiters ask questions about Paul's background (Sonnet 4.6)
2. Generates custom resumes tailored to job descriptions (Opus 4.6)
3. Runs as a Claude Agent SDK container on Modal
4. Is decoupled from data ingestion (CSV parsing) and document formatting (Pandoc/Typst)

**User decisions:**

- Hosting: Claude Agent SDK container on **Modal**
- Chat model: **Sonnet 4.6** (fast, cheap for Q&A)
- Resume model: **Opus 4.6** (highest quality)
- Data access: **Cached system prompt** (career data in system prompt with prompt caching — 90% cost savings after first turn)
- Chat UI: **Dedicated `/chat` page** (not floating bubble)
- Branch: **`feat/agent-api`** feature branch, merge via PR when ready

---

## Monorepo Structure

The repo evolves from a flat structure into a domain-organized monorepo. No build tool change needed (npm workspaces are overkill for a single-app repo with shared packages) — just logical directory organization.

### Current → Target Structure

```
paulprae-com/
├── app/                          # Next.js App Router (KEEP — website)
│   ├── page.tsx                  #   Resume page (static/SSG)
│   ├── chat/                     #   NEW: Chat page
│   │   ├── page.tsx              #     Server component (metadata)
│   │   └── components/           #     Client components (ChatInterface, etc.)
│   ├── api/                      #   NEW: API routes (requires removing output:'export')
│   │   └── chat/
│   │       └── route.ts          #     Chat API → Anthropic/Modal proxy
│   ├── components/               #   Shared UI components
│   └── layout.tsx                #   Root layout
│
├── packages/                     # NEW: Shared packages (domain-organized)
│   ├── agent/                    #   Career agent core (deployable independently)
│   │   ├── src/
│   │   │   ├── career-agent.ts   #     Main agent class
│   │   │   ├── context.ts        #     Career context builder (extracted from generate-resume.ts)
│   │   │   ├── tools.ts          #     Agent tool definitions
│   │   │   ├── rate-limit.ts     #     Request rate limiting
│   │   │   └── index.ts          #     Barrel export
│   │   ├── prompts/
│   │   │   ├── career-chat.system.md          # Chat system prompt (Sonnet)
│   │   │   ├── career-chat.config.json
│   │   │   ├── resume-generator.system.md     # Resume gen prompt (adapted from resume-writer)
│   │   │   ├── resume-generator.few-shot.md
│   │   │   └── resume-generator.config.json
│   │   ├── tests/
│   │   │   ├── context.test.ts
│   │   │   └── career-agent.test.ts
│   │   └── package.json          #     { "name": "@paulprae/agent" } (internal)
│   │
│   └── career-data/              #   Career data types + loaders (shared between agent + pipeline)
│       ├── src/
│       │   ├── types.ts          #     CareerData, CareerPosition, KnowledgeEntry, etc.
│       │   ├── loader.ts         #     loadCareerData(), loadCompanyData()
│       │   ├── config.ts         #     PATHS, RESUME_FILE_BASE
│       │   └── index.ts
│       ├── tests/
│       │   └── loader.test.ts
│       └── package.json          #     { "name": "@paulprae/career-data" } (internal)
│
├── scripts/                      # Pipeline scripts (KEEP — CLI tools)
│   ├── ingest-linkedin.ts        #   CSV → career-data.json (unchanged)
│   ├── generate-resume.ts        #   Claude API → resume markdown (refactored to use packages/agent)
│   ├── export-resume.ts          #   Pandoc/Typst → PDF/DOCX (unchanged)
│   ├── compare-resumes.ts        #   Review tool (unchanged)
│   ├── approve-resume.ts         #   Approval gate (unchanged)
│   ├── smoke-test.ts             #   Deployment verification (unchanged)
│   └── setup-branch-protection.sh
│
├── deploy/                       # NEW: Deployment configurations
│   ├── modal/                    #   Modal container for agent
│   │   ├── app.py                #     Modal app definition
│   │   ├── server.ts             #     Agent HTTP server
│   │   ├── Dockerfile            #     Container image
│   │   └── deploy.sh             #     Deployment script
│   └── vercel/                   #   Vercel config documentation
│       └── README.md             #     Dashboard settings checklist
│
├── data/                         # Career data (KEEP — pipeline I/O)
│   ├── sources/
│   │   ├── linkedin/             #     CSV exports (gitignored)
│   │   └── knowledge/            #     Knowledge base JSONs (committed)
│   └── generated/                #     Pipeline outputs (career-data.json, resume.md)
│
├── lib/                          # Shared utilities (KEEP — gradually migrate to packages/)
│   ├── ai/                       #   AI service layer (client, telemetry, errors)
│   ├── prompts/                  #   Existing prompt system (loader, resume-writer)
│   ├── ingest/                   #   Ingestion modules
│   ├── markdown.ts               #   Markdown utilities
│   └── ui-utils.ts               #   UI helpers
│
├── tests/                        # Integration + existing tests (KEEP)
│   ├── agent-api.test.ts         #   NEW: API route tests
│   └── *.test.ts                 #   Existing 314 tests
│
├── docs/                         # Documentation
│   ├── agent-architecture.md     #   NEW: Agent system design
│   ├── deployment.md             #   Deployment setup (exists)
│   └── *.md                      #   Existing docs
│
├── .github/workflows/            # CI/CD (KEEP)
├── CLAUDE.md                     # Project instructions (UPDATE for Phase 2)
├── next.config.ts                # Next.js config (UPDATE: remove output:'export')
├── vercel.json                   # Vercel config (UPDATE: CSP, serverless)
├── package.json                  # Root package.json
└── tsconfig.json                 # TypeScript config
```

### Monorepo Strategy: Path Aliases (Not Workspaces)

For a single-app repo with shared internal packages, **TypeScript path aliases** are simpler than npm workspaces:

```jsonc
// tsconfig.json additions
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

No publish step, no workspace linking, no build orchestration. Imports resolve directly to source files. When/if the agent needs true independent deployment (its own `npm ci`), extract to an npm workspace at that point.

---

## Implementation Phases

### Phase 1: Foundation — Branch, Dependencies, Monorepo Skeleton

**Branch:** Create `feat/agent-api` from `main`

**New dependencies:**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/react
```

- `ai` — Vercel AI SDK 6 (streaming, tools)
- `@ai-sdk/anthropic` — Claude provider (prompt caching, extended thinking)
- `@ai-sdk/react` — React hooks (`useChat`)

**Create directory structure:**

```
packages/agent/src/
packages/agent/prompts/
packages/agent/tests/
packages/career-data/src/
packages/career-data/tests/
deploy/modal/
```

**Update tsconfig.json** with path aliases.

**Files to create/modify:**

- `packages/agent/src/index.ts` (empty barrel)
- `packages/career-data/src/index.ts` (empty barrel)
- `tsconfig.json` (add paths)
- `package.json` (add dependencies)

**Verification:** `npm test` — all 314 existing tests pass. `npm run build` — builds successfully.

---

### Phase 2: Extract Career Data Package

Extract shared types, config, and data loading into `packages/career-data/`.

**Extract from existing files:**

| Source                                    | Target                               | What                                                            |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `lib/types.ts` (CareerData section)       | `packages/career-data/src/types.ts`  | CareerData, CareerProfile, CareerPosition, KnowledgeEntry, etc. |
| `lib/config.ts` (PATHS, RESUME_FILE_BASE) | `packages/career-data/src/config.ts` | File paths, resume file naming                                  |
| `lib/career-data.ts`                      | `packages/career-data/src/loader.ts` | `loadCareerData()`                                              |

**Keep originals as re-exports** during migration:

```typescript
// lib/types.ts — backward compatibility
export * from "@paulprae/career-data/types";
// ... plus remaining types not moved (IngestResult, GenerationResult, etc.)
```

**Tests:** Move relevant tests from `tests/config.test.ts` → `packages/career-data/tests/`.

**Verification:** All existing imports still resolve. All tests pass.

---

### Phase 3: Build Agent Core (`packages/agent/`)

This is the main deliverable — the decoupled resume generation agent.

#### 3.1 Context Builder (`packages/agent/src/context.ts`)

Extract and refactor from `scripts/generate-resume.ts`:

**Functions to extract:**

- `stripEmpty()` (line 74) → `packages/agent/src/context.ts`
- `loadCompanyData()` (line 100) → `packages/agent/src/context.ts`
- `buildUserMessage()` (line 114) → rename to `buildCareerDocuments()`

**New interface:**

```typescript
export interface CareerContext {
  careerData: CareerData;
  companyData: CompanyEntry[];
  /** XML-tagged documents string for embedding in system prompts */
  documentsXml: string;
  /** Estimated token count */
  estimatedTokens: number;
}

export function buildCareerContext(): CareerContext;
export function buildCareerDocuments(careerData: CareerData, companyData: CompanyEntry[]): string;
```

**Key change:** Career documents move from the user message to the system prompt. This enables Anthropic prompt caching across multi-turn conversations (90% cheaper after first turn).

#### 3.2 Agent Prompts

**`packages/agent/prompts/career-chat.system.md`:**

```yaml
---
id: career-chat
version: "1.0"
description: Career Q&A chatbot for recruiters and hiring managers
tags: [chat, career, recruiter]
---
```

- Role: Paul Prae's career assistant
- Rules: Only answer from provided data. Cite specific positions/companies. No fabrication.
- Tone: Professional, helpful, concise. Third-person about Paul.
- Include contact info and resume download links when relevant.
- Handle off-topic questions gracefully.

**`packages/agent/prompts/resume-generator.system.md`:**

- Adapted from existing `lib/prompts/resume-writer.system.md` (292 lines, v2.0)
- All 8 grounding rules (G1-G8) preserved
- All 10 quality rules preserved
- **New:** `<job_description_instructions>` section for tailoring resumes to JDs
- **New:** Instructions to emphasize matching skills/experience from the JD
- Few-shot examples adapted from `resume-writer.few-shot.md`

#### 3.3 Tool Definitions (`packages/agent/src/tools.ts`)

Tools for the chat agent to invoke:

```typescript
export const agentTools = {
  generate_resume: {
    description: "Generate a custom resume tailored to a job description",
    parameters: z.object({
      jobDescription: z.string().describe("The full job description text"),
      emphasisAreas: z.array(z.string()).optional(),
    }),
  },
  get_contact_info: {
    description: "Get Paul's contact information for the recruiter",
    parameters: z.object({}),
  },
};
```

**Design note:** Since career data is in the cached system prompt, the chat agent doesn't need data-fetching tools — it can answer directly from context. `generate_resume` is the only tool that triggers a separate API call (to Opus 4.6).

#### 3.4 Main Agent (`packages/agent/src/career-agent.ts`)

```typescript
export class CareerAgent {
  private context: CareerContext;
  private sessions: Map<string, ChatMessage[]>;

  constructor();

  /** Multi-turn chat (Sonnet 4.6, streaming) */
  async chat(message: string, sessionId?: string): AsyncGenerator<string>;

  /** Single-turn resume generation (Opus 4.6, complete response) */
  async generateResume(jobDescription: string): Promise<{
    markdown: string;
    usage: TokenUsage;
    warnings: string[];
    qualityScore: number;
  }>;
}
```

**Reused from existing code:**

- Error classification: `lib/ai/client.ts` → `classifyError()`, `AiError` hierarchy
- Telemetry: `lib/ai/telemetry.ts` → `estimateCost()`, `logGeneration()`
- Prompt loading: `lib/prompts/loader.ts` → `loadPrompt()`
- Validation: `scripts/generate-resume.ts` → `validateResumeOutput()`, `scoreResume()` (extracted)
- Streaming: `lib/ai/client.ts` → `client.messages.stream()` pattern

**Model routing:**

```typescript
const MODELS = {
  chat: "claude-sonnet-4-6", // Fast Q&A: $3/$15 per MTok
  resume: "claude-opus-4-6", // Quality gen: $15/$75 per MTok
};
```

**Prompt caching strategy:**

```typescript
// System prompt blocks (cached across turns)
const systemBlocks = [
  { type: "text", text: agentPrompt }, // ~5K tokens
  { type: "text", text: context.documentsXml, cache_control: { type: "ephemeral" } }, // ~90K tokens
];
```

**Cost per conversation (Sonnet 4.6 chat):**

- First message: ~$0.10 (cache creation of ~90K tokens)
- Each subsequent message: ~$0.01 (cache read + small output)
- 10-message conversation: ~$0.20

#### 3.5 Config Addition (`lib/config.ts`)

```typescript
export const AGENT = {
  chatModel: "claude-sonnet-4-6" as const,
  resumeModel: "claude-opus-4-6" as const,
  chatMaxTokens: 4_096,
  resumeMaxTokens: 128_000,
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxSessionMessages: 50,
  enableTools: true,
} as const;
```

**Verification:** `npm test` — all tests pass. Agent unit tests validate context building, session management, tool definitions.

---

### Phase 4: API Layer — Remove Static Export, Add Chat Route

#### 4.1 Remove Static Export

**`next.config.ts`:**

```typescript
const nextConfig: NextConfig = {
  // output: "export" — REMOVED for Phase 2 (API routes require server)
  // Resume page auto-detected as static and pre-rendered by Next.js
};
```

**Impact:** The resume page (`app/page.tsx`) uses only server components with `fs.readFileSync` at build time. Next.js detects it as static and pre-renders it. No behavioral change.

**`vercel.json` updates:**

- Remove `"framework": null` (let Vercel auto-detect Next.js)
- Remove `"outputDirectory": "out"` (Vercel handles `.next/` output)
- Keep `"buildCommand": "npm run build"`
- Keep all security headers
- Update CSP: `connect-src 'self' https://paulprae.com`
- Add API-specific headers: `Cache-Control: no-store` on `/api/*`

#### 4.2 Chat API Route (`app/api/chat/route.ts`)

**Two-phase implementation:**

- **Phase 4a (Direct):** API route calls Anthropic directly via Vercel AI SDK. Works on Vercel immediately. No Modal dependency.
- **Phase 4b (Modal proxy):** Once Modal is deployed, switch to proxying requests. Offloads compute.

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildCareerContext } from "@paulprae/agent/context";

const context = buildCareerContext(); // Loaded once at cold start

export async function POST(request: Request) {
  const { messages, mode } = await request.json();

  const model = mode === "resume" ? "claude-opus-4-6" : "claude-sonnet-4-6";

  const result = streamText({
    model: anthropic(model),
    system: [
      { type: "text", text: chatSystemPrompt },
      {
        type: "text",
        text: context.documentsXml,
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
    ],
    messages,
    maxTokens: mode === "resume" ? 128_000 : 4_096,
  });

  return result.toDataStreamResponse();
}
```

#### 4.3 Rate Limiting (`packages/agent/src/rate-limit.ts`)

In-memory sliding window: 20 requests/minute per IP.

```typescript
export class RateLimiter {
  check(ip: string): boolean;
}
```

**Verification:** `npm run build` succeeds (no static export errors). Verify resume page still renders. API route responds to POST.

---

### Phase 5: Chat UI (`app/chat/`)

#### 5.1 Page Structure

```
app/chat/
  page.tsx                    # Server component: metadata + ChatInterface
  components/
    ChatInterface.tsx         # "use client" — useChat hook, mode state
    MessageList.tsx           # Message bubbles with react-markdown
    ChatInput.tsx             # Auto-resizing textarea, Enter to submit
    ModeSelector.tsx          # "Ask about Paul" / "Generate Resume" tabs
```

#### 5.2 Chat Interface (`app/chat/components/ChatInterface.tsx`)

```typescript
"use client";
import { useChat } from "@ai-sdk/react";

export default function ChatInterface() {
  const [mode, setMode] = useState<"chat" | "resume">("chat");
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: { mode },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <ModeSelector mode={mode} onModeChange={setMode} />
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput input={input} onChange={handleInputChange}
        onSubmit={handleSubmit} isLoading={isLoading} mode={mode} />
    </div>
  );
}
```

#### 5.3 Styling

All Tailwind CSS per project convention. Chat-specific utilities in `app/globals.css`:

```css
.chat-message-user {
  @apply bg-blue-50 dark:bg-blue-950 rounded-2xl px-4 py-3;
}
.chat-message-assistant {
  @apply bg-slate-50 dark:bg-slate-900 rounded-2xl px-4 py-3;
}
```

#### 5.4 Navigation

- Add "Chat" link in `app/page.tsx` header alongside Email/LinkedIn/GitHub links
- Update `app/layout.tsx` metadata for multi-page site

**Verification:** `npm run dev` → visit `/chat` → send a message → streaming response renders.

---

### Phase 6: Modal Deployment (`deploy/modal/`)

**Can be deferred** — Phase 4a (direct Anthropic calls from Vercel) works without Modal.

#### 6.1 Modal Container

```
deploy/modal/
  app.py              # Modal app definition
  server.ts           # Node.js HTTP server wrapping CareerAgent
  Dockerfile          # Node.js 24 + agent code
  deploy.sh           # Deployment automation
```

**`deploy/modal/server.ts`** — Lightweight HTTP server (node:http, no Express):

- `POST /chat` — SSE streaming chat response
- `POST /generate` — Complete resume generation
- `GET /health` — Health check

**`deploy/modal/app.py`** — Modal configuration:

```python
app = modal.App("paulprae-career-agent")
image = modal.Image.from_dockerfile("Dockerfile")

@app.function(image=image, secrets=[modal.Secret.from_name("anthropic-api-key")],
              timeout=300, memory=512, cpu=1)
@modal.web_endpoint(method="POST")
async def chat(request): ...
```

**Environment:**

- `ANTHROPIC_API_KEY` — Modal secret
- `AGENT_AUTH_TOKEN` — Shared secret for website ↔ Modal auth

#### 6.2 Switching to Modal Proxy

When Modal is deployed, update `app/api/chat/route.ts` to proxy:

```typescript
// Phase 4b: proxy to Modal
const MODAL_URL = process.env.MODAL_AGENT_URL;
const response = await fetch(`${MODAL_URL}/chat`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.AGENT_AUTH_TOKEN}` },
  body: JSON.stringify({ messages, mode }),
});
return new Response(response.body, { headers: { "Content-Type": "text/event-stream" } });
```

---

### Phase 7: Tests + Documentation

#### 7.1 New Tests

| Test File                                   | What                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| `packages/agent/tests/context.test.ts`      | buildCareerContext(), buildCareerDocuments(), stripEmpty() |
| `packages/agent/tests/career-agent.test.ts` | Session management, model routing, tool definitions        |
| `packages/career-data/tests/loader.test.ts` | loadCareerData(), loadCompanyData(), config paths          |
| `tests/agent-api.test.ts`                   | API route: POST/GET methods, rate limiting, SSE format     |

#### 7.2 Existing Test Compatibility

All 314 existing tests must pass. Key risks:

- `tests/generate.test.ts` — Tests `buildUserMessage()` which still exists in `scripts/generate-resume.ts` (extracted, not moved). Risk: **low**.
- `tests/config.test.ts` — Adding `AGENT` config alongside `CLAUDE` config. Risk: **none**.
- `tests/pipeline.test.ts` — Pipeline scripts unchanged. Risk: **none**.

#### 7.3 Documentation Updates

| File                         | Change                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                  | Update phase to "Phase 2", add `packages/` and `deploy/` to file org, move AI SDK from "do NOT install" to tech stack, remove `output: 'export'` rule |
| `README.md`                  | Add agent architecture section, new commands, chat page                                                                                               |
| `docs/agent-architecture.md` | NEW: Full agent design doc (context caching, model routing, tool use, deployment)                                                                     |
| `deploy/modal/README.md`     | Modal deployment guide                                                                                                                                |

---

## Implementation Order (Commit Strategy)

Given other agents may work on the same branch, commit after each step:

| #   | Step                             | New Files                                                         | Modified Files                               |
| --- | -------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| 1   | Branch + deps + skeleton         | `packages/*/src/index.ts`                                         | `package.json`, `tsconfig.json`              |
| 2   | Career data package              | `packages/career-data/src/*`                                      | `lib/types.ts`, `lib/config.ts` (re-exports) |
| 3   | Agent context + prompts          | `packages/agent/src/context.ts`, `packages/agent/prompts/*`       | —                                            |
| 4   | Agent core + tools               | `packages/agent/src/career-agent.ts`, `tools.ts`, `rate-limit.ts` | `lib/config.ts`                              |
| 5   | Agent tests                      | `packages/agent/tests/*`, `packages/career-data/tests/*`          | —                                            |
| 6   | Remove static export + API route | `app/api/chat/route.ts`                                           | `next.config.ts`, `vercel.json`              |
| 7   | Chat UI                          | `app/chat/**`                                                     | `app/page.tsx`, `app/globals.css`            |
| 8   | Documentation                    | `docs/agent-architecture.md`                                      | `CLAUDE.md`, `README.md`                     |
| 9   | Modal deployment (deferred)      | `deploy/modal/*`                                                  | `app/api/chat/route.ts`                      |

---

## Risk Mitigation

| Risk                                      | Impact | Mitigation                                                                                                                                     |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Removing `output: 'export'` breaks Vercel | High   | Resume page auto-detected as static by Next.js. Verify with `npm run build` + Vercel preview deploy before merging.                            |
| Career context exceeds token limits       | Medium | `stripEmpty()` saves 20-30%. career-data.json (~259KB) + knowledge (~252KB) after stripping ≈ 90-100K tokens. Well within 200K context window. |
| Cost explosion from chat abuse            | Medium | Sonnet 4.6 ($3/$15 vs Opus $15/$75). Prompt caching (90% cheaper after turn 1). Rate limit 20 req/min/IP. chatMaxTokens: 4096.                 |
| Existing pipeline breaks                  | High   | Scripts are NOT modified — agent extracts (copies) functions. generate-resume.ts continues to work independently.                              |
| CSP blocks API calls                      | Low    | Update `connect-src` in vercel.json before deploying API routes.                                                                               |
| Import path changes break tests           | Medium | Original `lib/` files become re-exports during migration. All imports continue to resolve.                                                     |

---

## Verification Checklist

After each phase:

- [ ] `npm test` — All existing 314+ tests pass
- [ ] `npm run lint && npm run format:check` — Clean
- [ ] `npm run build` — Builds successfully

After Phase 6 (API route):

- [ ] `npm run dev` → `curl -X POST localhost:3000/api/chat -d '{"messages":[{"role":"user","content":"test"}]}'` returns SSE stream
- [ ] Resume page (`/`) still renders correctly

After Phase 7 (chat UI):

- [ ] `npm run dev` → visit `/chat` → send message → streaming response
- [ ] Mode toggle switches between chat/resume
- [ ] Resume generation with job description produces tailored markdown

End-to-end:

- [ ] `npm run check` — Full release checklist passes
- [ ] Vercel preview deployment works (both `/` and `/chat`)
- [ ] Smoke tests pass against preview URL

---

## Technology Reference

| Component       | Technology                       | Version             | Purpose                               |
| --------------- | -------------------------------- | ------------------- | ------------------------------------- |
| Chat streaming  | Vercel AI SDK                    | 6.x                 | `streamText`, `useChat`, SSE          |
| Claude provider | `@ai-sdk/anthropic`              | latest              | Prompt caching, extended thinking     |
| Chat hooks      | `@ai-sdk/react`                  | latest              | `useChat` React hook                  |
| Agent hosting   | Modal                            | latest              | Serverless container, auto-scaling    |
| Agent SDK       | `@anthropic-ai/claude-agent-sdk` | latest              | Autonomous agent (Phase 3b)           |
| Chat model      | Claude Sonnet 4.6                | `claude-sonnet-4-6` | Fast Q&A ($3/$15 per MTok)            |
| Resume model    | Claude Opus 4.6                  | `claude-opus-4-6`   | Quality generation ($15/$75 per MTok) |
| Prompt caching  | Anthropic ephemeral cache        | 5-min TTL           | 90% input cost reduction after turn 1 |

**Key API patterns:**

- Streaming: `client.messages.stream()` → SSE events → `toDataStreamResponse()`
- Prompt caching: `cache_control: { type: "ephemeral" }` on system prompt text blocks
- Tool use: JSON Schema definitions, `stop_reason: "tool_use"`, tool_result messages
- Adaptive thinking: `thinking: { type: "adaptive" }` (Opus 4.6 only)

---

## Carried Forward — From Prior Plans

Items deferred from the Phase 1 refactoring (now archived) that are directly relevant to the agent and chat interface work.

- [ ] **Knowledge base schema standardization** — Structured `KnowledgeDocument` type with Zod validation. Needed for `packages/career-data/` and agent context building. Was deferred until pgvector/Phase 2.
- [ ] **Skills architecture documentation** — Document how prompt files map to agent skills. Was deferred until a second prompt existed. Now needed for `career-chat.system.md` + `resume-generator.system.md`.
- [ ] **Tailored resume generation CLI** (`--job-url`, `--job-text` flags) — The agent's `generateResume(jobDescription)` implements this for the API. Also add CLI flags to `scripts/generate-resume.ts` for local use.
- [ ] **Knowledge-base audit tests** — Schema validity, coverage, required fields. Needed before career data feeds the agent's cached system prompt.
