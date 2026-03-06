# AI Well-Architected Review & Improvement Plan

**Goal:** Make paulprae.com demonstrate principal/staff-level AI engineering to reviewers at Anthropic, Snowflake, Vercel, Deepgram, EY, McKinsey, and BCG.

**Principles:** Elegance, simplicity, minimalism. Use existing platform capabilities (Vercel AI Gateway, Anthropic Console) instead of custom code. Optimize for cost without sacrificing output quality.

**Branch:** `feat/phase2-implementation`

---

## Executive Assessment

### What Already Impresses

1. **Entity-scope binding (G1)** — Grounding rules preventing metric conflation across companies, with few-shot BAD vs GOOD examples.
2. **SCOPE BOUNDARY markers** — Knowledge base entries with mandatory constraints on work attribution per role. Production-grade hallucination prevention.
3. **Staged generation pipeline** — staging -> compare -> approve -> live with quality regression detection.
4. **Anthropic prompt caching** — Ephemeral caching of ~90K-token system prompts. 90% cost reduction on subsequent turns.
5. **XML-delimited untrusted input** — Anthropic's recommended injection defense pattern.
6. **Adaptive thinking at max effort** — Opus 4.6 for permanent artifacts vs. Sonnet for ephemeral chat. Right model for the right job.
7. **Multi-layer input validation** — Request size, message count, per-message length, tool schemas, rate limiting with Redis + in-memory fallback.

### What a Principal-Level Reviewer Would Flag

---

## Items to Implement

### 1. Few-Shot Examples for Career Chat (Prompt Engineering)

**Current:** Only `resume-writer.system.md` has few-shot examples. The recruiter-facing career-chat prompt relies entirely on instructions.

**Why:** Few-shot examples outperform instructions for controlling format, tone, and grounding behavior (Brown et al. 2020, Anthropic docs). This is the highest-leverage prompt engineering technique.

**Fix:** Create `career-chat.few-shot.md` with 3 examples: grounded answer, graceful redirect, concise format. The loader already supports few-shot append when the file exists (loader.ts line 89: `includeFewShot !== false && fs.existsSync(fewShotPath)`).

**Files:** `lib/prompts/career-chat.few-shot.md` (new)

### 2. Audience Framework Routing (Prompt Engineering)

**Current:** `{{AUDIENCE_FRAMEWORKS}}` is injected into prompts but no instructions tell the model how to detect audience type or when to apply which framework. Context without routing wastes tokens.

**Fix:** Add a 5-line routing block to the career-chat prompt specifying signal detection (hiring manager, recruiter, technical peer, visitor) and default behavior.

**Files:** `lib/prompts/career-chat.system.md`

### 3. Data Source Conflict Resolution (Prompt Engineering)

**Current:** Career data (LinkedIn CSVs) and knowledge base (curated JSONs) can overlap or contradict. No grounding rule specifies source priority.

**Fix:** Add one rule: prefer verified knowledge base entries (with recent `asOf` date) over LinkedIn CSV data, and both over estimated entries.

**Files:** `lib/prompts/career-chat.system.md`, `lib/prompts/resume-generator.system.md`

### 4. Validation Criteria in Resume Writer (Prompt Engineering)

**Current:** `generate-resume.ts` runs ~30 post-generation checks, but Claude doesn't know what will be checked. Can't optimize for unknown criteria.

**Fix:** Add acceptance criteria block to resume-writer prompt listing the 10 checks the validator enforces.

**Files:** `lib/prompts/resume-writer.system.md`

### 5. Tool-Specific Error Recovery (Agentic)

**Current:** If `generate_tailored_resume` fails, the error propagates to a generic handler. User sees "An error occurred" with no context.

**Fix:** Wrap tool execution in try-catch with tool-specific user-friendly messages and structured error returns.

**Files:** `app/api/chat/route.ts`

### 6. Tool-Calling Tests (Testing)

**Current:** The `generate_tailored_resume` and `get_resume_links` tools have zero test coverage. Untested tool execution is the #1 risk flag for reviewers.

**Fix:** Add tests for tool schema validation, XML wrapping of untrusted input, and structured output shape.

**Files:** `tests/tool-calling.test.ts` (new)

### 7. Prompt Injection Red-Team Tests (Testing)

**Current:** Tests verify security rules EXIST in prompts but never test the structural defenses. Testing that a lock exists without trying to pick it.

**Fix:** Add tests verifying XML delimiter wrapping, schema rejection of malicious inputs, and security rule presence across all prompts.

**Files:** `tests/prompt-injection.test.ts` (new)

### 8. AI Architecture Decision Record (Documentation)

**Current:** No dedicated AI-focused document for reviewers. Technical design doc covers architecture broadly but doesn't explain AI-specific trade-offs.

**Fix:** Create `docs/ai-architecture.md` covering:

- Why context injection over vector retrieval (dataset size + prompt caching economics)
- Why Sonnet for chat, Opus for pipeline (cost/quality with numbers)
- Why XML delimiting for injection defense
- Observability stack: Vercel AI Gateway (token usage, cost, cache metrics, latency per generation), Vercel Runtime Logs (function execution), Vercel Analytics + Speed Insights (already integrated), Anthropic Console (billing, rate limits)
- Token budget and cost-per-conversation breakdown
- Phase 3 path to vector retrieval + knowledge graph

