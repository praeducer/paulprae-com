import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { loadCareerData } from "../lib/career-data";
import {
  SITE_NAME,
  SITE_SUBTITLE,
  SITE_URL,
  SITE_DESCRIPTION,
  SITE_OG_DESCRIPTION,
} from "../lib/constants";

const careerData = loadCareerData();

const ogTitle = `${SITE_NAME} — ${SITE_SUBTITLE}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI Career Assistant | paulprae.com`,
    template: "%s | paulprae.com",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: ogTitle,
    description: SITE_OG_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: ogTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: SITE_OG_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
    },
  },
  manifest: "/manifest.json",
};

function StructuredDataJsonLd() {
  if (!careerData) return null;

  const profile = careerData.profile;
  const recentPosition = careerData.positions[0];
  const education = careerData.education[0];

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: profile.name,
    url: profile.website || SITE_URL,
    image: `${SITE_URL}/og-image.png`,
    email: profile.email,
    jobTitle: SITE_SUBTITLE,
    description: SITE_DESCRIPTION,
    sameAs: [profile.linkedin, "https://github.com/praeducer"].filter(Boolean),
    knowsAbout: careerData.skills.slice(0, 20),
    ...(recentPosition && {
      worksFor: {
        "@type": "Organization",
        name: recentPosition.company,
      },
    }),
    ...(education && {
      alumniOf: {
        "@type": "EducationalOrganization",
        name: education.school,
      },
    }),
    ...(profile.location && {
      address: {
        "@type": "PostalAddress",
        addressLocality: profile.location,
      },
    }),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    author: { "@id": `${SITE_URL}/#person` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      </head>
      <body className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <StructuredDataJsonLd />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
