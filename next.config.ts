import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 2: removed `output: 'export'` to enable API routes (/api/chat)
  // and dynamic rendering. Resume page remains statically pre-rendered.
  poweredByHeader: false,

  // Ensure Vercel's file tracer bundles data files read via fs.readFileSync.
  // lib/generated/system-prompts.ts is a TypeScript import bundled automatically.
  // lib/prompts/**/*.md are included as a safety net for the runtime fallback
  // in getSystemPrompt() (dev mode or missing generated file).
  outputFileTracingIncludes: {
    "/api/chat": [
      "./lib/prompts/**/*.md",
      "./data/generated/career-data.json",
      "./data/sources/knowledge/**/*.json",
    ],
  },
};

export default nextConfig;
