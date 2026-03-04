"use client";

interface ModeToggleProps {
  mode: "chat" | "tools";
  onModeChange: (mode: "chat" | "tools") => void;
}

/**
 * Toggle between "Ask About Paul" (recruiter Q&A) and "Job Search Tools" (content generation) modes.
 */
export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "chat"}
        onClick={() => onModeChange("chat")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
          mode === "chat"
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        Ask About Paul
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "tools"}
        onClick={() => onModeChange("tools")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
          mode === "tools"
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        Job Tools
      </button>
    </div>
  );
}
