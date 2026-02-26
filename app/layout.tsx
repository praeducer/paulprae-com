import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paul Prae — Principal AI Engineer & Architect",
  description:
    "AI and data engineering leader with 15 years of experience at AWS, Microsoft, and Fortune 500 companies. Specializing in healthcare AI, ML platforms, and engineering team leadership.",
  openGraph: {
    title: "Paul Prae — Principal AI Engineer & Architect",
    description:
      "AI and data engineering leader specializing in healthcare AI, ML platforms, and engineering team leadership.",
    type: "website",
    url: "https://paulprae.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
