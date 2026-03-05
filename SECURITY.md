# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in paulprae.com, please report it responsibly:

1. **Email:** Send details to the repository owner via GitHub ([@praeducer](https://github.com/praeducer))
2. **Do not** open a public GitHub issue for security vulnerabilities
3. Include steps to reproduce, impact assessment, and any suggested fixes

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix or mitigation:** As soon as reasonably possible

## Scope

This policy covers:

- The paulprae.com web application and its `/api/chat` endpoint
- The AI generation pipeline scripts
- Infrastructure configuration (Vercel, GitHub Actions)

## Security Measures

- API rate limiting via Upstash Redis (20 req/min per IP)
- Input validation and size limits on all API endpoints
- No user data stored — the chat is stateless
- Anthropic API key secured via environment variables (never client-exposed)
- Content Security Policy headers on all responses
- Dependencies monitored via GitHub Dependabot
