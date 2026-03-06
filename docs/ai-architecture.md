# AI Architecture Decision Record

This document explains the key architectural decisions for the AI system powering paulprae.com. It's written for senior AI engineers, architects, and engineering managers evaluating the system design.

---

## System Overview

paulprae.com is a chat-first career platform with an AI assistant that answers recruiter questions, generates tailored resumes via tool-calling, and produces job search content — all grounded in structured career data.

**Runtime stack:** Next.js 16 + Vercel AI SDK 6 + Claude Sonnet 4.6 (chat) + Claude Opus 4.6 (pipeline)
**Infrastructure:** Vercel (hosting + AI Gateway), Upstash Redis (rate limiting), Anthropic API

---

## Decision 1: Context Injection vs. Vector Retrieval

**Decision:** Inject the full career dataset into the system prompt rather than using embedding-based retrieval (RAG with a vector database).

**Rationale:**

- The career dataset is small: ~2KB career-data.json + ~20KB knowledge base = ~8K tokens after `stripEmpty()` optimization.
- Anthropic prompt caching makes full injection cost-effective: first request caches the ~90K-token system prompt for 5 minutes at 1.25x write cost; subsequent turns reuse it at 0.1x (90% reduction). A typical 5-turn conversation costs ~$0.15 vs. ~$1.70 without caching.
- Vector retrieval adds infrastructure (embedding model, vector DB, index maintenance) without proportional benefit at this scale. The retrieval step itself would cost more in latency (~200ms) than the tokens saved.
- The full context gives Claude complete visibility into all career data, preventing missed connections that selective retrieval might cause.

**Phase 3 path:** When the knowledge base grows beyond ~50K tokens (e.g., Neo4j knowledge graph with hundreds of project entries), the system will migrate to embedding-based retrieval. The prompt template's `{{CAREER_DATA}}` placeholder is already abstracted — switching from full injection to filtered results requires changing only the context builder.

## Decision 2: Model Selection (Sonnet for Chat, Opus for Pipeline)

**Decision:** Use Claude Sonnet 4.6 for runtime chat/tool-calling and Claude Opus 4.6 for offline resume generation.

**Rationale:**

- **Chat (Sonnet):** Recruiter Q&A needs fast responses (~2-5s TTFT). Sonnet at $3/$15 per MTok provides sufficient quality for conversational grounding while keeping per-conversation costs under $0.20.
- **Pipeline (Opus):** Resume generation is a permanent artifact viewed by hiring managers. Opus with adaptive thinking at max effort ($15/$75 per MTok) provides deeper reasoning for entity-scope binding, cross-reference validation, and quality rule adherence. Cost per generation (~$1-2) is acceptable for an artifact generated weekly.
- **Resume tailoring tool (Sonnet):** Runtime resume tailoring via tool-calling uses Sonnet (not Opus) to keep latency under 15s. The recruiter-provided JD provides strong constraints that compensate for the lighter model.

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

## Decision 4: Ephemeral Prompt Caching

**Decision:** Use Anthropic's ephemeral caching (5-minute TTL) rather than no caching or persistent caching.

**Rationale:**

- System prompts contain ~90K tokens of career data that is stable within a conversation session.
- Ephemeral (5-min TTL) matches the expected recruiter interaction pattern: browse site, ask 3-7 questions over 2-5 minutes, leave.
- First request: ~$0.11 (cache write at 1.25x). Subsequent turns: ~$0.01 each (cache read at 0.1x). A 5-turn conversation saves ~$0.40 vs. no caching.
- No persistent cache needed — career data changes only when the pipeline runs (weekly at most), and the 5-min window covers a single session.

## Decision 5: Single Agent with Tools (Not Multi-Agent)

**Decision:** Use a single Claude agent with 2 tools (resume generation, resume links) rather than multi-agent orchestration.

**Rationale:**

- The use case has a narrow scope: answer career questions, generate tailored resumes, provide download links. This doesn't require agent delegation, planning loops, or inter-agent communication.
- Tool-calling via Vercel AI SDK 6 (`streamText` + `tool()`) is clean and well-typed. No framework abstraction (LangChain, CrewAI) needed.
- The `generate_tailored_resume` tool demonstrates the agentic pattern: the chat model decides to call it based on user intent, passes structured inputs, and processes the result — a complete tool-use loop.
- `stepCountIs(2)` caps at 2 reasoning steps (tool call + response), preventing runaway loops while allowing the full tool-use cycle.

