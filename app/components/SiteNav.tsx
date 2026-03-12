"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon, DownloadIcon, CalendarIcon } from "./Icons";
import {
  SITE_NAME,
  SITE_SUBTITLE,
  BOOK_INTERVIEW_URL,
  RESUME_DOWNLOAD_PATHS,
  NAV_LINK_CLASS,
  CTA_BUTTON_CLASS,
} from "../../lib/constants";

/**
 * Shared site navigation header — rendered identically on every page.
 *
 * Uses `usePathname()` to swap the contextual first nav item:
 * - `/resume`  → "Chat with AI" (Link, SPA navigation)
 * - `/`, `/tools` → "New chat" (button, hard reload to reset state)
 *
 * Accepts optional `children` for page-specific secondary rows
 * (e.g. resume page's contact + download row) — server-rendered
 * content can be passed via the Next.js "donut pattern".
 */
export default function SiteNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const isResume = pathname === "/resume";
  const isTools = pathname === "/tools";

  return (
    <header className="no-print shrink-0 border-b border-slate-200/60 bg-white/95 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/95">
      <div className="mx-auto max-w-3xl px-6 py-3">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="text-xl font-bold text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
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
            {isResume ? (
              <Link href="/" className={NAV_LINK_CLASS} title="Chat with Paul's AI assistant">
                <ChatIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Chat with AI</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href = isTools ? "/tools" : "/";
                }}
                className={NAV_LINK_CLASS}
                title="Start a new conversation"
                aria-label="New conversation"
              >
                <ChatIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New chat</span>
              </button>
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
            <a
              href={BOOK_INTERVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={CTA_BUTTON_CLASS}
              aria-label="Book interview with Paul (opens in new tab)"
              title="Book interview with Paul (opens in new tab)"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Book Interview</span>
            </a>
          </nav>
        </div>
        {children}
      </div>
    </header>
  );
}
