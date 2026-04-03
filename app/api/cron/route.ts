/**
 * Cache warmup cron endpoint.
 *
 * Called by Vercel's scheduler every 55 minutes to keep the Anthropic prompt
 * cache warm (1-hour TTL). A single minimal request refreshes the cache so
 * that real users always hit a warm cache, avoiding the 6–18s cold-prefill
 * penalty on the ~90K-token system prompt.
 *
 * Requires CRON_SECRET env var (set in Vercel dashboard). Vercel sends this
 * automatically as `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { CHAT_MODEL_ID } from "../../../lib/constants";
import { SYSTEM_PROMPTS } from "../../../lib/generated/system-prompts";

export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("AI service not configured", { status: 503 });
  }

  try {
    // Minimal single-token request to write/refresh the Anthropic prompt cache.
    await generateText({
      model: anthropic(CHAT_MODEL_ID) as LanguageModel,
      system: SYSTEM_PROMPTS["chat"],
      prompt: "hi",
      maxOutputTokens: 1,
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral", ttl: "1h" },
        },
      },
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[cron] Cache warmup failed:", err);
    return new Response("warmup failed", { status: 500 });
  }
}
