---
inclusion: manual
---

# Creating an App_Agent

How to write a Kiro custom agent that acts as an app's AI layer by calling that
app's MCP tools. Matches the two working App_Agents
(`.kiro/agents/poltergeist-detector.json`, `.kiro/agents/witches-pantry.json`).

## File

`.kiro/agents/<app>.json`. The verified-working field set for this IDE is:

```json
{
  "name": "<app>",
  "description": "One sentence on what the agent does, in character.",
  "prompt": "The persona and rules (see below).",
  "mcpServers": {
    "<app>": { "command": "sh", "args": ["apps/<app>/mcp-launch.sh"] }
  },
  "tools": ["@<app>/detect_objects", "@<app>/count_objects", "@<app>/<app_tool>"],
  "permissions": {
    "rules": [
      { "capability": "mcp", "match": ["<app>/detect_objects"], "effect": "allow" },
      { "capability": "mcp", "match": ["<app>/count_objects"], "effect": "allow" },
      { "capability": "mcp", "match": ["<app>/<app_tool>"], "effect": "allow" }
    ]
  },
  "includeMcpJson": false,
  "welcomeMessage": "A short greeting."
}
```

## Rules that matter (learned the hard way)

- **Do not add `allowedTools` or `toolsSettings`.** This IDE silently drops an
  agent that declares them from the selector — no error, no welcome message, and
  prompts fall through to the default agent. Use `permissions.rules` only.
- **`permissions.rules` works** with `{ capability, match, effect }`. For an
  App_Agent the capability is `mcp` and `match` is `<server>/<tool>`.
- **`includeMcpJson: false`** so the agent sees only its own inline server, not the
  workspace `mcp.json`. With it active, an out-of-scope request (for example "list
  the project files") is refused, while the app's tools still work.
- **Tools are `@<server>/<tool>`.** List only this app's own tools plus the
  built-ins (`detect_objects`, `count_objects`).
- **The server runs through the app's launcher**, `sh apps/<app>/mcp-launch.sh`,
  not `node --import tsx ...` directly — Kiro spawns servers with the default
  Node, which may be too old, so the launcher loads the `.nvmrc` Node first.
  Copy it from `packages/skeleton/agent-template/mcp-launch.template.sh`; a skeleton
  test fails if it differs. It runs from the app's own folder, and the server reads
  images only from `samples/` (paths in prompts are relative to `samples/`).
- **Developer agents differ**: a Dev_Agent (tool-builder, app-generator) has no
  MCP server; its `tools` are the built-ins `fs_read`, `fs_write`, `execute_bash`,
  `grep`, `glob`, and its `permissions.rules` use those capabilities (for example
  `fs_write` on `apps/**`), denying `git push *` / `git commit *` / `rm -rf *`.

## Prompt checklist

- State the persona and keep answers in that voice.
- "Always call a tool before describing an image; never guess."
- Tell it to report tool errors plainly and not retry blindly.
- For the Pantry, include the wording rule: ingredients and amounts only, and the
  Curse Level is a playful guide, not medical or dietary advice.

## After writing

Add the server to `.kiro/settings/mcp.json`, reload the Kiro window (a new server
only appears after a reload), select the agent, and test it on the sample images.
