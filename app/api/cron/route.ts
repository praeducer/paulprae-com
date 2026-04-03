/**
 * Cache warmup cron endpoint.
 *
 * Called by Vercel's scheduler every 55 minutes to keep the Anthropic prompt
 * cache warm (1-hour TTL). Warms both the chat and resume-generator system
 * prompts so that:
 *   - Chat requests always hit a warm cache (avoids 6–18s cold-prefill penalty)
 *   - Tailored resume tool calls avoid a cold cache during execution (which
 *     causes the SSE stream to go silent for 15–20s, risking client timeouts)
 *
 * Requires CRON_SECRET env var (set in Vercel dashboard). Vercel sends this
 * automatically as `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { CHAT_MODEL_ID } from "../../../lib/constants";
import { SYSTEM_PROMPTS } from "../../../lib/generated/system-prompts";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("AI service not configured", { status: 503 });
  }

  const warmPrompt = (systemKey: keyof typeof SYSTEM_PROMPTS) =>
    generateText({
      model: anthropic(CHAT_MODEL_ID) as LanguageModel,
      // cache_control must be on the system message content block, not top-level
      // providerOptions — see app/api/chat/route.ts for the full explanation.
      system: {
        role: "system",
        content: SYSTEM_PROMPTS[systemKey],
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
        },
      },
      prompt: "hi",
      maxOutputTokens: 1,
    });

  try {
    // Warm both system prompt caches concurrently.
    // chat: the main conversational system prompt (~90K tokens)
    // resume-generator: used during tailored resume tool execution (~70K tokens)
    await Promise.all([warmPrompt("chat"), warmPrompt("resume-generator")]);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[cron] Cache warmup failed:", err);
    return new Response("warmup failed", { status: 500 });
  }
}
