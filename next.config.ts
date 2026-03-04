import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 2: removed `output: 'export'` to enable API routes (/api/chat)
  // and dynamic rendering. Resume page remains statically pre-rendered.

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
