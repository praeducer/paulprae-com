/**
 * SiteNav.test.tsx — Tests for the SiteNav component.
 *
 * Run: npm test -- tests/SiteNav.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Minimal ResizeObserver stub
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

import SiteNav from "../app/components/SiteNav";
import { SITE_NAME, SITE_SUBTITLE } from "../lib/constants";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SiteNav", () => {
  beforeEach(() => {
    mockPathname = "/";
    document.documentElement.style.removeProperty("--header-height");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty("--header-height");
  });

  it("renders site name and subtitle", () => {
    const { getByText } = render(<SiteNav />);
    expect(getByText(SITE_NAME)).toBeDefined();
    expect(getByText(SITE_SUBTITLE)).toBeDefined();
  });

  it("renders Resume and PDF nav links", () => {
    const { getByText, getByLabelText } = render(<SiteNav />);
    expect(getByText("Resume")).toBeDefined();
    expect(getByLabelText("Download resume as PDF")).toBeDefined();
  });

  it('shows "New chat" button on the chat page (/)', () => {
    mockPathname = "/";
    const { getByLabelText } = render(<SiteNav />);
    const btn = getByLabelText("New conversation");
    expect(btn.tagName).toBe("BUTTON");
  });

  it('"New chat" button triggers hard reload to /', () => {
    mockPathname = "/";
    const { getByLabelText } = render(<SiteNav />);
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { href: "/" },
      writable: true,
      configurable: true,
    });
    const btn = getByLabelText("New conversation");
    fireEvent.click(btn);
    expect(window.location.href).toBe("/");
  });

  it('shows "Chat with AI" link on non-chat pages', () => {
    mockPathname = "/resume";
    const { getByLabelText } = render(<SiteNav />);
    const link = getByLabelText("Chat with Paul's AI assistant");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/");
  });

  it("sets --header-height to 0px when sticky=false", () => {
    render(<SiteNav sticky={false} />);
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("0px");
  });

  it("renders children in the header", () => {
    const { getByText } = render(
      <SiteNav>
        <div>Test child content</div>
      </SiteNav>,
    );
    expect(getByText("Test child content")).toBeDefined();
  });
});
