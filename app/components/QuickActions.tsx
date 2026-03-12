"use client";

import { CalendarIcon } from "./Icons";
import { BOOK_INTERVIEW_URL } from "../../lib/constants";

interface QuickActionsProps {
  mode: "chat" | "tools";
  onAction: (prompt: string) => void;
  onPrefill?: (text: string) => void;
}

type Action = { label: string; prompt: string; prefill?: boolean } | { label: string; url: string };

const CHAT_ACTIONS: Action[] = [
  {
    label: "Quick overview",
    prompt: "Give me a 3-sentence overview of Paul's background.",
  },
  {
    label: "Core expertise",
    prompt: "What are Paul's top 3 technical strengths with specific examples?",
  },
  {
    label: "Recent work",
    prompt: "What has Paul built most recently at Arine?",
  },
  {
    label: "Tailored resume",
    prompt: "I'd like a tailored version of Paul's resume for the following role:\n\n",
    prefill: true, // Pre-fill composer so user can paste JD before sending
  },
  {
    label: "Download resume",
    prompt: "I'd like to download Paul's resume. What formats are available?",
  },
  {
    label: "Book Interview",
    url: BOOK_INTERVIEW_URL,
  },
];

const TOOLS_ACTIONS_ROW1: Action[] = [
  {
    label: "Cover Letter",
    prompt: "Generate a tailored cover letter. I'll paste the job description next.",
  },
  {
    label: "LinkedIn Connection",
    prompt:
      "Generate a LinkedIn connection request. I'll provide the recipient's name, company, and context.",
  },
  {
    label: "LinkedIn InMail",
    prompt:
      "Generate a LinkedIn InMail with subject line. I'll provide the recipient's name, company, and context.",
  },
  {
    label: "Email Intro",
    prompt:
      "Generate a cold email introduction. I'll provide the recipient's name, company, and context.",
  },
];

const TOOLS_ACTIONS_ROW2: Action[] = [
  {
    label: "Thank You Note",
    prompt:
      "Generate a thank-you note after an interview. I'll provide the company, role, and details.",
  },
  {
    label: "Follow-Up",
    prompt: "Generate a follow-up message after no response. I'll provide the context.",
  },
  {
    label: "STAR Answer",
    prompt: "Generate a STAR-format interview answer. I'll provide the question and context.",
  },
  {
    label: "Elevator Pitch",
    prompt:
      "Generate 30-second and 60-second elevator pitches. I'll provide the target audience and industry.",
  },
];

const chipClass =
  "min-h-[44px] sm:min-h-0 cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2.5 text-xs sm:py-1.5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200";

const ctaChipClass =
  "min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs sm:py-1.5 font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 dark:hover:text-blue-200";

/**
 * Quick action chips. Most send a message immediately; chips with `prefill`
 * populate the composer so the user can add context (e.g., paste a JD) first.
 * URL chips navigate to an external page (e.g., booking link).
 */
export default function QuickActions({ mode, onAction, onPrefill }: QuickActionsProps) {
  const actions = mode === "chat" ? CHAT_ACTIONS : [...TOOLS_ACTIONS_ROW1, ...TOOLS_ACTIONS_ROW2];

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => {
        if ("url" in action) {
          return (
            <a
              key={action.label}
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className={ctaChipClass}
            >
              <CalendarIcon className="h-3 w-3" />
              {action.label}
            </a>
          );
        }
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              if ("prefill" in action && action.prefill && onPrefill) {
                onPrefill(action.prompt);
              } else {
                onAction(action.prompt);
              }
            }}
            className={chipClass}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
