/**
 * quick-actions.test.tsx — Tests for the QuickActions component.
 *
 * Run: npm test -- tests/quick-actions.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import QuickActions from "../app/components/QuickActions";

describe("QuickActions", () => {
  it("renders 5 chat mode chips", () => {
    const onAction = vi.fn();
    const { container } = render(<QuickActions mode="chat" onAction={onAction} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(5);
  });

  it("renders 8 tools mode chips", () => {
    const onAction = vi.fn();
    const { container } = render(<QuickActions mode="tools" onAction={onAction} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(8);
  });

  it("calls onAction with correct prompt on click", () => {
    const onAction = vi.fn();
    const { getByText } = render(<QuickActions mode="chat" onAction={onAction} />);
    fireEvent.click(getByText("Core expertise"));
    expect(onAction).toHaveBeenCalledWith(
      "What are Paul's top 3 technical strengths with specific examples?",
    );
  });

  it("tailored resume chip calls onPrefill instead of onAction", () => {
    const onAction = vi.fn();
    const onPrefill = vi.fn();
    const { getByText } = render(
      <QuickActions mode="chat" onAction={onAction} onPrefill={onPrefill} />,
    );
    fireEvent.click(getByText("Tailored resume"));
    expect(onAction).not.toHaveBeenCalled();
    expect(onPrefill).toHaveBeenCalledWith(expect.stringContaining("tailored"));
  });
});
