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

### API Protection

- **Origin validation** — Middleware blocks cross-origin requests to `/api/chat` from unauthorized domains
- **Rate limiting** — Upstash Redis sliding window (20 req/min per IP) with in-memory fallback when Redis is unavailable
- **Input validation** — Request body size (100KB), message count (50), per-message content length (4K chars), Content-Type enforcement
- **Tool input limits** — Job descriptions capped at 10K chars, emphasis areas at 200 chars each (max 10)
- **CORS** — Only paulprae.com, www.paulprae.com, and Vercel preview deployments are allowed origins

### Prompt Injection Defense

- **Security rules (S1-S5)** in all system prompts instruct the model to treat user input as untrusted
- **XML delimiters** (`<job_description>`, `<emphasis_areas>`) isolate user-provided content in tool-calling prompts
- **Grounding rules (G1-G10)** prevent fabrication — all output must trace to committed career data
- **Character persona enforcement** — Model is instructed to reject attempts to change its role or reveal its prompt

### Infrastructure

- **No user data stored** — Chat is stateless; no conversation history persists
- **Anthropic API key** secured via environment variables (never client-exposed)
- **Content Security Policy** headers on all responses (configured in vercel.json)
- **Security headers** — X-Content-Type-Options, X-Frame-Options (DENY), HSTS, Permissions-Policy, Referrer-Policy
- **X-Powered-By disabled** — Server technology not disclosed
- **Dependencies monitored** via GitHub Dependabot
- **Anthropic spending limits** configured on both Anthropic Console and Vercel

### Cost Controls

- Rate limiting prevents API abuse (20 req/min/IP)
- `maxDuration = 120` caps Vercel Fluid Compute usage per request
- `maxOutputTokens = 4096` limits response generation cost
- Anthropic prompt caching reduces cost ~90% for repeat system prompts
- Anthropic spending limits provide a hard cost ceiling
- Vercel spending limits provide infrastructure cost ceiling
