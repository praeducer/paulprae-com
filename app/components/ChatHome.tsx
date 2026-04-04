"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  useComposer,
  useMessage,
  useAuiState,
} from "@assistant-ui/react";
import { useAISDKRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import SiteNav from "./SiteNav";
import QuickActions from "./QuickActions";
import { CopyIcon, ReloadIcon, SendIcon, ArrowDownIcon } from "./Icons";
import {
  MAX_MESSAGE_CHARS,
  SITE_NAME,
  SITE_SUBTITLE,
  SITE_DOMAIN,
  HERO_DESCRIPTION,
  GITHUB_URL,
  GITHUB_PROFILE_URL,
  CONTACT_EMAIL,
  LINKEDIN_URL,
  FOOTER_LINK_CLASS,
  CONTACT_LINK_CLASS,
} from "../../lib/constants";
import { externalLinkProps } from "../../lib/ui-utils";

// ─── Markdown Text Wrapper ──────────────────────────────────────────────────

/** Wraps MarkdownTextPrimitive with GFM support and external link handling. */
function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            {...externalLinkProps(href)}
            className="text-blue-700 underline hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            {...props}
          >
            {children}
          </a>
        ),
      }}
    />
  );
}

// ─── Thinking Indicator ────────────────────────────────────────────────────
// Breathing dots shown while the assistant is generating a response.
// Two layers ensure coverage across the full message lifecycle:
//   1. MessageThinking — inside AssistantMessage, hides once tokens stream in
//   2. ThreadThinking  — standalone bubble below all messages, covers the gap
//      before assistant-ui creates the AssistantMessage component
// Mirrors the Claude.ai pattern. Accessible via role="status".
// Respects prefers-reduced-motion (see globals.css).

const thinkingDotClass = "thinking-dot h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500";

function ThinkingDots() {
  return (
    <div role="status" aria-label="Generating response">
      <span className="sr-only">Thinking…</span>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className={thinkingDotClass} />
        <span className={thinkingDotClass} />
        <span className={thinkingDotClass} />
      </div>
    </div>
  );
}

/** Inside AssistantMessage — shows until text tokens start streaming. */
function MessageThinking() {
  const show = useMessage((m) => {
    if (m.role !== "assistant") return false;
    return (
      m.status.type === "running" && !m.content.some((p) => p.type === "text" && p.text.length > 0)
    );
  });
  return show ? <ThinkingDots /> : null;
}

