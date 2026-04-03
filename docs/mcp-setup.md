# MCP Setup — Claude Code and Cursor

This project configures [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers so both **Claude Code** (CLI/desktop) and **Cursor** (IDE) can use the same tools when working in this repo.

## Config locations

| Consumer    | File                           | Purpose                            |
| ----------- | ------------------------------ | ---------------------------------- |
| Claude Code | **`.mcp.json`** (project root) | Project-scoped MCP (official docs) |
| Cursor      | **`.cursor/mcp.json`**         | Project-level MCP                  |

Both files are generated from the canonical template **`scripts/setup/mcp-servers.json`** so they stay in sync.

## Servers included

| Server         | Transport    | Purpose                                                                                                                      |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**     | HTTP (OAuth) | List deployments, get build/runtime logs, manage projects, search Vercel docs. Use to verify deployment or debug production. |
| **Playwright** | stdio (npx)  | Browser automation for UAT testing. Powers the `/uat` command — navigates pages, checks UI, validates headers.               |

Vercel uses OAuth; no API keys in the config. Playwright runs via `npx @playwright/mcp@latest` (auto-installs on first use).

> **GitHub access:** GitHub MCP (`api.githubcopilot.com`) was removed — it requires a GitHub Copilot subscription for OAuth. Use the `gh` CLI instead, which is more capable and already authenticated via `gh auth login`.

> **Removed:** `filesystem` and `fetch` stdio servers were removed — Claude Code provides native Read/Write/Edit/Glob/Grep and WebFetch tools that are faster and more capable.

## One-time setup (new contributor)

1. **Clone and install deps:** `npm install`
2. **Install MCP config:**
   - **Linux / WSL / macOS:** `bash scripts/setup/install-mcp.sh`
   - **Windows:** `powershell -NoProfile -File scripts\setup\install-mcp.ps1`
3. **Claude Code:** From project root, run `claude`. Type `/mcp` and authenticate for Vercel when prompted.
4. **Cursor:** Restart Cursor so it loads `.cursor/mcp.json`. When you use MCP tools, authenticate when prompted (Vercel).

## Env vars (optional)

- **Secrets:** Do not put API keys in the JSON. Vercel uses OAuth via the client.

## Troubleshooting

- **Cursor not seeing new servers:** Fully restart Cursor after changing `.cursor/mcp.json`.
- **Claude Code:** Project-scoped servers are read from **project root** `.mcp.json`, not from `.claude/`. If you added servers under `.claude/` before, use the root `.mcp.json` now.
- **Vercel "Needs login":** Use `/mcp` in Claude Code or the MCP authentication flow in Cursor to sign in.
  Future MCP additions (Sentry/PostgreSQL/Supabase/Neo4j) are tracked as actionable items in `.claude/plans/backlog.md`.
