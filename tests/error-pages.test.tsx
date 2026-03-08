/**
 * error-pages.test.tsx — Tests for global error and not-found routes.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import GlobalError from "../app/error";
import NotFound from "../app/not-found";

describe("GlobalError", () => {
  it("renders error message and calls reset callback", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("shows digest identifier when provided", () => {
    const reset = vi.fn();
    const errorWithDigest = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<GlobalError error={errorWithDigest} reset={reset} />);

    expect(screen.getByText("Error ID: abc123")).toBeTruthy();
  });
});

describe("NotFound", () => {
  it("renders primary recovery links", () => {
    render(<NotFound />);

    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chat with AI" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "View Resume" }).getAttribute("href")).toBe("/resume");
  });
});
