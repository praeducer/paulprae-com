/**
 * BookInterviewLink.test.tsx — Tests for the BookInterviewLink component.
 *
 * Run: npm test -- tests/BookInterviewLink.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BookInterviewLink from "../app/components/BookInterviewLink";
import { BOOK_INTERVIEW_URL } from "../lib/constants";

describe("BookInterviewLink", () => {
  it("links to the correct booking URL", () => {
    const { container } = render(<BookInterviewLink />);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(BOOK_INTERVIEW_URL);
  });

  it("opens in a new tab with security attributes", () => {
    const { container } = render(<BookInterviewLink />);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("has an accessible aria-label", () => {
    const { container } = render(<BookInterviewLink />);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("aria-label")).toBe("Book interview with Paul (opens in new tab)");
  });

  it("applies custom className", () => {
    const { container } = render(<BookInterviewLink className="custom-class" />);
    const link = container.querySelector("a")!;
    expect(link.className).toBe("custom-class");
  });

  it('renders "Book Interview" as default children', () => {
    const { getByText } = render(<BookInterviewLink />);
    expect(getByText("Book Interview")).toBeDefined();
  });

  it("renders custom children instead of default text", () => {
    const { getByText, queryByText } = render(
      <BookInterviewLink>Schedule a call</BookInterviewLink>,
    );
    expect(getByText("Schedule a call")).toBeDefined();
    expect(queryByText("Book Interview")).toBeNull();
  });

  it("renders a CalendarIcon SVG", () => {
    const { container } = render(<BookInterviewLink />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("passes title prop to the anchor", () => {
    const { container } = render(<BookInterviewLink title="Book now" />);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("title")).toBe("Book now");
  });
});
