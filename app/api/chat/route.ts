import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  generateText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { buildSystemPrompt } from "../../../lib/agent/context";

// Vercel Fluid Compute: explicit timeout for streaming chat responses.
// Pro plan default is 300s with Fluid Compute, but we set 60s as a
// sensible ceiling for Sonnet chat. The /api/resume route (Sprint 2)
// will use maxDuration = 300 for Opus generation.
export const maxDuration = 120;

// ─── Rate Limiting (Upstash — optional, graceful fallback) ──────────────────

let ratelimit: { limit: (key: string) => Promise<{ success: boolean }> } | null = null;

async function initRateLimit() {
  if (ratelimit !== null) return ratelimit;
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
        prefix: "paulprae:chat",
      });
    } else {
      // Local dev: no rate limiting when Upstash env vars are absent
      ratelimit = { limit: async () => ({ success: true }) };
    }
  } catch (err) {
    // Production fallback: if Redis connection fails, allow requests through
    // rather than killing the entire API. Anthropic's own rate limits and
    // spending caps provide a secondary safety net.
    console.warn("[rate-limit] Upstash Redis init failed, falling back to no rate limiting:", err);
    ratelimit = { limit: async () => ({ success: true }) };
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

// ─── Route Handler ──────────────────────────────────────────────────────────

// ─── Request Limits ─────────────────────────────────────────────────────────

const MAX_MESSAGES = 50;
const MAX_BODY_BYTES = 100_000; // 100 KB

export async function POST(request: Request) {
  // Rate limiting
  const rl = await initRateLimit();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
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

  const validMode = mode === "tools" ? "tools" : "chat";

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
                .describe("The job description or role requirements to tailor the resume for"),
              emphasisAreas: z
                .array(z.string())
                .optional()
                .describe(
                  "Specific areas to emphasize (e.g., 'AI/ML', 'healthcare', 'leadership')",
                ),
            }),
            execute: async ({ jobDescription, emphasisAreas }) => {
              const resumeSystemPrompt = getSystemPrompt("resume-generator");
              const userPrompt = emphasisAreas?.length
                ? `Generate a tailored resume for this job description:\n\n${jobDescription}\n\nEmphasize these areas: ${emphasisAreas.join(", ")}`
                : `Generate a tailored resume for this job description:\n\n${jobDescription}`;

              const { text } = await generateText({
                model: anthropic("claude-sonnet-4-6"),
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
      model: anthropic("claude-sonnet-4-6"),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 4096,
      temperature: 0.7,
      tools: chatTools,
      stopWhen: chatTools ? stepCountIs(3) : stepCountIs(1),
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[chat] Anthropic API error:", err);
    const status =
      err instanceof Error && "status" in err ? (err as { status: number }).status : 500;
    const message =
      status === 529
        ? "The AI service is temporarily overloaded. Please try again in a moment."
        : "An error occurred while generating a response. Please try again.";
    return new Response(message, { status: status >= 400 ? status : 500 });
  }
}
