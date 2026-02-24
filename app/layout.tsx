// TODO: Root layout with metadata, fonts, Tailwind CSS
// See CLAUDE.md for specifications
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paul Prae — Principal AI Engineer & Architect",
  description:
    "AI and data engineering leader with 15 years of experience at AWS, Microsoft, and Fortune 500 companies. Specializing in healthcare AI, ML platforms, and engineering team leadership.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
