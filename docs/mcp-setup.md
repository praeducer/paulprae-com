# MCP Setup — Claude Code and Cursor

This project configures [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers so both **Claude Code** (CLI/desktop) and **Cursor** (IDE) can use the same tools when working in this repo.

## Config locations

| Consumer     | File                | Purpose                          |
| ------------ | -------------------- | -------------------------------- |
| Claude Code  | **`.mcp.json`** (project root) | Project-scoped MCP (official docs) |
| Cursor       | **`.cursor/mcp.json`**         | Project-level MCP                |

Both files are generated from the canonical template **`scripts/setup/mcp-servers.json`** so they stay in sync.

## Servers included

| Server      | Transport | Purpose |
| ----------- | --------- | ------- |
| **Vercel**  | HTTP (OAuth) | List deployments, get build/runtime logs, manage projects, search Vercel docs. Use to verify deployment or debug production. |
| **GitHub**  | HTTP (OAuth) | PRs, issues, repo context. Authenticate via `/mcp` in Claude or Cursor MCP UI. |
| **Filesystem** | stdio (npx) | Read/write under project directory (`.`). Scoped to repo. |
| **Fetch**   | stdio (npx) | Fetch web content for docs or links. |

Vercel and GitHub use OAuth; no API keys in the config. Filesystem and Fetch run locally via `npx`.

## One-time setup (new contributor)

1. **Clone and install deps:** `npm install`
2. **Install MCP config:**
   - **Linux / WSL / macOS:** `bash scripts/setup/install-mcp.sh`
   - **Windows:** `powershell -NoProfile -File scripts\setup\install-mcp.ps1`
3. **Claude Code:** From project root, run `claude`. Type `/mcp` and authenticate for Vercel and GitHub when prompted.
4. **Cursor:** Restart Cursor so it loads `.cursor/mcp.json`. When you use MCP tools, authenticate when prompted (Vercel, GitHub).

## Env vars (optional)

- **Filesystem:** By default the filesystem server allows the current directory (`.`). To override, set `MCP_FILESYSTEM_ALLOWED_DIRS` (not required for typical use).
- **Secrets:** Do not put API keys in the JSON. Vercel and GitHub use OAuth via the client.

## Troubleshooting

- **Cursor not seeing new servers:** Fully restart Cursor after changing `.cursor/mcp.json`.
- **Claude Code:** Project-scoped servers are read from **project root** `.mcp.json`, not from `.claude/`. If you added servers under `.claude/` before, use the root `.mcp.json` now.
- **Vercel / GitHub "Needs login":** Use `/mcp` in Claude Code or the MCP authentication flow in Cursor to sign in.
- **stdio servers (filesystem, fetch):** Require Node.js and `npx` on PATH. On Windows, local stdio servers using `npx` may need `cmd /c` in some clients; the config here is the standard form.

## Phase 2/3 (later)

Sentry, PostgreSQL, Supabase, or Neo4j MCPs can be added when those stacks are in use. See [.claude/plans/backlog.md](../.claude/plans/backlog.md) for the roadmap.
