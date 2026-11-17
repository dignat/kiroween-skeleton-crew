---
inclusion: always
---

# Project Structure

## Stack

- TypeScript only, strict mode. Shared options live in `tsconfig.base.json`; each package extends it.
- Node 22 (`.nvmrc`), pnpm workspaces. Run `nvm use` first. Use pnpm only, with exact versions (`pnpm add --save-exact`).
- Tests: Vitest for unit tests and `fast-check` for property-based tests. Run with `pnpm test` (`vitest run`). Typecheck with `pnpm typecheck`.
- Detection: TensorFlow.js (COCO-SSD and a MobileNet-style food classifier) behind a `ModelAdapter`.
- MCP: each app runs its own stdio MCP server. Kiro custom agents call it. No paid APIs.
- MCP launch: each app owns a Node launcher `apps/<app>/mcp-launch.cjs` (CommonJS, copied from `mcp-launch.template.cjs`). It reads the major version from `.nvmrc`, uses the current `node` if new enough or else an nvm/nvm-windows install of that version, and spawns `node --import tsx src/mcp-server.ts` from the app's own folder, logging only to stderr. `mcp.json` and agents run it as `{ "command": "node", "args": ["apps/<app>/mcp-launch.cjs"] }` on every platform. Each app also owns the POSIX fallback `apps/<app>/mcp-launch.sh` (loads nvm, selects the `.nvmrc` Node, execs the server), documented for machines where Kiro has no `node` on PATH, run as `{ "command": "sh", "args": ["apps/<app>/mcp-launch.sh"] }`. One pair of launchers per app, no shared root launcher, both checked against their templates by tests. Launchers never run from the repo root, and the server reads images only from `samples/` (found from its own file location, override with `MCP_IMAGES_DIR`), never from `process.cwd()`. Tested on macOS only; Windows is untested. Kiro spawns servers without `nvm use`, so a bare `node --import tsx` command could use the wrong Node version.

## Layout

```
packages/skeleton/        shared template (package name @skeleton-playground/core)
apps/poltergeist-detector/  CLI before/after scene comparison
apps/witches-pantry/      web UI, food detection and recipes
samples/                  own photos only
.kiro/                    specs, steering, hooks, agents, settings (always committed)
```

Tests sit next to the code as `*.test.ts` under `src/`.

## The skeleton stays generic

- `packages/skeleton` knows nothing about photos, recipes, or any single app.
- Apps never edit files under `packages/`. App-specific logic lives in the app folder.
- Apps import the skeleton through `@skeleton-playground/core` (`workspace:*`).
- The browser-safe entry point must not import Node modules (`fs`, `path`, etc.). Node-only code (image loading, MCP server kit) goes in the Node entry point.
- Each app's CLI or UI and its MCP tools call the same app logic. Do not duplicate it.

## Naming

- Files and folders: `kebab-case` (`compare-scenes.ts`, `compare-scenes.test.ts`).
- Types, interfaces, classes: `PascalCase`. Functions and variables: `camelCase`.
- MCP tool names: `snake_case` (`detect_objects`, `compare_scenes`).
- ESM only (`"type": "module"`). Use `.js` extensions in relative imports if the tsconfig requires them.

## Behavior rules

- Log only to stderr in MCP servers. stdout belongs to the protocol.
- Validate tool input with Zod before the handler runs. A thrown error becomes an error result, not a crash.
- Never commit from the agent. Never add `.kiro/` to `.gitignore`.