**Files:** `docs/ai-architecture.md` (new)

---

## Items Cut (with rationale)

| Item                                       | Why Cut                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Custom LLM telemetry logging (O1)          | **Vercel AI Gateway already tracks**: generation ID, token usage, cost, cache read/write, latency, model, finish reason. Vercel Runtime Logs capture `console.error`. Anthropic Console tracks billing. Custom logging is redundant. |
| Cache hit monitoring (O3)                  | AI Gateway dashboard shows cache metrics per generation. No custom code needed.                                                                                                                                                      |
| Prompt versioning in telemetry (O2)        | Git tracks prompt versions. AI Gateway generation IDs provide runtime tracing.                                                                                                                                                       |
| Keyword relevance filter (C1)              | Over-engineered for ~20KB dataset. Prompt caching makes full injection cost-effective ($0.03/turn after first). Document the decision in ADR instead.                                                                                |
| Context window summarization (C2)          | Extra API call adds cost and latency. Claude's 200K context handles MAX_MESSAGES=50 safely (~50K conversation + ~90K cached prompt = 140K < 200K).                                                                                   |
| Position-knowledge map (C3)                | Claude handles flat arrays fine at this scale. Adds code complexity without proportional benefit.                                                                                                                                    |
| evaluate_resume_fit tool (A1)              | Doubles API cost per resume generation. The chat model already sees the resume + JD in context and naturally assesses fit in its response — for free.                                                                                |
| Structured output Zod on tool results (A2) | Tool outputs are hardcoded literal objects, not model-generated. Zod validation on literals is redundant.                                                                                                                            |
| Tools for tools mode (P5)                  | "Tools" in the UI means "job search tools" — clear to users. Adding literal AI SDK tools (e.g., character counter) is over-engineering a simple text generation mode.                                                                |
| Streaming error tests (T3)                 | Error handling code is solid and tested at the pre-flight layer. Streaming error testing requires mocking AI SDK internals — diminishing returns.                                                                                    |
| Rate limit boundary tests (T4)             | In-memory rate limiter is 12 lines of straightforward code. Tests would be longer than the implementation.                                                                                                                           |
| Model configuration tests (T5)             | Testing that constants equal expected values is low signal.                                                                                                                                                                          |
| Markdown sanitization test (S1)            | react-markdown doesn't render raw HTML by default. Testing the library, not our code.                                                                                                                                                |
| Output validation on tool results (S3)     | Model outputs are streamed directly. Buffered scanning adds latency. System prompt security rules handle this.                                                                                                                       |
| Prompt changelog in YAML (D2)              | Git history already tracks prompt changes with commit messages. Duplicating in frontmatter adds maintenance burden.                                                                                                                  |

---

## Observability Stack (Already in Place)

No custom code needed. Document these existing integrations in the ADR:

| Layer                  | Service               | What It Tracks                                                                    | Where to View                     |
| ---------------------- | --------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| **AI Generation**      | Vercel AI Gateway     | Token usage, cost, cache read/write, latency, model, finish reason per generation | Vercel Dashboard > AI Gateway     |
| **Function Execution** | Vercel Runtime Logs   | `console.log/error` from API routes, request duration, cold starts                | Vercel Dashboard > Logs           |
| **Web Performance**    | Vercel Speed Insights | Core Web Vitals (LCP, CLS, FID, TTFB, INP)                                        | Vercel Dashboard > Speed Insights |
| **Usage Analytics**    | Vercel Analytics      | Page views, unique visitors, top pages, referrers                                 | Vercel Dashboard > Analytics      |
| **API Billing**        | Anthropic Console     | API usage, costs, rate limits, spend caps                                         | console.anthropic.com             |
| **Rate Limiting**      | Upstash Console       | Request counts, Redis usage, rate limit hits                                      | console.upstash.com               |

---

## Implementation Order

| #   | Item                                              | Effort | Files                                                 |
| --- | ------------------------------------------------- | ------ | ----------------------------------------------------- |
| 1   | Few-shot examples for career-chat                 | 20 min | `lib/prompts/career-chat.few-shot.md`                 |
| 2   | Audience routing + conflict resolution in prompts | 10 min | `career-chat.system.md`, `resume-generator.system.md` |
| 3   | Validation criteria in resume-writer              | 10 min | `resume-writer.system.md`                             |
| 4   | Tool error recovery                               | 15 min | `app/api/chat/route.ts`                               |
| 5   | Tool-calling tests                                | 30 min | `tests/tool-calling.test.ts`                          |
| 6   | Prompt injection tests                            | 20 min | `tests/prompt-injection.test.ts`                      |
| 7   | AI Architecture Decision Record                   | 30 min | `docs/ai-architecture.md`                             |
| 8   | Verify: tsc + tests + build                       | 5 min  | —                                                     |

---

## Verification

1. `npx tsc --noEmit` — Clean
2. `npm test` — All tests pass including new ones
3. `npm run build` — Builds without warnings
4. AI architecture doc explains trade-offs clearly
5. Few-shot examples in career-chat produce grounded, concise responses
6. Tool error recovery returns user-friendly messages
