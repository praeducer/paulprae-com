import type { Metadata } from "next";
import Link from "next/link";
import {
  SITE_NAME,
  SITE_SUBTITLE,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
} from "../lib/constants";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-bold text-slate-900 dark:text-slate-100">404</h1>
      <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">Page not found</p>
      <p className="mt-4 max-w-md text-sm text-slate-500 dark:text-slate-400">
        The page you&apos;re looking for doesn&apos;t exist. You can chat with {SITE_NAME}&apos;s AI
        career assistant or view his resume.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/" className={BUTTON_PRIMARY_CLASS}>
          Chat with AI
        </Link>
        <Link href="/resume" className={BUTTON_SECONDARY_CLASS}>
          View Resume
        </Link>
      </div>
      <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">
        {SITE_NAME} &mdash; {SITE_SUBTITLE}
      </p>
    </main>
  );
}
