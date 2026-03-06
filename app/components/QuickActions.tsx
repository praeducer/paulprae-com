"use client";

interface QuickActionsProps {
  mode: "chat" | "tools";
  onAction: (prompt: string) => void;
}

const CHAT_ACTIONS = [
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
    prompt:
      "I'd like a tailored version of Paul's resume for the following role:\n\n[Paste the job description here]",
  },
  {
    label: "Download resume",
    prompt: "I'd like to download Paul's resume. What formats are available?",
  },
];

const TOOLS_ACTIONS_ROW1 = [
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

const TOOLS_ACTIONS_ROW2 = [
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

/**
 * Quick action chips that pre-fill the chat with mode-specific prompts.
 */
export default function QuickActions({ mode, onAction }: QuickActionsProps) {
  const actions = mode === "chat" ? CHAT_ACTIONS : [...TOOLS_ACTIONS_ROW1, ...TOOLS_ACTIONS_ROW2];

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onAction(action.prompt)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
