# MCP Tools — Planning

MCP (Model Context Protocol) servers are configured in **`.claude/.mcp.json`**. The file is currently a stub with no servers.

**Next steps:** Develop a plan to add relevant MCP tools for this project (e.g. Vercel, GitHub, filesystem, or project-specific tools), then register them under `mcpServers` in `.mcp.json`. Use env vars for secrets (e.g. `"${VERCEL_TOKEN}"`).

**Reference:** [MCP servers directory](https://github.com/modelcontextprotocol/servers) · [Claude Code MCP docs](https://code.claude.com/docs)
