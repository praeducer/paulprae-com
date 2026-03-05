# Changelog

All notable changes to paulprae.com are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- AI chat interface at `/` powered by Claude Sonnet via Vercel AI SDK 6
- Tool-calling: `generate_tailored_resume` and `get_resume_links`
- `/tools` mode with 8 job search tool chips (noindex)
- `/api/chat` streaming endpoint with Anthropic prompt caching
- Rate limiting via Upstash Redis (graceful fallback without Redis)
- Welcome message with recruiter-focused value proposition
- Quick action chips for common recruiter queries
- Resume page at `/resume` with section navigation and download links
- Playwright E2E integration tests
- CHANGELOG.md and SECURITY.md

### Changed

- Homepage from static resume to AI chat-first experience
- Build output from static export (`out/`) to server-rendered (`.next/`)
- Chat API hardened with JSON parse safety, size limits (100KB), message limits (50)
- Origin validation middleware blocks cross-origin API abuse (CORS)
- In-memory rate limiter fallback when Upstash Redis is unavailable
- Per-message content length validation (4K chars) and total input budget
- Content-Type enforcement (415 for non-JSON requests)
- Prompt injection defenses in all system prompts (security rules S1-S5)
- XML delimiters around user input in tool-calling to isolate untrusted data
- Zod schema limits on tool inputs (job description 10K chars, emphasis areas capped)
- Security headers in middleware (X-Content-Type-Options, X-Frame-Options, etc.)
- Security and middleware test suite (origin validation, headers, prompt defenses)
- Vercel AI Gateway integration with direct Anthropic fallback for local dev
- Character counter in chat composer (appears at 75% of 4K limit)
- Renamed middleware.ts → proxy.ts for Next.js 16 compatibility
- Added `"framework": "nextjs"` to vercel.json (fixes 404 on preview deployments)
- Removed duplicate security headers from proxy (vercel.json handles at CDN level)

### Removed

- Static export mode (`output: 'export'`)
- Legacy `out/` test assertions and stale documentation references

## [1.0.0] — 2026-02-15

### Added

- AI-generated resume from LinkedIn data + knowledge base via Claude Opus
- Pipeline: ingest → generate → compare → approve → export → build
- Responsive single-page resume at paulprae.com
- PDF and DOCX export via Pandoc + Typst
- 315+ unit and integration tests
- CI/CD with GitHub Actions + Vercel auto-deploy
- Brand asset generation (OG image, favicons)
