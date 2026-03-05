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