/** Thread-level — standalone bubble shown when running but no assistant message exists yet. */
function ThreadThinking() {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  // Check if the last message is already an assistant message (MessageThinking handles that case).
  const lastIsAssistant = useAuiState((s) => {
    const msgs = s.thread.messages;
    return msgs.length > 0 && msgs[msgs.length - 1].role === "assistant";
  });

  if (!isRunning || lastIsAssistant) return null;

  return (
    <div className="chat-message-in flex justify-start mb-5">
      <div className="rounded-2xl bg-slate-100 px-5 py-4 dark:bg-slate-800/80">
        <ThinkingDots />
      </div>
    </div>
  );
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

const actionButtonClass =
  "rounded-md p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-300";

// ─── Custom Thread Components ───────────────────────────────────────────────

function UserMessage() {
  return (
    <MessagePrimitive.Root className="chat-message-in flex justify-end mb-5">
      <div className="max-w-[85%] rounded-2xl bg-blue-700 px-4 py-3 text-sm text-white dark:bg-blue-800">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => <p className="whitespace-pre-wrap">{text}</p>,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="chat-message-in flex justify-start group mb-5">
      <div className="max-w-[80%] space-y-2">
        <div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-900 prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-td:border prose-td:border-slate-300 prose-td:px-3 prose-td:py-1.5 dark:bg-slate-800/80 dark:text-slate-100 dark:prose-invert dark:prose-th:border-slate-600 dark:prose-td:border-slate-600 overflow-x-auto">
          <MessagePrimitive.Content
            components={{
              Text: MarkdownText,
            }}
          />
          <MessageThinking />
        </div>
        <ActionBarPrimitive.Root className="flex gap-1 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <ActionBarPrimitive.Copy asChild>
            <button
              type="button"
              title="Copy to clipboard"
              className={actionButtonClass}
              aria-label="Copy message"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload asChild>
            <button
              type="button"
              title="Regenerate response"
              className={actionButtonClass}
              aria-label="Regenerate response"
            >
              <ReloadIcon className="h-4 w-4" />
            </button>
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

/** Character counter shown inside the composer when approaching the limit. */
function CharacterCounter() {
  const textLength = useComposer((c) => c.text.length);

  // Only show when past 75% of the limit
  if (textLength < MAX_MESSAGE_CHARS * 0.75) return null;

  const remaining = MAX_MESSAGE_CHARS - textLength;
  const color =
    remaining <= 0
      ? "text-red-500 dark:text-red-400"
      : remaining <= 200
        ? "text-amber-500 dark:text-amber-400"
        : "text-slate-400 dark:text-slate-500";

  return (
    <span className={`select-none text-[10px] tabular-nums ${color}`} aria-live="polite">
      {remaining.toLocaleString()}
    </span>
  );
}

function ChatComposer() {
  return (
    <ComposerPrimitive.Root
      className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label="Chat with Paul's AI assistant"
    >
      <div className="flex items-end gap-2">
        <ComposerPrimitive.Input
          placeholder="Ask about Paul's experience, or paste a job description..."
          className="min-h-[40px] max-h-[120px] sm:max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          aria-label="Chat message"
          maxLength={MAX_MESSAGE_CHARS}
          autoFocus
        />
        <ComposerPrimitive.Send asChild>
          <button
            type="submit"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white transition-colors hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            aria-label="Send message"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </ComposerPrimitive.Send>
      </div>
      <div className="flex justify-end px-2">
        <CharacterCounter />
      </div>
    </ComposerPrimitive.Root>
  );
}

// ─── Main Chat Component ────────────────────────────────────────────────────

interface ChatHomeProps {
  mode?: "chat" | "tools";
}

export default function ChatHome({ mode = "chat" }: ChatHomeProps) {
  // Create transport with mode in body — transport is recreated when mode changes
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        body: { mode },
      }),
    [mode],
  );

  // Use useChat directly instead of useChatRuntime to avoid
  // unstable_useRemoteThreadListRuntime which recreates the Chat instance
  // when its internal thread ID changes, causing "Cannot read properties of
  // undefined (reading 'state')" on multi-turn conversations.
  const chat = useChat({ transport });
  const runtime = useAISDKRuntime(chat);

  // Keep transport's runtime reference current (needed for model context in requests)
  transport.setRuntime(runtime);

  // Stream timeout — abort after 60s if still loading with no finish.
  // Guards against stuck-spinner UX when Anthropic is slow or the network stalls.
  // showTimeoutError is derived: auto-hides when a new request starts so the user
  // can retry without manually dismissing. This avoids calling setState synchronously
  // inside the effect body (react-hooks/set-state-in-effect).
  const [streamTimedOut, setStreamTimedOut] = useState(false);
  const isLoadingChat = chat.status === "submitted" || chat.status === "streaming";
  const showTimeoutError = streamTimedOut && !isLoadingChat;
  useEffect(() => {
    if (!isLoadingChat) return;
    const timer = setTimeout(() => {
      chat.stop();
      setStreamTimedOut(true);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [isLoadingChat, chat]);

  const handleQuickAction = useCallback(
    (prompt: string) => {
      runtime.thread.composer.setText(prompt);
      runtime.thread.composer.send();
    },
    [runtime],
  );

  // Pre-fill the composer with text (e.g., for tailored resume chip).
  // Uses the assistant-ui runtime API directly to set the composer text,
  // which reliably syncs internal state without DOM hacking.
  const handlePrefill = useCallback(
    (text: string) => {
      runtime.thread.composer.setText(text);
      const textarea = document.querySelector<HTMLTextAreaElement>('[aria-label="Chat message"]');
      textarea?.focus();
    },
    [runtime],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh flex-col">
        {/* Skip navigation — keyboard-only, hidden on touch devices (see globals.css .skip-nav) */}
        <a href="#chat-content" className="skip-nav">
          Skip to chat content
        </a>

        <SiteNav />

        {/* Chat Thread */}
        <main
          id="chat-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col focus:outline-none"
        >
          {/* Persistent sr-only h1 — always in DOM for screen readers, even after messages appear */}
          <h1 className="sr-only">
            {mode === "chat" ? "Chat with Paul Prae's AI Career Assistant" : "Job Search Tools"}
          </h1>

          <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
            <ThreadPrimitive.Viewport className="flex flex-1 flex-col overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pt-5">
                {/* Welcome / Empty State */}
                <ThreadPrimitive.Empty>
                  <div className="flex flex-1 flex-col items-center justify-start pt-[10vh] sm:pt-[15vh] py-4 sm:py-12">
                    <div className="mb-4 sm:mb-6 text-center">
                      {mode === "chat" ? (
                        <>
                          <p
                            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100"
                            aria-hidden="true"
                          >
                            {SITE_NAME}
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {SITE_SUBTITLE}
                          </p>
                          <p className="mt-2 sm:mt-3 hidden sm:block max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            {HERO_DESCRIPTION}
                          </p>
                          <p className="mt-2 max-w-lg text-xs text-slate-600 dark:text-slate-400">
                            Ask about Paul&apos;s experience, download his resume, or request a
                            tailored resume for your open role.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                            <a
                              href={`mailto:${CONTACT_EMAIL}`}
                              aria-label="Send email to Paul Prae"
                              className={CONTACT_LINK_CLASS}
                            >
                              Email
                            </a>
                            <a
                              href={LINKEDIN_URL}
                              target="_blank"
                              rel="me noopener noreferrer"
                              aria-label="View Paul Prae on LinkedIn"
                              className={CONTACT_LINK_CLASS}
                            >
                              LinkedIn
                            </a>
                            <a
                              href={GITHUB_PROFILE_URL}
                              target="_blank"
                              rel="me noopener noreferrer"
                              aria-label="View Paul Prae on GitHub"
                              className={CONTACT_LINK_CLASS}
                            >
                              GitHub
                            </a>
                          </div>
                        </>
                      ) : (
                        <>
                          <p
                            className="text-2xl font-bold text-slate-900 dark:text-slate-100"
                            aria-hidden="true"
                          >
                            Job Search Tools
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            AI-powered content generation
                          </p>
                          <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            Generate tailored outreach, interview prep, and application content. All
                            grounded in Paul&apos;s real career data and optimized for each
                            platform.
                          </p>
                        </>
                      )}
                    </div>
                    <QuickActions
                      mode={mode}
                      onAction={handleQuickAction}
                      onPrefill={handlePrefill}
                    />
                  </div>
                </ThreadPrimitive.Empty>

                {/* Messages */}
                <div aria-live="polite" aria-atomic="false">
                  <ThreadPrimitive.Messages
                    components={{
                      UserMessage,
                      AssistantMessage,
                    }}
                  />
                  <ThreadThinking />
                </div>
              </div>

              {/* Scroll anchor + Composer */}
              <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
                <div className="mx-auto w-full max-w-3xl px-6 pb-4">
                  {showTimeoutError && (
                    <p className="mb-2 text-center text-xs text-red-500 dark:text-red-400">
                      Response timed out — please try again.{" "}
                      <button
                        type="button"
                        onClick={() => setStreamTimedOut(false)}
                        className="underline hover:no-underline focus-visible:outline-none"
                      >
                        Dismiss
                      </button>
                    </p>
                  )}
                  <ThreadPrimitive.ScrollToBottom asChild>
                    <button
                      type="button"
                      className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                      aria-label="Scroll to bottom"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>
                  </ThreadPrimitive.ScrollToBottom>
                  <ChatComposer />
                </div>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </main>

        <footer className="shrink-0 py-1.5 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {SITE_DOMAIN} &mdash; Built with Next.js, Claude AI, and Tailwind CSS &mdash;{" "}
            <a href={GITHUB_URL} {...externalLinkProps(GITHUB_URL)} className={FOOTER_LINK_CLASS}>
              view source
            </a>
          </p>
        </footer>
      </div>
    </AssistantRuntimeProvider>
  );
}
