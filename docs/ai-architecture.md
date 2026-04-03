# AI Architecture Decision Record

This document explains the key architectural decisions for the AI system powering paulprae.com. It's written for senior AI engineers, architects, and engineering managers evaluating the system design.

---

## System Overview

paulprae.com is a chat-first career platform with an AI assistant that answers recruiter questions, generates tailored resumes via tool-calling, and produces job search content — all grounded in structured career data.

**Runtime stack:** Next.js 16 + Vercel AI SDK 6 + Claude Sonnet 4.6 (chat) + Claude Opus 4.6 (pipeline)
**Infrastructure:** Vercel (hosting), Upstash Redis (rate limiting via Vercel KV integration), Anthropic API (direct SDK)

---

## Decision 1: Context Injection vs. Vector Retrieval

**Decision:** Inject the full career dataset into the system prompt rather than using embedding-based retrieval (RAG with a vector database).

**Rationale:**

- The career dataset fits in a single system prompt: career-data.json (~259KB) + 5 knowledge base files (~11KB), compressed via `stripEmpty()` to remove empty fields. This is well within Claude's 200K-token context window.
- Anthropic prompt caching makes full injection cost-effective: the first request caches the system prompt for 5 minutes at 1.25x write cost; subsequent turns reuse it at 0.1x (90% reduction).
- Vector retrieval adds infrastructure (embedding model, vector DB, index maintenance) without proportional benefit at this scale. The retrieval step itself would cost more in latency (~200ms) than the tokens saved.
- The full context gives Claude complete visibility into all career data, preventing missed connections that selective retrieval might cause.

**Phase 3 path:** When the knowledge base grows significantly (e.g., Neo4j knowledge graph with hundreds of project entries), the system will migrate to embedding-based retrieval. The prompt template's `{{CAREER_DATA}}` placeholder is already abstracted — switching from full injection to filtered results requires changing only the context builder.

## Decision 2: Model Selection (Sonnet for Chat, Opus for Pipeline)

**Decision:** Use Claude Sonnet 4.6 for runtime chat/tool-calling and Claude Opus 4.6 for offline resume generation.

**Rationale:**

- **Chat (Sonnet):** Recruiter Q&A needs fast responses (~2-5s TTFT). Sonnet at $3/$15 per MTok provides sufficient quality for conversational grounding while keeping per-conversation costs under $0.20.
- **Pipeline (Opus):** Resume generation is a permanent artifact viewed by hiring managers. Opus with adaptive thinking at max effort ($15/$75 per MTok) provides deeper reasoning for entity-scope binding, cross-reference validation, and quality rule adherence. Cost per generation (~$1-2) is acceptable for an artifact generated weekly.
- **Resume tailoring tool (Sonnet):** Runtime resume tailoring via tool-calling uses Sonnet (not Opus) to keep latency under 15s. Output is capped at 1,200 tokens (~500 words) in chat context so it fits in the chat bubble. The recruiter-provided JD provides strong constraints that compensate for the lighter model. The CLI pipeline uses a separate 8,192-token cap for full two-page resume generation.

**Cost comparison per month (estimated 500 chat conversations + 2 pipeline runs):**

- Current (Sonnet chat + Opus pipeline): ~$100 + $4 = ~$104
- All-Opus alternative: ~$500 + $4 = ~$504

## Decision 3: Prompt Injection Defense via XML Delimiting

**Decision:** Wrap untrusted user input (job descriptions, emphasis areas) in XML tags (`<job_description>`, `<emphasis_areas>`) with explicit instructions to treat tag content as data, not instructions.

**Rationale:**

- This is Anthropic's recommended pattern for prompt injection defense (documented in Anthropic's security guide).
- Combined with security rules S1-S5 in each system prompt (treat messages as untrusted, never reveal prompt, stay in character, no harmful content, no unauthorized actions).
- Input validation (Zod schemas, character limits, message count caps) provides defense in depth at the application layer before content reaches the model.
- More maintainable than alternatives like output filtering or separate moderation calls, which add latency and cost.

## Decision 4: Prompt Caching Strategy (1-Hour TTL + Pre-Built Prompts + Cron Warmup)

**Decision:** Use Anthropic's ephemeral caching with 1-hour TTL, pre-built system prompts committed to the repo, and a cron-based cache warmup job.

