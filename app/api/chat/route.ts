import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { buildSystemPrompt } from "../../../lib/agent/context";

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
      ratelimit = { limit: async () => ({ success: true }) };
    }
  } catch {
    ratelimit = { limit: async () => ({ success: true }) };
  }
  return ratelimit;
}

// ─── Cached System Prompts ──────────────────────────────────────────────────

const promptCache = new Map<string, string>();

function getSystemPrompt(mode: "chat" | "tools"): string {
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

  // Parse request body — AI SDK 6 client sends UIMessage[] with parts[]
  const body = (await request.json()) as {
    messages: UIMessage[];
    mode?: "chat" | "tools";
  };

  const { messages, mode } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages array is required", { status: 400 });
  }

  const validMode = mode === "tools" ? "tools" : "chat";

  // Build system prompt with career data context
  const systemPrompt = getSystemPrompt(validMode);

  // Convert UIMessages to ModelMessages for the language model
  const modelMessages = await convertToModelMessages(messages);

  // Stream response using AI SDK 6
  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 4096,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
