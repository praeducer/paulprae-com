import type { Metadata } from "next";
import ChatHome from "./components/ChatHome";
import {
  SITE_NAME,
  SITE_SUBTITLE,
  SITE_URL,
  SITE_DESCRIPTION,
  SITE_OG_DESCRIPTION,
} from "../lib/constants";

const pageTitle = `${SITE_NAME} — AI Career Assistant | paulprae.com`;

export const metadata: Metadata = {
  title: pageTitle,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: pageTitle,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_SUBTITLE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: SITE_OG_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function Home() {
  return <ChatHome />;
}
