---
inclusion: fileMatch
fileMatchPattern: 'apps/*/src/mcp-server.ts|packages/skeleton/src/node/mcp/**'
---

# Adding an MCP tool

Load this when editing an app's `src/mcp-server.ts` or the MCP server kit. It is
the step-by-step for adding a new tool so it matches the two existing apps.

## The pattern (do it in this order)

1. **Write the logic as a pure function first**, in its own module under the app's
   `src/` (for example `compare-scenes.ts`, `suggest-recipes.ts`, `coco-labels.ts`).
   No I/O side effects beyond what is passed in. This is what makes the CLI/UI and
   the MCP tool share one implementation — never duplicate the logic in the handler.

2. **Add a test next to it** (`<name>.test.ts`). Prefer a property test with
   `fast-check` for the pure logic, plus an example test or two. Run `pnpm test`.

3. **Register the tool** in the app's `src/mcp-server.ts`:
   - Import `defineTool`, `jsonResult`/`textResult`, and `z` from `@skeleton-crew/core/node`.
   - Build the input schema with that `z` (so it shares the kit's Zod version).
     Keep the schema free of `.transform()` and `.default()`.
   - Add `defineTool({ name, description, inputSchema, handler })` to the `tools` array
     that `createServer()` passes to `createAppServer`. `defineTool` keeps each tool's
     input type; `createAppServer` registers it (via `registerTool`) next to the built-ins.
   - The handler calls the pure function and returns `jsonResult(...)` or `textResult(...)`.

4. **Give the app's agent the tool.** Open `.kiro/agents/<app>.json` and add the tool in
   three places: `tools` (`@<app>/<tool_name>`), a `permissions.rules` entry
   (`{ "capability": "mcp", "match": ["<app>/<tool_name>"], "effect": "allow" }`), and the
   "You can only use these tools" line in the prompt, with one line on when to use it.
   Without this the server lists the tool but the agent cannot call it.

## Rules the kit enforces or expects

- **Tool names are `snake_case`** (`detect_objects`, `compare_scenes`, `list_labels`).
  `registerTool` throws on anything else, and `constructor` is reserved.
- **Duplicate names throw at registration** — pick a unique name.
- **Input is validated before the handler runs.** A schema mismatch becomes an
  error result; the handler never sees bad input.
- **A thrown handler error becomes an error result**, it does not crash the server.
- **Log only to stderr** in server code. stdout is the MCP protocol channel — a
  stray `console.log` corrupts it. Use `console.error` or the kit helpers.
- **Describe the tool well.** The `description` and each field's `.describe()` are
  what the model reads to decide how to call it. Say what it returns.

## No-input tools

Use `z.object({})` as the schema. See `list_labels` in
`apps/poltergeist-detector/src/mcp-server.ts` for the shape.

## Verify

Run `pnpm typecheck` and `pnpm test`. Then drive the server once over stdio (or the
MCP Inspector) to confirm `tools/list` shows the new tool and a sample call works, and
check that the agent's `tools` list matches what `tools/list` returns.
Do not commit — the user commits.
