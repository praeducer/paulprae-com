"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Section {
  id: string;
  label: string;
}

/**
 * Compact horizontal section navigation bar.
 * Highlights the currently visible section using a scroll-based algorithm.
 * Sticks below the sticky header using top: var(--header-height).
 * Hidden on print via the no-print class.
 *
 * Active section detection: on each scroll frame, reads --sticky-offset
 * from computed style and picks the LAST heading whose top has scrolled
 * past that threshold. This matches the standard scroll-spy pattern
 * (Bootstrap, Tailwind docs, MDN) and avoids the rootMargin sync
 * issues of IntersectionObserver with dynamic sticky offsets.
 */
export default function SectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const navRef = useRef<HTMLElement>(null);
  // Temporarily override scroll-spy after a nav click so the clicked
  // section stays highlighted while the browser settles the scroll.
  const clickOverrideRef = useRef<string | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Publish --nav-height so scroll-padding-top accounts for this
  // sticky bar via --sticky-offset.
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

  // Scroll-based active section detection.
  // Reads --sticky-offset from CSS (set by SiteNav + this component) and
  // picks the last heading whose top edge has crossed that threshold.
  const updateActiveSection = useCallback(() => {
    if (sections.length === 0) return;

    const offset =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sticky-offset")) ||
      0;
    // Threshold: heading is "active" once its top is at or above the
    // sticky area plus a small buffer (24px breathing room).
    const threshold = offset + 24;

    // Click override takes precedence — prevents desync between click
    // highlight and scroll-spy during smooth-scroll animation.
    if (clickOverrideRef.current) {
      setActiveId(clickOverrideRef.current);
      return;
    }

    // When scrolled to the very bottom, force-activate the last section.
    // Without this, short final sections (Projects, Publications) can never
    // become active because the page bottoms out before they cross the threshold.
    const scrollHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const atBottom = window.innerHeight + window.scrollY >= scrollHeight - 2;
    if (atBottom) {
      setActiveId(sections[sections.length - 1].id);
      return;
    }

    // Default to first section when scrolled above all headings.
    let bestId = sections[0].id;
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el && el.getBoundingClientRect().top <= threshold) {
        bestId = section.id;
      }
    }

    setActiveId(bestId);
  }, [sections]);

  useEffect(() => {
    if (sections.length === 0) return;

    // Throttle scroll handler to ~60fps via rAF.
    // Initial detection also runs through rAF to avoid synchronous
    // setState inside the effect body (react-hooks/set-state-in-effect).
    let ticking = false;
    const scheduleUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          updateActiveSection();
          ticking = false;
        });
      }
    };

    // Initial detection (deferred)
    scheduleUpdate();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => window.removeEventListener("scroll", scheduleUpdate);
  }, [sections, updateActiveSection]);

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
            onClick={() => {
              // Override scroll-spy for 1s so the clicked section stays
              // highlighted while the browser finishes scrolling.
              clickOverrideRef.current = s.id;
              setActiveId(s.id);
              if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
              clickTimerRef.current = setTimeout(() => {
                clickOverrideRef.current = null;
              }, 1000);
            }}
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
