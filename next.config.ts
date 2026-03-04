import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 2: dynamic rendering enabled for API routes (/api/chat)
  // Resume page uses generateStaticParams for static pre-rendering

  // Ensure Vercel's file tracer bundles prompt templates and data files
  // that are read via fs.readFileSync at runtime in API routes.
  outputFileTracingIncludes: {
    "/api/chat": [
      "./lib/prompts/**/*.md",
      "./data/generated/career-data.json",
      "./data/sources/knowledge/**/*.json",
    ],
  },
};

export default nextConfig;
