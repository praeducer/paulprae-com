/**
 * chat-home.test.tsx — Tests for the ChatHome component.
 *
 * Mocks assistant-ui primitives to test rendering without a runtime.
 *
 * Run: npm test -- tests/chat-home.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import type { ReactNode } from "react";

// SiteNav calls usePathname() — provide a mock for the test environment.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

// ResizeObserver is not available in JSDOM — stub it for SiteNav's header height measurement.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// Mock assistant-ui modules before importing the component
vi.mock("@assistant-ui/react", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    AssistantRuntimeProvider: Passthrough,
    ThreadPrimitive: {
      Root: Passthrough,
      Viewport: Passthrough,
      Empty: Passthrough,
      Messages: () => null,
      ViewportFooter: Passthrough,
      ScrollToBottom: Passthrough,
    },
    MessagePrimitive: {
      Root: Passthrough,
      Content: () => null,
    },
    ComposerPrimitive: {
      Root: ({ children }: { children?: ReactNode }) => <form>{children}</form>,
      Input: (props: { placeholder?: string }) => (
        <input placeholder={props.placeholder} aria-label="chat input" />
      ),
      Send: Passthrough,
    },
    ActionBarPrimitive: {
      Root: Passthrough,
      Copy: Passthrough,
      Reload: Passthrough,
    },
    useComposer: (selector?: (state: { text: string }) => unknown) =>
      selector ? selector({ text: "" }) : { text: "" },
    useMessage: (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({ role: "assistant", status: { type: "complete" }, content: [] })
        : { role: "assistant", status: { type: "complete" }, content: [] },
    useAuiState: (
      selector?: (state: { thread: { isRunning: boolean; messages: never[] } }) => unknown,
    ) =>
      selector
        ? selector({ thread: { isRunning: false, messages: [] } })
        : { thread: { isRunning: false, messages: [] } },
  };
});

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    setMessages: vi.fn(),
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    clearError: vi.fn(),
    stop: vi.fn(),
    error: undefined,
    status: "ready",
    id: "test",
  }),
}));

vi.mock("@assistant-ui/react-ai-sdk", () => ({
  useAISDKRuntime: () => ({
    thread: { append: vi.fn(), composer: { setText: vi.fn() } },
  }),
  AssistantChatTransport: class {
    setRuntime() {}
  },
}));

vi.mock("@assistant-ui/react-markdown", () => ({
  MarkdownTextPrimitive: () => null,
}));

import { render } from "@testing-library/react";
import ChatHome from "../app/components/ChatHome";
import { BOOK_INTERVIEW_URL } from "../lib/constants";

describe("ChatHome", () => {
  it("chat mode renders Paul Prae heading and title", () => {
    const { getAllByText } = render(<ChatHome mode="chat" />);
    expect(getAllByText("Paul Prae").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Principal AI Engineer/).length).toBeGreaterThanOrEqual(1);
  });

  it("tools mode renders Job Search Tools heading", () => {
    const { getByRole } = render(<ChatHome mode="tools" />);
    expect(getByRole("heading", { name: "Job Search Tools" })).toBeTruthy();
  });

  it("renders composer placeholder", () => {
    const { container } = render(<ChatHome mode="chat" />);
    const input = container.querySelector('input[placeholder*="experience"]');
    expect(input).toBeTruthy();
  });

  it("renders Resume link", () => {
    const { getByText } = render(<ChatHome mode="chat" />);
    const link = getByText("Resume");
    expect(link).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toBe("/resume");
  });

  it("renders Book Interview links in header and quick actions", () => {
    const { getAllByRole } = render(<ChatHome mode="chat" />);
    const links = getAllByRole("link", { name: /book interview with paul/i });
    expect(links.length).toBe(2);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe(BOOK_INTERVIEW_URL);
      expect(link.getAttribute("target")).toBe("_blank");
    }
  });
});
