import { anthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import {
  streamText,
  generateText,
  convertToModelMessages,
  pruneMessages,
  tool,
  stepCountIs,
  type UIMessage,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { buildSystemPrompt } from "../../../lib/agent/context";
import { SYSTEM_PROMPTS } from "../../../lib/generated/system-prompts";
import {
  MAX_MESSAGE_CHARS,
  CHAT_MODEL_ID,
  CHAT_CONFIG,
  CHAT_RESUME_CONFIG,
  CHAT_REQUEST_LIMITS,
  RATE_LIMIT_CONFIG,
  RESUME_DOWNLOAD_PATHS,
} from "../../../lib/constants";

// Next.js requires segment config exports to be static literals.
export const maxDuration = 120;

// ─── Model Provider ─────────────────────────────────────────────────────────

const useGateway = !!process.env.AI_GATEWAY_API_KEY;

function getModel(modelId: string): LanguageModel {
  if (useGateway) {
    console.log(`[chat] Using AI Gateway for model: anthropic/${modelId}`);
    return gateway(`anthropic/${modelId}`) as LanguageModel;
  }
  console.log(`[chat] Using direct Anthropic SDK for model: ${modelId}`);
  return anthropic(modelId) as LanguageModel;
}

// ─── Request Limits (re-export for tests) ───────────────────────────────────

export { CHAT_REQUEST_LIMITS } from "../../../lib/constants";

const { maxMessages: MAX_MESSAGES, maxBodyBytes: MAX_BODY_BYTES } = CHAT_REQUEST_LIMITS;

export const generateTailoredResumeInputSchema = z.object({
  jobDescription: z
    .string()
    .max(
      CHAT_REQUEST_LIMITS.maxJobDescriptionChars,
      `Job description must be under ${CHAT_REQUEST_LIMITS.maxJobDescriptionChars} characters`,
    )
    .describe("The job description or role requirements to tailor the resume for"),
  emphasisAreas: z
    .array(
      z
        .string()
        .max(
          CHAT_REQUEST_LIMITS.maxEmphasisChars,
          `Each emphasis area must be under ${CHAT_REQUEST_LIMITS.maxEmphasisChars} characters`,
        ),
    )
    .max(
      CHAT_REQUEST_LIMITS.maxEmphasisItems,
      `Maximum ${CHAT_REQUEST_LIMITS.maxEmphasisItems} emphasis areas`,
    )
    .optional()
    .describe("Specific areas to emphasize (e.g., 'AI/ML', 'healthcare', 'leadership')"),
});

export const getResumeLinksInputSchema = z.object({});

/**
 * Wrap untrusted job input in XML tags so prompts treat it as data.
 * Pass chatFormat=true to constrain output for the chat bubble (~500 words).
 */
export function buildTailoredResumePrompt(
  jobDescription: string,
  emphasisAreas?: string[],
  chatFormat?: boolean,
): string {
  const formatConstraint = chatFormat
    ? `\n\nFormat for chat display — maximum 500 words:\n- Summary: 3–4 sentences\n- Experience: 3 most relevant positions, 2–3 bullets each (action verb + metric)\n- Skills: single compact line\nOmit publications, certifications, education, and older roles unless critical for this role.`
    : "";

  return emphasisAreas?.length
    ? `Generate a tailored resume for the following job description.${formatConstraint}

<job_description>
${jobDescription}
</job_description>

<emphasis_areas>
${emphasisAreas.join(", ")}
</emphasis_areas>`
    : `Generate a tailored resume for the following job description.${formatConstraint}

<job_description>
${jobDescription}
</job_description>`;
}

// ─── Rate Limiting (Upstash + in-memory fallback) ───────────────────────────

let ratelimit: { limit: (key: string) => Promise<{ success: boolean }> } | null = null;

const memoryStore = new Map<string, number[]>();

function memoryRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = memoryStore.get(key) ?? [];
  const valid = timestamps.filter((t) => now - t < RATE_LIMIT_CONFIG.windowMs);
  if (valid.length >= RATE_LIMIT_CONFIG.maxRequests) {
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
      const valid = timestamps.filter((t) => now - t < RATE_LIMIT_CONFIG.windowMs);
      if (valid.length === 0) memoryStore.delete(key);
      else memoryStore.set(key, valid);
    }
  };
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
        limiter: Ratelimit.slidingWindow(
          RATE_LIMIT_CONFIG.maxRequests,
          `${RATE_LIMIT_CONFIG.windowMs / 1000} s`,
        ),
        analytics: true,
        prefix: RATE_LIMIT_CONFIG.prefix,
      });
    } else {
      ratelimit = { limit: async (key: string) => ({ success: memoryRateLimit(key) }) };
    }
  } catch (err) {
    console.warn("[rate-limit] Upstash Redis init failed, using in-memory fallback:", err);
    ratelimit = { limit: async (key: string) => ({ success: memoryRateLimit(key) }) };
  }
  return ratelimit;
}

// ─── Cached System Prompts ──────────────────────────────────────────────────

// In-memory fallback cache for dev mode (when generated file may be stale).
const promptCache = new Map<string, string>();

