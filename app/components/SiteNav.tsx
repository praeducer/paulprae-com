"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon, DownloadIcon } from "./Icons";
import BookInterviewLink from "./BookInterviewLink";
import {
  SITE_NAME,
  SITE_SUBTITLE,
  RESUME_DOWNLOAD_PATHS,
  NAV_LINK_CLASS,
  CTA_BUTTON_CLASS,
} from "../../lib/constants";

/**
 * Shared site navigation header — rendered identically on every page.
 *
 * Uses `usePathname()` to swap the contextual first nav item:
 * - `/`         → "New chat" (button, hard reload to reset state)
 * - all others  → "Chat with AI" (Link, SPA navigation, subtle border)
 *
 * Accepts optional `children` for page-specific secondary rows
 * (e.g. resume page's contact + download row) — server-rendered
 * content can be passed via the Next.js "donut pattern".
 */
export default function SiteNav({
  children,
  sticky = true,
}: {
  children?: React.ReactNode;
  sticky?: boolean;
}) {
  const pathname = usePathname();
  const isChat = pathname === "/";
  const headerRef = useRef<HTMLElement>(null);

  // Publish --header-height so downstream sticky elements (e.g. SectionNav)
  // and scroll-padding-top can account for the sticky header.
  // When the header scrolls away (sticky=false), set 0px so SectionNav
  // sticks to the viewport top.
  useEffect(() => {
    const rootStyle = document.documentElement.style;
    if (!sticky) {
      rootStyle.setProperty("--header-height", "0px");
      return () => {
        rootStyle.removeProperty("--header-height");
      };
    }
    const header = headerRef.current;
    if (!header) return;
    const sync = () => {
      rootStyle.setProperty("--header-height", `${header.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    return () => {
      ro.disconnect();
      rootStyle.removeProperty("--header-height");
    };
  }, [sticky]);

  return (
    <header
      ref={headerRef}
      className={`no-print ${sticky ? "sticky top-0" : "relative"} z-40 shrink-0 border-b border-slate-200/60 bg-white/95 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/95`}
    >
      <div className="mx-auto max-w-3xl px-6 py-3">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="whitespace-nowrap rounded-sm text-xl font-bold text-slate-900 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-slate-100 dark:hover:text-slate-300"
          >
            {SITE_NAME}
          </Link>
          <p className="hidden min-w-0 text-sm text-slate-500 sm:block dark:text-slate-400 truncate lg:whitespace-normal lg:line-clamp-2">
            {SITE_SUBTITLE}
          </p>
          <nav
            className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3"
            aria-label="Site navigation"
          >
            {isChat ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className={NAV_LINK_CLASS}
                title="Start a new conversation"
                aria-label="New conversation"
              >
                <ChatIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New chat</span>
              </button>
            ) : (
              <Link
                href="/"
                className={`${NAV_LINK_CLASS} border border-slate-200 dark:border-slate-700`}
                aria-label="Chat with Paul's AI assistant"
              >
                <ChatIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Chat with AI</span>
              </Link>
            )}
            <Link href="/resume" className={NAV_LINK_CLASS}>
              Resume
            </Link>
            <a
              href={RESUME_DOWNLOAD_PATHS.pdf}
              download
              className={NAV_LINK_CLASS}
              aria-label="Download resume as PDF"
              title="Download resume as PDF"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </a>
            <BookInterviewLink
              className={CTA_BUTTON_CLASS}
              title="Book interview with Paul (opens in new tab)"
            >
              <span className="hidden sm:inline">Book Interview</span>
            </BookInterviewLink>
          </nav>
        </div>
        {children}
      </div>
    </header>
  );
}
