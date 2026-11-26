# Agent specs

`agents/<name>/AGENT.md` is the source of truth for each app agent. The Markdown body is a plain system prompt that works with any LLM. The front matter holds the name, description, welcome message, MCP server and launcher, and the bare tool names.

Everything below is generated from it by `skeleton-agents`, the CLI in `@skeleton-playground/core` (source: `packages/skeleton/src/agents/`). Do not edit the generated files by hand.

| Client | Generated file |
| --- | --- |
| Kiro | `.kiro/agents/<name>.json` |
| Claude Code | `.claude/agents/<name>.md` (subagent) and `.mcp.json` (MCP servers) |
| Cursor | `.cursor/rules/<name>.mdc` and `.cursor/mcp.json` |
| Claude Desktop and other MCP clients | Copy the `mcpServers` block from `.mcp.json` into the client's MCP config |
| Any chat UI or API | `agents/generated/<name>.system-prompt.md`, used as the system message, with the MCP server attached |

```
pnpm agents:generate   # rewrite the generated files
pnpm agents:check      # fail if a generated file is out of date
```

Tool names are written as the MCP server defines them (`detect_objects`). Each adapter adds its own prefix and permission format, for example `mcp__witches-pantry__detect_objects` for Claude Code.

Launcher paths in `.mcp.json` are relative to the repo root, so start the client from there.
