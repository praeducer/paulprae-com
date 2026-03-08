"use client";

import Link from "next/link";
import { SITE_NAME, SITE_SUBTITLE } from "../lib/constants";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
        An unexpected error occurred. Please try again or navigate back to the homepage.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Error ID: {error.digest}</p>
      )}
      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Go to homepage
        </Link>
      </div>
      <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">
        {SITE_NAME} &mdash; {SITE_SUBTITLE}
      </p>
    </main>
  );
}