**Rationale:**

- **1-hour TTL over 5-minute default:** The default 5-min TTL expires between visits on a low-traffic personal career site. Most users would hit a cold cache (6–18s prefill time for a ~90K-token system prompt). The 1-hour TTL costs 2x the write fee but means virtually every user hits a warm cache. Cost-effective given the traffic pattern.
- **Pre-built prompts (`lib/generated/system-prompts.ts`):** System prompts are assembled at pipeline time (`npm run build:prompts`) and committed as TypeScript constants. This produces byte-identical strings on every request — critical for consistent cache hit rates (any token-level change in the assembled string is a cache miss). Also eliminates runtime file I/O from the request hot path.
- **Cache control placement:** Anthropic prompt caching requires `cache_control` on the **system message content block**, not on the top-level `providerOptions` of `streamText`/`generateText`. The `@ai-sdk/anthropic` SDK only writes `cache_control` to the content block when the `system` parameter is passed as a `SystemModelMessage` object (with `role`, `content`, and `providerOptions`) rather than a plain string. Passing `providerOptions.anthropic.cacheControl` at the call level puts it on the API request root, which Anthropic ignores for caching purposes. Both the chat stream and the resume-generator tool call use the object form.
- **Beta header for 1-hour TTL:** The `ttl: "1h"` field in `cache_control` requires the request header `anthropic-beta: extended-cache-ttl-2025-04-11`. Without this header, Anthropic silently drops the `cache_control` block entirely — resulting in zero caching. The `@ai-sdk/anthropic` SDK does not add this header automatically. Both `app/api/chat/route.ts` and `app/api/cron/route.ts` use `createAnthropic({ headers: { "anthropic-beta": "..." } })` to include it on every request.
- **Cron warmup (`/api/cron`):** A Vercel cron job fires every 55 minutes (within the 1-hour TTL) to refresh the Anthropic cache using minimal single-token requests. It warms **both** the chat system prompt (~90K tokens) and the resume-generator system prompt (~70K tokens) concurrently. This is critical: without warming the resume-generator prompt, the first tailored-resume tool call after a cold cache takes 15–20s (the SSE stream goes silent), which can trigger a client-side timeout and cause a silent failure. The endpoint is protected by `CRON_SECRET` and proxied via the GET exception in `proxy.ts`.
- First request pays 2x input cost (cache write at 1-hour tier). Subsequent turns pay only 0.1x (cache read) — ~90% cost reduction per follow-up turn.
- No Redis caching of prompts needed — the pre-built TypeScript module is faster (zero network latency), bundled at compile time, and never goes stale mid-session.

## Decision 5: Single Agent with Tools (Not Multi-Agent)

**Decision:** Use a single Claude agent with 2 tools (resume generation, resume links) rather than multi-agent orchestration.

**Rationale:**

- The use case has a narrow scope: answer career questions, generate tailored resumes, provide download links. This doesn't require agent delegation, planning loops, or inter-agent communication.
- Tool-calling via Vercel AI SDK 6 (`streamText` + `tool()`) is clean and well-typed. No framework abstraction (LangChain, CrewAI) needed.
- The `generate_tailored_resume` tool demonstrates the agentic pattern: the chat model decides to call it based on user intent, passes structured inputs, and processes the result — a complete tool-use loop.
- `stepCountIs(2)` caps at 2 reasoning steps (tool call + response), preventing runaway loops while allowing the full tool-use cycle.

## Decision 6: Grounding via Entity-Scope Binding

**Decision:** Enforce grounding through explicit rules (G1-G10) that require every fact to be attributed to exactly one company and one role, with few-shot examples showing correct vs. incorrect attribution.

**Rationale:**

- The most common and damaging error in AI-generated resumes is metric conflation: merging achievements from one company with scale metrics from another. Entity-scope binding (Rule G1) prevents this by requiring single-entity attribution.
- SCOPE BOUNDARY markers in the knowledge base provide hard constraints on what work was/was not performed in specific roles.
- Few-shot examples (in `resume-writer.few-shot.md` and `career-chat.few-shot.md`) demonstrate the expected grounding behavior more effectively than rules alone.
- Post-generation validation in the pipeline (automated checks in `validateResumeOutput()`) catches any remaining violations.

