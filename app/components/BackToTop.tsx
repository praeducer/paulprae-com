"use client";

import { useEffect, useState } from "react";

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
      className={`no-print fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 p-2.5 text-white shadow-lg transition-all hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.573a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-3.961V16.25A.75.75 0 0 1 10 17Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
