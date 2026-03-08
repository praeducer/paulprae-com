/**
 * back-to-top.test.tsx — Tests for floating back-to-top behavior.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import BackToTop from "../app/resume/components/BackToTop";

const originalScrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
const originalScrollTo = window.scrollTo;

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value,
  });
}

beforeEach(() => {
  setScrollY(0);
  window.scrollTo = vi.fn();
});

afterEach(() => {
  if (originalScrollYDescriptor) {
    Object.defineProperty(window, "scrollY", originalScrollYDescriptor);
  }
  window.scrollTo = originalScrollTo;
});

describe("BackToTop", () => {
  it("is initially hidden before scroll threshold", () => {
    render(<BackToTop />);
    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button.className).toContain("opacity-0");
  });

  it("becomes visible after scrolling down", () => {
    render(<BackToTop />);
    setScrollY(500);
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button.className).toContain("opacity-100");
    expect(button.className).toContain("translate-y-0");
  });

  it("scrolls to top smoothly when clicked", () => {
    render(<BackToTop />);
    const button = screen.getByRole("button", { name: "Back to top" });
    fireEvent.click(button);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
