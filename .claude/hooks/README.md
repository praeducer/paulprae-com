# Hooks

Event-driven automation (e.g. run lint after edit, run tests before commit).

- **Trigger:** Events such as `PostToolUse`, `PreCommit`, `PostCommit`, `OnFileChange`
- **Config:** `hooks.json` with matchers and command lists
- **Use for:** Formatting, tests, and checks that should run automatically in the workflow
