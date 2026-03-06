import { anthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import {
  streamText,
  generateText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { buildSystemPrompt } from "../../../lib/agent/context";
import { MAX_MESSAGE_CHARS } from "../../../lib/constants";

// Vercel Fluid Compute: explicit timeout for streaming chat responses.
// Pro plan default is 300s with Fluid Compute, but we set 120s as a
// sensible ceiling for Sonnet chat + tool-calling.
export const maxDuration = 120;

// ─── Model Provider ─────────────────────────────────────────────────────────
// Use Vercel AI Gateway when configured (production/preview on Vercel).
// Falls back to direct @ai-sdk/anthropic when no gateway key is available
// (local dev with only ANTHROPIC_API_KEY).

const useGateway = !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

function getModel(modelId: string): LanguageModel {
  if (useGateway) {
    return gateway(`anthropic/${modelId}`) as LanguageModel;
  }
  return anthropic(modelId) as LanguageModel;
}

// ─── Request Limits ─────────────────────────────────────────────────────────

const MAX_MESSAGES = 50;
const MAX_BODY_BYTES = 100_000; // 100 KB
const MAX_JOB_DESC_CHARS = 10_000; // Tool input: job description
const MAX_EMPHASIS_ITEMS = 10; // Tool input: emphasis areas count
const MAX_EMPHASIS_CHARS = 200; // Tool input: per emphasis area

// ─── Rate Limiting (Upstash + in-memory fallback) ───────────────────────────

let ratelimit: { limit: (key: string) => Promise<{ success: boolean }> } | null = null;

/**
 * In-memory sliding window rate limiter — used when Upstash Redis is
 * unavailable. Protects against runaway costs even without external infra.
 * Entries auto-expire after the window period.
 */
const memoryStore = new Map<string, number[]>();
const MEMORY_WINDOW_MS = 60_000; // 1 minute
const MEMORY_MAX_REQUESTS = 20;

function memoryRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = memoryStore.get(key) ?? [];
  // Evict entries outside the window
  const valid = timestamps.filter((t) => now - t < MEMORY_WINDOW_MS);
  if (valid.length >= MEMORY_MAX_REQUESTS) {
    memoryStore.set(key, valid);
    return false;
  }
  valid.push(now);
  memoryStore.set(key, valid);
  return true;
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, timestamps] of memoryStore) {
      const valid = timestamps.filter((t) => now - t < MEMORY_WINDOW_MS);
      if (valid.length === 0) memoryStore.delete(key);
      else memoryStore.set(key, valid);
    }
  };
  // Use a global flag to avoid duplicate intervals across hot reloads
  const globalRef = globalThis as unknown as { _rateLimitCleanup?: boolean };
  if (!globalRef._rateLimitCleanup) {
    globalRef._rateLimitCleanup = true;
    setInterval(cleanup, 5 * 60_000).unref?.();
  }
}

async function initRateLimit() {
  if (ratelimit !== null) return ratelimit;
  try {
    const hasRedisEnv =
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (hasRedisEnv) {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
        prefix: "paulprae:chat",
      });
    } else {
      // Local dev / missing env vars: use in-memory rate limiter
      ratelimit = { limit: async (key: string) => ({ success: memoryRateLimit(key) }) };
    }
  } catch (err) {
    // Redis init failed: fall back to in-memory rate limiter (not open access)
    console.warn("[rate-limit] Upstash Redis init failed, using in-memory fallback:", err);
    ratelimit = { limit: async (key: string) => ({ success: memoryRateLimit(key) }) };
  }
  return ratelimit;
}

// ─── Cached System Prompts ──────────────────────────────────────────────────

const promptCache = new Map<string, string>();

function getSystemPrompt(mode: "chat" | "tools" | "resume-generator"): string {
  const cached = promptCache.get(mode);
  if (cached) return cached;

  const prompt = buildSystemPrompt(mode);
  if (!prompt) {
    throw new Error(
      `Failed to build system prompt for mode "${mode}". Ensure the pipeline has been run (npm run pipeline).`,
    );
  }

  promptCache.set(mode, prompt);
  return prompt;
}

