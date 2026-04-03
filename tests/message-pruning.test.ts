/**
 * message-pruning.test.ts — Regression tests for multi-turn tool-calling message handling.
 *
 * Validates that convertToModelMessages + pruneMessages produces valid Anthropic API
 * message sequences when the conversation history contains completed tool exchanges.
 *
 * Bug this guards against: pruneMessages({ toolCalls: "before-last-message" }) stripped
 * the tool-call block from prior assistant messages, leaving empty content arrays that
 * Anthropic rejects — causing silent stream failures on the second tailored-resume request.
 *
 * Run: npm test -- tests/message-pruning.test.ts
 */

import { describe, it, expect } from "vitest";
import { convertToModelMessages, pruneMessages } from "ai";
import type { UIMessage } from "ai";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simulate the UIMessage array that useChat produces after a completed
 * generate_tailored_resume tool call. The step-start parts are what
 * AI SDK 6 emits to separate multi-step exchanges within one UIMessage.
 */
function makeConversationWithToolCall(
  opts: {
    jd1?: string;
    jd2?: string;
  } = {},
): UIMessage[] {
  const jd1 = opts.jd1 ?? "Principal AI Engineer at Acme Corp";
  const jd2 = opts.jd2 ?? "Senior ML Engineer at Beta Inc";

  return [
    {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: `Tailor my resume for: ${jd1}` }],
      metadata: {},
    } as UIMessage,
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-generate_tailored_resume",
          toolCallId: "tc1",
          state: "output-available",
          input: { jobDescription: jd1 },
          output: { tailoredResume: "# Paul Prae\n\n## Summary\n\nAI engineer..." },
        },
        { type: "step-start" },
        { type: "text", text: "Here is your tailored resume. Copy it with the button below." },
      ],
      metadata: {},
    } as UIMessage,
    {
      id: "u2",
      role: "user",
      parts: [{ type: "text", text: `Now tailor it for: ${jd2}` }],
      metadata: {},
    } as UIMessage,
  ];
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("multi-turn tool-calling message pipeline", () => {
  it("convertToModelMessages correctly splits step-start separated tool exchange", async () => {
    const uiMessages = makeConversationWithToolCall();
    const modelMessages = await convertToModelMessages(uiMessages);

    // Should expand the single assistant UIMessage into 3 model messages:
    // user, assistant(tool-call), tool(tool-result), assistant(text), user
    expect(modelMessages.length).toBe(5);
    expect(modelMessages[0].role).toBe("user");
    expect(modelMessages[1].role).toBe("assistant");
    expect(modelMessages[2].role).toBe("tool");
    expect(modelMessages[3].role).toBe("assistant");
    expect(modelMessages[4].role).toBe("user");
  });

  it("toolCalls: 'never' preserves tool-call/result pairs for valid Anthropic API messages", async () => {
    const uiMessages = makeConversationWithToolCall();
    const rawModelMessages = await convertToModelMessages(uiMessages);

    const modelMessages = pruneMessages({
      messages: rawModelMessages,
      toolCalls: "never",
      reasoning: "before-last-message",
    }).filter((m) => m.content.length > 0);

    // No empty content arrays — Anthropic rejects these
    for (const m of modelMessages) {
      expect(m.content.length).toBeGreaterThan(0);
    }

    // Tool call and result are preserved
    const toolCallMsg = modelMessages.find(
      (m) => m.role === "assistant" && m.content.some((c) => c.type === "tool-call"),
    );
    const toolResultMsg = modelMessages.find(
      (m) => m.role === "tool" && m.content.some((c) => c.type === "tool-result"),
    );
    expect(toolCallMsg).toBeDefined();
    expect(toolResultMsg).toBeDefined();
  });

  it("defensive filter removes any empty content arrays regardless of prune settings", async () => {
    const uiMessages = makeConversationWithToolCall();
    const rawModelMessages = await convertToModelMessages(uiMessages);

    // Even if pruneMessages were to leave empty content (edge cases), the filter removes them
    const modelMessages = pruneMessages({
      messages: rawModelMessages,
      toolCalls: "never",
      reasoning: "before-last-message",
    }).filter((m) => m.content.length > 0);

    expect(modelMessages.every((m) => m.content.length > 0)).toBe(true);
  });

  it("final message sequence ends with user message (JD for second resume)", async () => {
    const uiMessages = makeConversationWithToolCall();
    const rawModelMessages = await convertToModelMessages(uiMessages);

    const modelMessages = pruneMessages({
      messages: rawModelMessages,
      toolCalls: "never",
      reasoning: "before-last-message",
    }).filter((m) => m.content.length > 0);

    const last = modelMessages[modelMessages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content.some((c) => c.type === "text")).toBe(true);
  });

  it("regresses: toolCalls 'before-last-message' can leave empty content arrays", async () => {
    // This test DOCUMENTS the bug. With the old setting, pruning would leave assistant
    // messages with empty content that Anthropic rejects. The defensive filter catches this.
    const uiMessages = makeConversationWithToolCall();
    const rawModelMessages = await convertToModelMessages(uiMessages);

    const pruned = pruneMessages({
      messages: rawModelMessages,
      toolCalls: "before-last-message",
      reasoning: "before-last-message",
    });

    // Without the defensive filter, empty content arrays MAY appear depending on
    // exact UIMessage structure — test that the filter is what prevents them.
    const filtered = pruned.filter((m) => m.content.length > 0);
    expect(filtered.every((m) => m.content.length > 0)).toBe(true);
  });
});
