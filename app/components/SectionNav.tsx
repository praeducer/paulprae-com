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

  // Dynamically measure the header height and set the nav's top position.
  // The header wraps at narrow viewports, so a hardcoded value won't work.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header || !navRef.current) return;

    const updateTop = () => {
      const h = header.offsetHeight;
      navRef.current!.style.top = `${h}px`;
      // Also update scroll-margin for anchor links so they clear both sticky bars
      document.documentElement.style.setProperty("--header-height", `${h}px`);
    };

    updateTop();
    const ro = new ResizeObserver(updateTop);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first section that is intersecting (visible)
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  // Clear active section highlight when scrolled near the top of the page
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY < 100) setActiveId("");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
            className={`shrink-0 rounded-md px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:outline-none ${
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
