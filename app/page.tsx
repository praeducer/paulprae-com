import type { Metadata } from "next";
import ChatHome from "./components/ChatHome";
import { SITE_NAME, SITE_SUBTITLE, SITE_URL, SITE_DESCRIPTION } from "../lib/constants";

export const metadata: Metadata = {
  title: `${SITE_NAME} — AI Career Assistant | paulprae.com`,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `${SITE_NAME} — AI Career Assistant | paulprae.com`,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_SUBTITLE}`,
      },
    ],
  },
};

export default function Home() {
  return <ChatHome />;
}
