# Documentation Map

This directory is organized by concern so each topic has one canonical home.

| Document                           | Scope                                                  |
| ---------------------------------- | ------------------------------------------------------ |
| `technical-design-document.md`     | System architecture, constraints, and phase roadmap    |
| `domain-dns-runbook.md`            | Domain/DNS operations and validation                   |
| `linux-dev-environment-setup.md`   | Linux/WSL development setup and troubleshooting        |
| `windows-dev-environment-setup.md` | Windows workstation setup and Dev Drive workflow       |
| `devops.md`                        | Deployment, smoke tests, rollback, CI/CD configuration |
| `uat-checklist.md`                 | Post-deployment user acceptance testing checklist      |
| `ai-architecture.md`               | AI engineering decisions, model routing, cost analysis |
| `mcp-setup.md`                     | MCP server configuration for Claude Code and Cursor    |
| `../CONTRIBUTING.md`               | Development workflow, branching strategy, code quality |

## Separation of Concerns Rules

- Put operational DNS/domain actions in `domain-dns-runbook.md`.
- Put deployment pipeline behavior in `README.md` and high-level architecture in `technical-design-document.md`.
- Put machine setup only in platform-specific setup guides.
- Keep historical completion logs out of active runbooks and plans.
- Keep actionable AI tasks in `.claude/plans/backlog.md`.
