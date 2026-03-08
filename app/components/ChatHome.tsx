"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  useComposer,
} from "@assistant-ui/react";
import { useAISDKRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import QuickActions from "./QuickActions";
import { MAX_MESSAGE_CHARS, SITE_NAME, SITE_SUBTITLE, HERO_DESCRIPTION } from "../../lib/constants";

// ─── Markdown Text Wrapper ──────────────────────────────────────────────────

/** Wraps MarkdownTextPrimitive with GFM support (tables, strikethrough, etc.) */
function MarkdownText() {
  return <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} />;
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

const actionButtonClass =
  "rounded-md p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:hover:bg-slate-800 dark:hover:text-slate-300";

// ─── Custom Thread Components ───────────────────────────────────────────────

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end mb-5">
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
    <MessagePrimitive.Root className="flex justify-start group mb-5">
      <div className="max-w-[80%] space-y-2">
        <div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-900 prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-td:border prose-td:border-slate-300 prose-td:px-3 prose-td:py-1.5 dark:bg-slate-800/80 dark:text-slate-100 dark:prose-invert dark:prose-th:border-slate-600 dark:prose-td:border-slate-600 overflow-x-auto">
          <MessagePrimitive.Content
            components={{
              Text: MarkdownText,
            }}
          />
        </div>
        <ActionBarPrimitive.Root className="flex gap-1 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <ActionBarPrimitive.Copy asChild>
            <button
              type="button"
              title="Copy to clipboard"
              className={actionButtonClass}
              aria-label="Copy message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12a1.5 1.5 0 0 1 .439 1.061V11.5A1.5 1.5 0 0 1 15.5 13H14v-2h1.5V7H13a1 1 0 0 1-1-1V3.5H8.5V5H7V3.5Z" />
                <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5V7.5A1.5 1.5 0 0 0 11.5 6h-7Z" />
              </svg>
            </button>
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload asChild>
            <button
              type="button"
              title="Regenerate response"
              className={actionButtonClass}
              aria-label="Regenerate response"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.625-2.85a5.5 5.5 0 0 1 9.201-2.466l.312.312H11.767a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.536a.75.75 0 0 0-1.5 0v2.033l-.312-.312A7 7 0 0 0 2.627 8.396a.75.75 0 0 0 1.449.389l.61.789Z"
                  clipRule="evenodd"
                />
              </svg>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
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

  // Quick action handler — appends a message to the thread
  const handleQuickAction = useCallback(
    (prompt: string) => {
      runtime.thread.append({
        role: "user",
        content: [{ type: "text", text: prompt }],
      });
    },
    [runtime],
  );

  // Pre-fill the composer textarea with text (e.g., for tailored resume chip)
  // Uses native DOM event dispatch to sync with assistant-ui's controlled input.
  const handlePrefill = useCallback((text: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>('[aria-label="Chat message"]');
    if (!textarea) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh flex-col">
        {/* Skip navigation — hidden until keyboard Tab (not programmatic focus from client navigation) */}
        <a
          href="#chat-content"
          className="sr-only z-50 rounded bg-white px-4 py-2 text-sm text-slate-900 ring-2 ring-blue-500 focus-visible:not-sr-only focus-visible:fixed focus-visible:left-2 focus-visible:top-2 focus-visible:outline-none dark:bg-slate-900 dark:text-slate-100"
        >
          Skip to chat content
        </a>

        {/* Header — matches resume page header (Row 1) */}
        <header className="shrink-0 border-b border-slate-200/60 bg-white/95 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/95">
          <div className="mx-auto max-w-3xl px-6 py-3">
            <div className="flex items-baseline gap-3">
              <Link
                href="/"
                className="text-xl font-bold text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
              >
                {SITE_NAME}
              </Link>
              <p className="hidden text-sm text-slate-500 sm:block dark:text-slate-400 truncate">
                {SITE_SUBTITLE}
              </p>
              <nav
                className="ml-auto flex items-center gap-1 sm:gap-2"
                aria-label="Site navigation"
              >
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = mode === "tools" ? "/tools" : "/";
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title="Start a new conversation"
                  aria-label="New conversation"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" />
                  </svg>
                  <span className="hidden sm:inline">New chat</span>
                </button>
                {mode === "tools" && (
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Chat with AI
                  </Link>
                )}
                <Link
                  href="/resume"
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  Resume
                </Link>
                <a
                  href="/Paul-Prae-Resume.pdf"
                  download
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Download resume as PDF"
                  title="Download resume as PDF"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M10 3a.75.75 0 0 1 .75.75v7.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V3.75A.75.75 0 0 1 10 3Z" />
                    <path d="M3.75 14a.75.75 0 0 1 .75.75v1.5h11v-1.5a.75.75 0 0 1 1.5 0v1.5A1.5 1.5 0 0 1 15.5 17.25h-11A1.5 1.5 0 0 1 3 15.75v-1.5a.75.75 0 0 1 .75-.75Z" />
                  </svg>
                  <span className="hidden sm:inline">PDF</span>
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* Chat Thread */}
        <main
          id="chat-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col focus:outline-none"
        >
          <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
            <ThreadPrimitive.Viewport className="flex flex-1 flex-col overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pt-5">
                {/* Welcome / Empty State */}
                <ThreadPrimitive.Empty>
                  <div className="flex flex-1 flex-col items-center justify-start pt-[10vh] sm:pt-[15vh] py-4 sm:py-12">
                    <div className="mb-4 sm:mb-6 text-center">
                      {mode === "chat" ? (
                        <>
                          <h1 className="sr-only">
                            Chat with Paul Prae&apos;s AI Career Assistant
                          </h1>
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
                          <p className="mt-2 max-w-lg text-xs text-slate-400 dark:text-slate-500">
                            Ask about Paul&apos;s experience, download his resume, or request a
                            tailored resume for your open role.
                          </p>
                        </>
                      ) : (
                        <>
                          <h1 className="sr-only">Job Search Tools</h1>
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
                </div>
              </div>

              {/* Scroll anchor + Composer */}
              <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
                <div className="mx-auto w-full max-w-3xl px-6 pb-4">
                  <ThreadPrimitive.ScrollToBottom asChild>
                    <button
                      type="button"
                      className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                      aria-label="Scroll to bottom"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </ThreadPrimitive.ScrollToBottom>
                  <ChatComposer />
                </div>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </main>

        <footer className="shrink-0 py-1.5 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            paulprae.com &mdash; Built with Next.js, Claude AI, and Tailwind CSS &mdash;{" "}
            <a
              href="https://github.com/praeducer/paulprae-com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600 dark:hover:text-slate-300"
            >
              view source
            </a>
          </p>
        </footer>
      </div>
    </AssistantRuntimeProvider>
  );
}
