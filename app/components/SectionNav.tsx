"use client";

import { useEffect, useRef, useState } from "react";

interface Section {
  id: string;
  label: string;
}

/**
 * Compact horizontal section navigation bar.
 * Highlights the currently visible section based on scroll position.
 * Dynamically positions itself below the sticky header using ResizeObserver.
 * Hidden on print via the no-print class.
 */
export default function SectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const navRef = useRef<HTMLElement>(null);

  // Dynamically measure the header and nav heights so CSS custom properties
  // (--header-height, --nav-height) always reflect the true rendered sizes.
  // This drives scroll-padding-top and scroll-margin-top via --sticky-offset.
  useEffect(() => {
    const header = document.querySelector("header");
    const nav = navRef.current;
    if (!header || !nav) return;

    const sync = (entries?: ResizeObserverEntry[]) => {
      const root = document.documentElement.style;
      root.setProperty("--nav-height", `${nav.offsetHeight}px`);
      // Only reposition the nav when the header height changed.
      // The nav is observed solely to keep --nav-height accurate;
      // setting nav.style.top only depends on the header.
      if (!entries || entries.some((e) => e.target === header)) {
        root.setProperty("--header-height", `${header.offsetHeight}px`);
        nav.style.top = `${header.offsetHeight}px`;
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Track which section is active based on scroll position.
  // Reads --sticky-offset (header + nav) from CSS so JS and CSS stay in sync.
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY < 100) {
        setActiveId("");
        return;
      }

      const stickyOffset = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--sticky-offset") || "0",
      );
      const threshold = stickyOffset + 24;

      let current = "";
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= threshold) {
          current = section.id;
        }
      }
      setActiveId(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Defer the initial check so layout measurement is complete.
    const raf = requestAnimationFrame(onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Resume sections"
      className="no-print sticky top-0 z-30 hidden overflow-x-clip border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sm:block dark:border-slate-700/80 dark:bg-slate-950/95"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-6 py-1.5 text-xs scrollbar-none">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none ${
              activeId === s.id
                ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
