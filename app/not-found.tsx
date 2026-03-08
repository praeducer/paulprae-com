import Link from "next/link";
import { SITE_NAME, SITE_SUBTITLE } from "../lib/constants";

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
        <Link
          href="/"
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
        >
          Chat with AI
        </Link>
        <Link
          href="/resume"
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          View Resume
        </Link>
      </div>
      <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">
        {SITE_NAME} &mdash; {SITE_SUBTITLE}
      </p>
    </main>
  );
}
