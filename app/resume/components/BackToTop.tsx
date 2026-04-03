"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "../../components/Icons";

/**
 * Floating back-to-top button that appears after scrolling down.
 * Hidden on print via the no-print class.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Dispatch a scroll event after the smooth scroll completes so that
    // SectionNav's scroll listener clears the active section highlight.
    const onScrollEnd = () => {
      if (window.scrollY < 1) {
        window.dispatchEvent(new Event("scroll"));
        window.removeEventListener("scroll", onScrollEnd);
      }
    };
    window.addEventListener("scroll", onScrollEnd, { passive: true });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`no-print fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 p-2.5 text-white shadow-lg transition-[opacity,transform,background-color] duration-200 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <ArrowUpIcon className="h-4 w-4" />
    </button>
  );
}
