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

interface IntersectionObserverLike {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;
}

const resizeObservers: ResizeObserverLike[] = [];
const intersectionObservers: IntersectionObserverLike[] = [];

const originalResizeObserver = globalThis.ResizeObserver;
const originalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  resizeObservers.length = 0;
  intersectionObservers.length = 0;

  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor() {
      resizeObservers.push(this);
    }
  }

  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    private callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      intersectionObservers.push(this);
    }

    trigger(entries: Array<{ target: Element; isIntersecting: boolean }>) {
      this.callback(entries as unknown as IntersectionObserverEntry[], this as never);
    }
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });

  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: originalResizeObserver,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: originalIntersectionObserver,
  });
  document.documentElement.style.removeProperty("--header-height");
  document.documentElement.style.removeProperty("--nav-height");
});

describe("SectionNav", () => {
  it("renders nav links and sets sticky CSS variables", () => {
    document.body.innerHTML = `
      <header id="sticky-header"></header>
      <h2 id="summary">Summary</h2>
      <h2 id="experience">Experience</h2>
    `;
    const header = document.getElementById("sticky-header");
    Object.defineProperty(header, "offsetHeight", { configurable: true, value: 72 });

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
    expect(document.documentElement.style.getPropertyValue("--header-height")).toBe("72px");
    expect(resizeObservers.length).toBeGreaterThan(0);
    expect(intersectionObservers.length).toBeGreaterThan(0);
  });

  it("updates aria-current when observed section becomes active", async () => {
    document.body.innerHTML = `
      <header id="sticky-header"></header>
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

    const observer = intersectionObservers[0];
    const experienceHeading = document.getElementById("experience");
    act(() => {
      observer.trigger([{ target: experienceHeading as Element, isIntersecting: true }]);
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
