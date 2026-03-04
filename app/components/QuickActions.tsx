"use client";

interface QuickActionsProps {
  mode: "chat" | "tools";
  onAction: (prompt: string) => void;
}

const CHAT_ACTIONS = [
  { label: "What does Paul do?", prompt: "What does Paul do? Give me a quick overview." },
  {
    label: "Key skills",
    prompt: "What are Paul's strongest technical skills and areas of expertise?",
  },
  { label: "Recent experience", prompt: "Tell me about Paul's most recent work experience." },
  { label: "Download resume", prompt: "Where can I download Paul's resume?" },
];

const TOOLS_ACTIONS_ROW1 = [
  {
    label: "Cover Letter",
    prompt: "Generate a tailored cover letter. I'll paste the job description next.",
  },
  {
    label: "LinkedIn Connection",
    prompt:
      "Generate a LinkedIn connection request for [name] at [company]. I'll provide the details.",
  },
  {
    label: "LinkedIn InMail",
    prompt:
      "Generate a LinkedIn InMail with subject line for [name] at [company]. I'll provide the details.",
  },
  {
    label: "Email Intro",
    prompt: "Generate a cold email introduction to [name] at [company]. I'll provide the details.",
  },
];

const TOOLS_ACTIONS_ROW2 = [
  {
    label: "Thank You Note",
    prompt:
      "Generate a thank-you note after an interview at [company] for [role]. I'll provide the details.",
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
    prompt: "Generate 30-second and 60-second elevator pitches tailored to [audience/industry].",
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
