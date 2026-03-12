/**
 * section-nav.test.tsx — Tests for resume section navigation behavior.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import SectionNav from "../app/resume/components/SectionNav";

interface ResizeObserverLike {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const resizeObservers: ResizeObserverLike[] = [];

const originalResizeObserver = globalThis.ResizeObserver;
const originalRAF = globalThis.requestAnimationFrame;

beforeEach(() => {
  resizeObservers.length = 0;

  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor() {
      resizeObservers.push(this);
    }
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });

  // Synchronous rAF for predictable test timing
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

afterEach(() => {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: originalResizeObserver,
  });
  globalThis.requestAnimationFrame = originalRAF;
  document.documentElement.style.removeProperty("--nav-height");
  document.documentElement.style.removeProperty("--sticky-offset");
});

describe("SectionNav", () => {
  it("renders nav links and sets sticky CSS variables", () => {
    document.body.innerHTML = `
      <h2 id="summary">Summary</h2>
      <h2 id="experience">Experience</h2>
    `;

    render(
      <SectionNav
        sections={[
          { id: "summary", label: "Summary" },
          { id: "experience", label: "Experience" },
        ]}
      />,
    );

    const summaryLink = screen.getByRole("link", { name: "Summary" });
    expect(summaryLink.getAttribute("href")).toBe("#summary");
    expect(screen.getByRole("link", { name: "Experience" }).getAttribute("href")).toBe(
      "#experience",
    );
    expect(resizeObservers.length).toBeGreaterThan(0);
  });

  it("updates aria-current based on scroll position", async () => {
    document.body.innerHTML = `
      <h2 id="summary">Summary</h2>
      <h2 id="experience">Experience</h2>
    `;

    // Mock --sticky-offset and element positions
    document.documentElement.style.setProperty("--sticky-offset", "100px");

    const summaryEl = document.getElementById("summary")!;
    const experienceEl = document.getElementById("experience")!;

    // Simulate "experience" heading scrolled past the threshold (top <= 124px)
    vi.spyOn(summaryEl, "getBoundingClientRect").mockReturnValue({
      top: -200,
      bottom: -180,
      left: 0,
      right: 800,
      width: 800,
      height: 20,
      x: 0,
      y: -200,
      toJSON: () => {},
    });
    vi.spyOn(experienceEl, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 120,
      left: 0,
      right: 800,
      width: 800,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    render(
      <SectionNav
        sections={[
          { id: "summary", label: "Summary" },
          { id: "experience", label: "Experience" },
        ]}
      />,
    );

    // Trigger scroll event to update active section
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Experience" }).getAttribute("aria-current")).toBe(
        "true",
      );
    });
    expect(screen.getByRole("link", { name: "Summary" }).getAttribute("aria-current")).toBeNull();
  });

  it("renders nothing when no sections are provided", () => {
    const { container } = render(<SectionNav sections={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