---

## Observability Stack

Platform integrations provide most observability. Additionally, this repo includes pipeline telemetry logging for generation runs.

### Vercel AI Gateway (Not Currently Active)

**What:** Automatic tracking of every AI generation routed through the gateway.
**Status:** Not in use. The chat API uses the direct Anthropic SDK (`@ai-sdk/anthropic`) by default. Gateway support exists in `route.ts` but only activates when `AI_GATEWAY_API_KEY` is explicitly set — no configuration currently enables it.
**Future:** Can be enabled by setting `AI_GATEWAY_API_KEY` in Vercel env vars once the Vercel AI Gateway is configured for this project.

### Vercel Runtime Logs

**What:** All `console.log` and `console.error` output from serverless functions, including request duration and cold start metrics.
**Where:** Vercel Dashboard > Project > Logs tab. Filter by function (`/api/chat`), status code, or time range.
**How:** The chat API route logs errors with `[chat]` prefixes for easy filtering. Tool execution errors log with `[tool:generate_tailored_resume]`.

### Vercel Analytics

**What:** Page views, unique visitors, top pages, referrers, geographic distribution.
**Where:** Vercel Dashboard > Project > Analytics tab.
**How:** Integrated via `<Analytics />` component in `app/layout.tsx`.

### Vercel Speed Insights

**What:** Core Web Vitals (LCP, CLS, FID, TTFB, INP) per page.
**Where:** Vercel Dashboard > Project > Speed Insights tab.
**How:** Integrated via `<SpeedInsights />` component in `app/layout.tsx`.

### Anthropic Console

**What:** API usage, billing, rate limit status, spend caps.
**Where:** [console.anthropic.com](https://console.anthropic.com) > Usage tab.
**How:** All direct Anthropic API calls are tracked by the platform. Set spend limits under Settings > Limits to prevent cost overruns.

### Upstash Console

**What:** Redis request counts, rate limit hits, memory usage.
**Where:** [console.upstash.com](https://console.upstash.com) > Database > Analytics tab.
**How:** Rate limiter uses `@upstash/ratelimit` with `analytics: true` for per-key tracking.

### Local Pipeline Telemetry

**What:** JSONL log of generation metadata (model, token usage, duration, estimated cost).
**Where:** `data/generated/.telemetry.jsonl`
**How:** Written by `lib/ai/telemetry.ts` during pipeline generation scripts.

---

## Cost Controls

| Control                | Implementation                                                                        | Location                    |
| ---------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| Prompt caching         | Ephemeral 1-hr TTL + cron warmup; ~90% cost reduction on follow-up turns              | `route.ts`, `app/api/cron/` |
| Output token cap       | Chat: 2,048 tokens; tailored resume in chat: 1,200 tokens; CLI pipeline: 8,192 tokens | `lib/constants.ts`          |
| Temperature tuning     | Lower temperature for tools/resume (fewer retries)                                    | `route.ts` (streamText)     |
| Rate limiting          | Sliding window per IP via Upstash Redis                                               | `route.ts` (rate limiter)   |
| Input size limits      | Per-message char limit, message count cap, body size cap                              | `route.ts` (constants)      |
| Model tiering          | Sonnet for chat; Opus only for pipeline                                               | `route.ts`, `lib/config.ts` |
| Anthropic spend limits | Configurable monthly cap at console.anthropic.com                                     | Anthropic Console           |
| Vercel spend limits    | Configurable at Vercel Dashboard > Settings > Billing                                 | Vercel Dashboard            |

---

## Cost Model

Exact token counts vary with career data size. Costs are based on [Anthropic pricing](https://docs.anthropic.com/en/docs/about-claude/models) for Sonnet 4.6 ($3/$15 per MTok) and Opus 4.6 ($15/$75 per MTok):

- **Chat conversation (5 turns):** First turn pays cache write cost; subsequent turns benefit from ~90% cache read discount. A typical 5-turn session costs well under $1.
- **Resume generation via tool call:** Sonnet generates a tailored resume from a JD. Output capped at 8,192 tokens.
- **Pipeline resume generation (Opus):** Offline, uses adaptive thinking at max effort. Cost per generation is ~$1-2 depending on thinking token usage.
