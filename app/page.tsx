import type { Metadata } from "next";
import ChatHome from "./components/ChatHome";

export const metadata: Metadata = {
  title: "Paul Prae — AI Career Assistant | paulprae.com",
  description:
    "Chat with an AI assistant about Paul Prae's career, skills, and experience. Download resumes, ask about expertise, or use job search tools.",
  openGraph: {
    title: "Paul Prae — AI Career Assistant | paulprae.com",
    description:
      "Chat with an AI assistant about Paul Prae's career, skills, and experience. Download resumes, ask about expertise, or use job search tools.",
    type: "website",
    url: "https://paulprae.com",
    siteName: "Paul Prae",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Paul Prae — AI Career Assistant",
      },
    ],
  },
};

export default function Home() {
  return <ChatHome />;
}
