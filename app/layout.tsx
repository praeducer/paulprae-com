import type { Metadata } from "next";
import "./globals.css";
import careerData from "../data/generated/career-data.json";

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
};

function PersonJsonLd() {
  const profile = careerData.profile;
  const recentPosition = careerData.positions[0];
  const education = careerData.education[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: profile.website || "https://paulprae.com",
    email: profile.email,
    jobTitle: recentPosition?.title || profile.headline,
    description: metadata.description,
    sameAs: [profile.linkedin, "https://github.com/praeducer"].filter(Boolean),
    knowsAbout: careerData.skills.slice(0, 20),
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
      <body className="bg-white text-slate-900 antialiased">
        <PersonJsonLd />
        {children}
      </body>
    </html>
  );
}
