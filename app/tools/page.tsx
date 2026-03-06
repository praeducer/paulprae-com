import type { Metadata } from "next";
import ChatHome from "../components/ChatHome";
import { SITE_NAME } from "../../lib/constants";

export const metadata: Metadata = {
  title: "Job Search Tools",
  description: `AI-powered job search tools built by ${SITE_NAME}. Generate tailored outreach, interview prep, and application content — all grounded in real career data.`,
  robots: { index: false, follow: false },
  alternates: {
    canonical: null,
  },
};

export default function ToolsPage() {
  return <ChatHome mode="tools" />;
}
