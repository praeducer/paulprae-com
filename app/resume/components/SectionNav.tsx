"use client";

import { useEffect, useRef, useState } from "react";

interface Section {
  id: string;
  label: string;
}

/**
 * Compact horizontal section navigation bar.
 * Highlights the currently visible section using IntersectionObserver.
 * Sticks below the sticky header using top: var(--header-height).
 * Hidden on print via the no-print class.
 */
export default function SectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const navRef = useRef<HTMLElement>(null);

  // Track the nav height so CSS custom properties (--nav-height) reflect
  // the true rendered size. This drives scroll-padding-top and
  // scroll-margin-top via --sticky-offset.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const sync = () => {
      document.documentElement.style.setProperty("--nav-height", `${nav.offsetHeight}px`);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Track which section is active using IntersectionObserver.
  // Each section heading is observed; the last one to cross the
  // sticky offset threshold becomes "active". More reliable than
  // scroll-based calculation because it handles dynamic content
  // and avoids measuring getComputedStyle on every scroll frame.
  useEffect(() => {
    if (sections.length === 0) return;

    // Build a map of section positions for fallback ordering
    const sectionOrder = new Map(sections.map((s, i) => [s.id, i]));

    // Track which sections are currently intersecting
    const visibleSections = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visibleSections.add(id);
          } else {
            visibleSections.delete(id);
          }
        }

        // Pick the last (lowest on page) visible section heading
        let bestId = "";
        let bestOrder = -1;
        for (const id of visibleSections) {
          const order = sectionOrder.get(id) ?? -1;
          if (order > bestOrder) {
            bestOrder = order;
            bestId = id;
          }
        }

        // If no headings are in view, find the last one scrolled past
        if (!bestId) {
          for (const section of sections) {
            const el = document.getElementById(section.id);
            if (el && el.getBoundingClientRect().top < window.innerHeight * 0.3) {
              bestId = section.id;
            }
          }
        }

        setActiveId(bestId);
      },
      {
        // Negative top margin accounts for sticky nav.
        // Uses a generous margin so headings are detected before
        // they reach the very top of the viewport.
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      },
    );

    // Observe all section heading elements
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Resume sections"
      style={{ top: "var(--header-height, 0px)" }}
      className="no-print sticky z-30 hidden overflow-x-clip border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sm:block dark:border-slate-700/80 dark:bg-slate-950/95"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-6 py-1.5 text-xs scrollbar-none">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={activeId === s.id ? "true" : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-md px-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none ${
              activeId === s.id
                ? "bg-slate-200 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
      {/* Right-edge fade indicating scrollable overflow */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-950"
        aria-hidden="true"
      />
    </nav>
  );
}