## Decision 6: Grounding via Entity-Scope Binding

**Decision:** Enforce grounding through explicit rules (G1-G11) that require every fact to be attributed to exactly one company and one role, with few-shot examples showing correct vs. incorrect attribution.

**Rationale:**

- The most common and damaging error in AI-generated resumes is metric conflation: merging achievements from one company with scale metrics from another. Entity-scope binding (Rule G1) prevents this by requiring single-entity attribution.
- SCOPE BOUNDARY markers in the knowledge base provide hard constraints on what work was/was not performed in specific roles.
- Few-shot examples (in `resume-writer.few-shot.md` and `career-chat.few-shot.md`) demonstrate the expected grounding behavior more effectively than rules alone.
- Post-generation validation in the pipeline (automated checks in `validateResumeOutput()`) catches any remaining violations.

---

## Observability Stack

No custom telemetry code is needed. The existing platform integrations provide comprehensive observability:

### Vercel AI Gateway

**What:** Automatic tracking of every AI generation routed through the gateway.
**Metrics:** Token usage (input, output, cache read, cache creation), cost per generation, latency, model, finish reason, generation ID.
**Where:** Vercel Dashboard > Project > AI Gateway tab.
**How:** Production requests route through `@ai-sdk/gateway` (configured in `route.ts`). The gateway intercepts all Anthropic API calls and records metadata with zero application code.

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
**How:** All API calls (both gateway-routed and direct) are tracked by Anthropic's platform. Set spend limits under Settings > Limits to prevent cost overruns.

### Upstash Console

**What:** Redis request counts, rate limit hits, memory usage.
**Where:** [console.upstash.com](https://console.upstash.com) > Database > Analytics tab.
**How:** Rate limiter uses `@upstash/ratelimit` with `analytics: true` for per-key tracking.

---

## Cost Controls

| Control                | Implementation                                              | Location                    |
| ---------------------- | ----------------------------------------------------------- | --------------------------- |
| Prompt caching         | Ephemeral 5-min TTL; ~90% cost reduction on follow-up turns | `route.ts` (streamText)     |
| Output token cap       | Separate limits for chat vs. resume generation              | `route.ts` (streamText)     |
| Temperature tuning     | Lower temperature for tools/resume (fewer retries)          | `route.ts` (streamText)     |
| Rate limiting          | Sliding window per IP via Upstash Redis                     | `route.ts` (rate limiter)   |
| Input size limits      | Per-message char limit, message count cap, body size cap    | `route.ts` (constants)      |
| Model tiering          | Sonnet for chat; Opus only for pipeline                     | `route.ts`, `lib/config.ts` |
| Anthropic spend limits | Configurable monthly cap at console.anthropic.com           | Anthropic Console           |
| Vercel spend limits    | Configurable at Vercel Dashboard > Settings > Billing       | Vercel Dashboard            |

---

## Token Budget Breakdown

**Typical chat conversation (5 turns):**

| Component                                       | Tokens     | Cost       |
| ----------------------------------------------- | ---------- | ---------- |
| System prompt (first turn, cache write)         | ~8,000     | $0.03      |
| System prompt (turns 2-5, cache read)           | ~8,000 x 4 | $0.003 x 4 |
| User messages (5 turns, ~100 tokens each)       | 500        | $0.002     |
| Assistant responses (5 turns, ~300 tokens each) | 1,500      | $0.023     |
| **Total**                                       |            | **~$0.07** |

**Resume generation via tool call (additional):**

| Component                                    | Tokens | Cost       |
| -------------------------------------------- | ------ | ---------- |
| Resume-generator system prompt (cache write) | ~8,000 | $0.03      |
| Job description input                        | ~500   | $0.002     |
| Resume output (~2 pages)                     | ~2,000 | $0.03      |
| **Total**                                    |        | **~$0.06** |

**Pipeline resume generation (Opus, offline):**

| Component                              | Tokens  | Cost       |
| -------------------------------------- | ------- | ---------- |
| System prompt + few-shot + career data | ~12,000 | $0.18      |
| Thinking tokens (adaptive, max effort) | ~30,000 | $0.45      |
| Resume output                          | ~2,000  | $0.15      |
| **Total**                              |         | **~$0.78** |
