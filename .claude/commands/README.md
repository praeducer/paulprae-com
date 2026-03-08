# Commands

Custom slash commands for Claude Code. Use for frequent, manual workflows.

- **Trigger:** Manual (e.g. `/deploy-vercel`)
- **Scope:** Project-wide
- **Format:** One `.md` file per command with optional frontmatter (`description`, `allowed-tools`)

Example: `/deploy-vercel` → build and deploy paulprae.com to Vercel.

Available commands:

- `/deploy-vercel` — run quality checks, build, and deploy.
- `/setup-mcp` — install MCP config for Claude Code and Cursor.
- `/qa-comprehensive` — run end-to-end QA-only review and generate Claude Code fix backlog.
- `/qa-execute-v2` — execute V2 implementation handoff from QA findings.
