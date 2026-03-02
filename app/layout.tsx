import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { loadCareerData } from "../lib/career-data";

const careerData = loadCareerData();

export const metadata: Metadata = {
  metadataBase: new URL("https://paulprae.com"),
  title: "Paul Prae — Principal AI Engineer & Solutions Architect",
  description:
    "Building AI agents that ship AI products. 15+ years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Paul Prae — Principal AI Engineer & Solutions Architect",
    description:
      "Building AI agents that ship AI products. 15+ years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.",
    type: "website",
    url: "https://paulprae.com",
    siteName: "Paul Prae",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Paul Prae — Principal AI Engineer & Solutions Architect",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Paul Prae — Principal AI Engineer & Solutions Architect",
    description:
      "Building AI agents that ship AI products. 15+ years delivering enterprise AI at AWS, Microsoft, and Fortune 500 across healthcare, life science, and insurance.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://paulprae.com",
  },
  manifest: "/manifest.json",
  other: {
    "theme-color": "#ffffff",
  },
};

function PersonJsonLd() {
  if (!careerData) return null;

  const profile = careerData.profile;
  const recentPosition = careerData.positions[0];
  const education = careerData.education[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://paulprae.com/#person",
    name: profile.name,
    url: profile.website || "https://paulprae.com",
    image: "https://paulprae.com/og-image.png",
    email: profile.email,
    jobTitle: "Principal AI Engineer & Solutions Architect",
    description: metadata.description,
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <PersonJsonLd />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