// ─── Input Validation Helpers ───────────────────────────────────────────────

/** Get character length of a single message's text content. */
function messageTextLength(msg: UIMessage): number {
  let total = 0;
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part.type === "text") total += part.text.length;
    }
  }
  return total;
}

/** Estimate total user input size in characters across all messages. */
function estimateInputChars(messages: UIMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += messageTextLength(msg);
  }
  return total;
}

/** Validate individual message content lengths. Returns error message or null. */
function validateMessages(messages: UIMessage[]): string | null {
  for (let i = 0; i < messages.length; i++) {
    if (messageTextLength(messages[i]) > MAX_MESSAGE_CHARS) {
      return `Message ${i + 1} exceeds maximum length (${MAX_MESSAGE_CHARS} characters)`;
    }
  }
  return null;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Content-Type validation
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return new Response("Content-Type must be application/json", { status: 415 });
  }

  // Rate limiting — IP extraction relies on Vercel's reverse proxy setting
  // x-real-ip / x-forwarded-for headers. These are trustworthy on Vercel
  // because the edge proxy controls the header chain.
  const rl = await initRateLimit();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    request.headers.get("x-real-ip") ??
    forwarded ??
    `anon-${(request.headers.get("user-agent") ?? "").slice(0, 32)}`;
  const { success } = await rl.limit(ip);
  if (!success) {
    return new Response("Too many requests. Please try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  // Check Content-Length before reading body
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return new Response("Request body too large", { status: 413 });
  }

  // Parse request body — AI SDK 6 client sends UIMessage[] with parts[]
  let body: { messages?: unknown; mode?: unknown };
  try {
    const rawText = await request.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return new Response("Request body too large", { status: 413 });
    }
    body = JSON.parse(rawText);
  } catch {
    return new Response("Invalid JSON in request body", { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return new Response("Request body must be a JSON object", { status: 400 });
  }

  const { messages, mode } = body as {
    messages: UIMessage[];
    mode?: "chat" | "tools";
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages array is required", { status: 400 });
  }

  if (messages.length > MAX_MESSAGES) {
    return new Response(`Too many messages (max ${MAX_MESSAGES})`, { status: 400 });
  }

  // Validate per-message content length
  const msgError = validateMessages(messages);
  if (msgError) {
    return new Response(msgError, { status: 400 });
  }

  // Total input budget: prevent token amplification attacks
  // 50 messages × 4000 chars = 200K chars max; reject obviously excessive input
  const totalInputChars = estimateInputChars(messages);
  if (totalInputChars > MAX_MESSAGES * MAX_MESSAGE_CHARS) {
    return new Response("Total message content exceeds maximum allowed size", { status: 413 });
  }

  const validMode = mode === "tools" ? "tools" : "chat";

  // Validate API credentials before attempting to stream.
  // streamText() is lazy — errors surface asynchronously in the stream,
  // causing the UI to show an empty bubble instead of an error message.
  if (!useGateway && !process.env.ANTHROPIC_API_KEY) {
    console.error("[chat] ANTHROPIC_API_KEY is not set");
    return new Response("AI service is not configured. Please try again later.", { status: 503 });
  }

  // Build system prompt with career data context
  let systemPrompt: string;
  try {
    systemPrompt = getSystemPrompt(validMode);
  } catch (err) {
    console.error("[chat] Failed to build system prompt:", err);
    return new Response("Service temporarily unavailable. Please try again later.", {
      status: 503,
    });
  }

  // Convert UIMessages to ModelMessages for the language model
  const modelMessages = await convertToModelMessages(messages);

  // Define tools for chat mode only
  const chatTools =
    validMode === "chat"
      ? {
          generate_tailored_resume: tool({
            description:
              "Generate a tailored version of Paul Prae's resume optimized for a specific job description. Use when a recruiter provides a JD or asks for a customized resume.",
            inputSchema: z.object({
              jobDescription: z
                .string()
                .max(
                  MAX_JOB_DESC_CHARS,
                  `Job description must be under ${MAX_JOB_DESC_CHARS} characters`,
                )
                .describe("The job description or role requirements to tailor the resume for"),
              emphasisAreas: z
                .array(
                  z
                    .string()
                    .max(
                      MAX_EMPHASIS_CHARS,
                      `Each emphasis area must be under ${MAX_EMPHASIS_CHARS} characters`,
                    ),
                )
                .max(MAX_EMPHASIS_ITEMS, `Maximum ${MAX_EMPHASIS_ITEMS} emphasis areas`)
                .optional()
                .describe(
                  "Specific areas to emphasize (e.g., 'AI/ML', 'healthcare', 'leadership')",
                ),
            }),
            execute: async ({ jobDescription, emphasisAreas }) => {
              try {
                const resumeSystemPrompt = getSystemPrompt("resume-generator");

                // Wrap user input in XML delimiters to mitigate prompt injection.
                // The model is instructed to treat content inside these tags as
                // untrusted data, not as instructions.
                const userPrompt = emphasisAreas?.length
                  ? `Generate a tailored resume for the following job description.

<job_description>
${jobDescription}
</job_description>

<emphasis_areas>
${emphasisAreas.join(", ")}
</emphasis_areas>`
                  : `Generate a tailored resume for the following job description.

<job_description>
${jobDescription}
</job_description>`;

                const { text } = await generateText({
                  model: getModel("claude-sonnet-4-6"),
                  system: resumeSystemPrompt,
                  prompt: userPrompt,
                  maxOutputTokens: 4096,
                  temperature: 0.3,
                  providerOptions: {
                    anthropic: {
                      cacheControl: { type: "ephemeral" },
                    },
                  },
                });

                if (!text || text.length < 100) {
                  return {
                    error:
                      "Resume generation produced insufficient output. Please try rephrasing your job description.",
                  };
                }

                return {
                  resume: text,
                  downloadLinks: {
                    pdf: "/Paul-Prae-Resume.pdf",
                    docx: "/Paul-Prae-Resume.docx",
                    md: "/Paul-Prae-Resume.md",
                    web: "/resume",
                  },
                  note: "This is a tailored version. Paul's standard resume is available via the download links above.",
                };
              } catch (err) {
                console.error("[tool:generate_tailored_resume]", err);
                return {
                  error:
                    "Resume generation failed. This may be due to high demand. Please try again in a moment.",
                };
              }
            },
          }),
          get_resume_links: tool({
            description:
              "Get download links for Paul Prae's resume in various formats. Use when someone asks to download or view the resume.",
            inputSchema: z.object({}),
            execute: async () => ({
              pdf: "/Paul-Prae-Resume.pdf",
              docx: "/Paul-Prae-Resume.docx",
              md: "/Paul-Prae-Resume.md",
              web: "/resume",
            }),
          }),
        }
      : undefined;

  // Stream response using AI SDK 6 with Anthropic prompt caching.
  // The system prompt (~90K tokens of career data) is marked for ephemeral
  // caching (5-min TTL). After the first request, subsequent turns reuse
  // the cached prompt at ~90% cost reduction.
  try {
    const result = streamText({
      model: getModel("claude-sonnet-4-6"),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 2048,
      temperature: validMode === "tools" ? 0.5 : 0.7,
      tools: chatTools,
      stopWhen: chatTools ? stepCountIs(2) : stepCountIs(1),
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      },
      onError({ error }) {
        console.error(`[chat] Stream error:`, error);
      },
    });

    return result.toUIMessageStreamResponse({
      onError: () => "An error occurred while generating a response. Please try again.",
    });
  } catch (err) {
    console.error(`[chat] ${useGateway ? "Gateway" : "Anthropic"} API error:`, err);
    const status =
      err instanceof Error && "status" in err ? (err as { status: number }).status : 500;
    const message =
      status === 429
        ? "The AI service is rate limited. Please try again in a moment."
        : status === 529
          ? "The AI service is temporarily overloaded. Please try again in a moment."
          : "An error occurred while generating a response. Please try again.";
    return new Response(message, { status: status >= 400 ? status : 500 });
  }
}