function getSystemPrompt(mode: "chat" | "tools" | "resume-generator"): string {
  // Primary: use pre-built prompt (zero I/O, byte-identical across instances).
  // Pre-built strings are committed alongside career-data.json and regenerated
  // by `npm run build:prompts` (called automatically by the pipeline).
  const prebuilt = SYSTEM_PROMPTS[mode];
  if (prebuilt) return prebuilt;

  // Fallback: runtime build (dev mode or missing generated file).
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

function messageTextLength(msg: UIMessage): number {
  let total = 0;
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part.type === "text") total += part.text.length;
    }
  }
  return total;
}

function estimateInputChars(messages: UIMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += messageTextLength(msg);
  }
  return total;
}

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
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return new Response("Content-Type must be application/json", { status: 415 });
  }

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
      headers: { "Retry-After": String(Math.ceil(RATE_LIMIT_CONFIG.windowMs / 1000)) },
    });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return new Response("Request body too large", { status: 413 });
  }

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

  const msgError = validateMessages(messages);
  if (msgError) {
    return new Response(msgError, { status: 400 });
  }

  const totalInputChars = estimateInputChars(messages);
  if (totalInputChars > MAX_MESSAGES * MAX_MESSAGE_CHARS) {
    return new Response("Total message content exceeds maximum allowed size", { status: 413 });
  }

  const validMode = mode === "tools" ? "tools" : "chat";

  if (!useGateway && !process.env.ANTHROPIC_API_KEY) {
    console.error("[chat] ANTHROPIC_API_KEY is not set");
    return new Response("AI service is not configured. Please try again later.", { status: 503 });
  }

  let systemPrompt: string;
  try {
    systemPrompt = getSystemPrompt(validMode);
  } catch (err) {
    console.error("[chat] Failed to build system prompt:", err);
    return new Response("Service temporarily unavailable. Please try again later.", {
      status: 503,
    });
  }

  const rawModelMessages = await convertToModelMessages(messages);
  const modelMessages = pruneMessages({
    messages: rawModelMessages,
    toolCalls: "before-last-message",
    reasoning: "before-last-message",
  });

  const chatTools =
    validMode === "chat"
      ? {
          generate_tailored_resume: tool({
            description:
              "Generate a tailored version of Paul Prae's resume optimized for a specific job description. Use when a recruiter provides a JD or asks for a customized resume.",
            inputSchema: generateTailoredResumeInputSchema,
            execute: async ({ jobDescription, emphasisAreas }) => {
              try {
                const resumeSystemPrompt = getSystemPrompt("resume-generator");
                const userPrompt = buildTailoredResumePrompt(jobDescription, emphasisAreas, true);

                const { text, finishReason } = await generateText({
                  model: getModel(CHAT_MODEL_ID),
                  system: resumeSystemPrompt,
                  prompt: userPrompt,
                  maxOutputTokens: CHAT_RESUME_CONFIG.maxOutputTokens,
                  temperature: CHAT_RESUME_CONFIG.temperature,
                  providerOptions: {
                    anthropic: {
                      cacheControl: { type: "ephemeral", ttl: "1h" },
                    },
                  },
                });

                if (!text || text.length < 100) {
                  return {
                    error:
                      "Resume generation produced insufficient output. Please try rephrasing your job description.",
                  };
                }

                if (finishReason === "length") {
                  return {
                    error:
                      "The tailored resume was too long to display in chat. Please try a shorter job description, or download the full resume via the PDF link in the navigation bar.",
                  };
                }

                return {
                  tailoredResume: text,
                  standardResumeLinks: RESUME_DOWNLOAD_PATHS,
                  instructions:
                    "Present the tailored resume below, formatted as markdown. Tell the user: copy it with the copy button on this message; download the full standard resume via the PDF link in the navigation bar.",
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
            inputSchema: getResumeLinksInputSchema,
            execute: async () => RESUME_DOWNLOAD_PATHS,
          }),
        }
      : undefined;

  try {
    // Prompt caching: top-level providerOptions.anthropic.cacheControl marks the
    // system prompt for Anthropic's ephemeral cache with a 1-hour TTL.
    // The system prompt (~90K tokens with career data) is stable between requests.
    // 1-hour TTL means virtually all users hit the cache on a personal career site
    // with sporadic traffic (vs. the default 5-min TTL that expired between visits).
    // The @ai-sdk/anthropic provider applies cache_control to the last system
    // content block automatically — no multi-part system message needed.
    const result = streamText({
      model: getModel(CHAT_MODEL_ID),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: CHAT_CONFIG.maxOutputTokens,
      temperature:
        validMode === "tools" ? CHAT_CONFIG.toolsTemperature : CHAT_CONFIG.chatTemperature,
      tools: chatTools,
      stopWhen: chatTools ? stepCountIs(2) : stepCountIs(1),
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral", ttl: "1h" },
        },
      },
      onError({ error }) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[chat] Stream error (${useGateway ? "gateway" : "direct"}):`,
          errObj.message,
          errObj.cause ?? "",
          errObj.stack ?? "",
        );
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
