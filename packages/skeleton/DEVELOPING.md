# Developing the skeleton (monorepo guide)
**Platform:** the Kiro entries run a Node launcher (`node apps/<app>/mcp-launch.cjs`), which is meant to work on macOS, Linux and Windows. It is tested on macOS only. `mcp-launch.sh` is the documented POSIX fallback; see "Windows support" at the end of this file.

For people working inside the `kiroween-skeleton-crew` repo. This file is not shipped to npm; the package
README (`README.md`) is the user-facing one.

Apps in this repo depend on the package as `"@skeleton-playground/core": "workspace:*"` and never edit files in
`packages/skeleton`. Inside the repo the package runs straight from `src/` (TypeScript).

## Create a new app in this repo

1. **Make the folder** `apps/<your-app>/` with a `package.json` that has `"type": "module"` and the dependency `"@skeleton-playground/core": "workspace:*"`. Also add, as exact-version dependencies, `@tensorflow/tfjs` and the model package your detector uses (`@tensorflow-models/coco-ssd` or `@tensorflow-models/mobilenet`): the skeleton lists them as optional peer dependencies, so each app declares what it runs. Copy `tsconfig.json` from an existing app. Run `pnpm install` from the repo root to link it.
2. **Write the app logic** as plain functions in `apps/<your-app>/src/`. The CLI or UI and the MCP tool must both call these same functions, so results match everywhere.
3. **Write the MCP server entry**, `apps/<your-app>/src/mcp-server.ts`:

   ```ts
   import { fileURLToPath } from 'node:url';
   import { createCocoSsdAdapter, createDetector } from '@skeleton-playground/core';
   import { createNodeImageDecoder, createSkeletonServer, registerTool, serveOverStdio, z } from '@skeleton-playground/core/node';

   const decodeImage = createNodeImageDecoder({ allowedRoot: fileURLToPath(new URL('../../../samples', import.meta.url)) });
   const detector = createDetector(createCocoSsdAdapter({ decodeImage }));

   serveOverStdio('my-app', () => {
     const server = createSkeletonServer({ name: 'my-app', version: '0.1.0', detector });
     registerTool(server, {
       name: 'my_tool', // snake_case
       description: 'What the tool does, written for a model.',
       inputSchema: z.object({ imagePath: z.string() }),
       handler: async ({ imagePath }) => ({ content: [{ type: 'text', text: `looked at ${imagePath}` }] }),
     });
     return server;
   });
   ```

4. **Add the launcher and register the server with Kiro.** Copy `agent-template/mcp-launch.template.sh` to `apps/my-app/mcp-launch.sh` and `agent-template/mcp-launch.template.cjs` to `apps/my-app/mcp-launch.cjs` (the default; the `.sh` one is the fallback), replacing only `{{APP_DISPLAY_NAME}}` in each. Kiro starts servers with whatever Node is the default, and the launcher selects the project's Node. In the server, set the allowed image folder from the file's own location, not the working directory: `process.env.MCP_IMAGES_DIR ?? fileURLToPath(new URL('../../../samples', import.meta.url))`. Tests (`src/tests/unit/mcp-launcher.test.ts` and `mcp-security.test.ts`) fail if a launcher differs from the template, a server uses `process.cwd()`, an app imports `fs`, `child_process` or network modules, or an agent gets wildcard or non-app tools. Then register it in `.kiro/settings/mcp.json`:

   ```json
   { "mcpServers": { "my-app": { "command": "node", "args": ["apps/my-app/mcp-launch.cjs"] } } }
   ```

5. **Create the App_Agent**: copy `agent-template/app-agent.template.json` to `.kiro/agents/<your-app>.json` and fill in every `{{PLACEHOLDER}}` (app name, description, persona, your tool name, the MCP entry path, a welcome message). The template gives the agent only this app's tools.
6. **Test it**: run `pnpm test` and `pnpm typecheck`, check the server with `pnpm dlx @modelcontextprotocol/inspector node --import tsx apps/my-app/src/mcp-server.ts`, then ask the agent in Kiro to use a tool.

## Publishing (maintainers)
Inside the repo the package runs straight from `src/` (TypeScript). `pnpm pack` and `pnpm publish` swap the entry points to the compiled `dist/` through `publishConfig.exports`, and `prepack` builds first.
```bash
pnpm --filter @skeleton-playground/core build           # compile to dist/ (also runs on pack)
pnpm --filter @skeleton-playground/core pack            # inspect the tarball
pnpm --filter @skeleton-playground/core publish --dry-run
```
Publishing needs an npm login for an account in the `skeleton-playground` npm organization (the `@skeleton-playground` scope). Check the tarball contents before each publish (`pnpm pack` or `publish --dry-run`): no tests, fixtures or spike files should be in it.

Release checklist: update `version` in `package.json`, add a matching `## <version>` section to `CHANGELOG.md` (a test fails without it), run `pnpm test`, then publish. For a build with npm provenance, push a tag named `core-v<version>` (or run the workflow by hand): `.github/workflows/publish-core.yml` tests, then publishes with `--provenance`. It needs an `NPM_TOKEN` repository secret (an npm automation token). Publishing by hand from your machine also works but has no provenance.

## Tests

`pnpm test` from the repo root runs everything offline. The tests that load the real models are skipped unless you set `RUN_MODEL_TESTS=1`.

## Windows support
Status: the Node launcher (option 2 below, `apps/<app>/mcp-launch.cjs` from `agent-template/mcp-launch.template.cjs`) is now the default in `mcp.json`, the agent configs and the agent template, and the lint tests require it. It is verified on macOS only (Kiro IDE from a terminal and from Spotlight, Kiro CLI, an old default Node falling back to the nvm Node 22). Nothing has been tested on Windows. `mcp-launch.sh` stays as the documented fallback for a Kiro with no `node` on its PATH. `.gitattributes` keeps `*.sh` and `*.cjs` on LF. A `windows-latest` CI job is still open. The rest of this section is the original investigation, kept for the record; some of its "open" items are now done.

**Why the shell launcher cannot just be ported**
- Kiro's `mcp.json` accepts only `command`, `args` and `env`. There is no `cwd` and no per-OS entry, so Windows needs its own block, and users edit it locally.
- Agent configs (`.kiro/agents/*.json`) carry an inline `mcpServers` entry that takes priority over `mcp.json` (order: agent config, workspace `mcp.json`, global `mcp.json`). A Windows user would have to change each agent file too, so the agent template would need a Windows variant.
- nvm-windows needs administrator rights for `nvm use`, switches Node for the whole machine, and does not read `.nvmrc`. Do not build a launcher on it.
- A `.cmd` launcher is the weakest choice: MCP clients cannot start `.cmd` files directly (it has to be `cmd /c ...`), `cmd` treats forward slashes as switches so relative paths like `apps/x/...` are a known gotcha, and recent Node versions refuse to spawn `.cmd` files without a shell.
- The shell launcher must stay on macOS and Linux. Kiro started from the Dock often has no `node` on its PATH, so a Node-based launcher cannot replace `sh` there.

**Options, best first**
1. **Direct `node` entry (recommended).** `"command": "node", "args": ["--import", "tsx", "apps/<app>/src/mcp-server.ts"]`. No launcher at all. Works when the default Node is 22.12 or newer, which is common on Windows because the installer puts one Node on the PATH. If Node is too old the failure is the unhelpful "Connection closed". A server exits as soon as its stdin closes (checked), so no wrapper is needed to avoid orphan processes.
2. **A Node launcher (`mcp-launch.cjs`, built),** run as `node apps/<app>/mcp-launch.cjs`. Plain CommonJS runs on an old Node, because the original failure was the `--import` flag, not the script. It could print a clear version error and look for Node 22 in nvm-windows or fnm folders. About 60 lines for a better error message, so only worth it after a real user hits an old Node.
3. **WSL:** `"command": "wsl", "args": ["sh", "apps/<app>/mcp-launch.sh"]`. Reuses the shell launcher, but needs WSL with Node and nvm inside, and how Kiro handles the path is unverified.

**Other Windows problems, separate from the launcher**
- **Line endings.** There is no `.gitattributes`, and Git for Windows converts files to CRLF by default. A CRLF `mcp-launch.sh` breaks under `sh` (WSL, Git Bash). The lint tests strip `\r` and would not notice. Adding `*.sh text eol=lf` to a new `.gitattributes` is a one-line fix that helps every platform.
- **`pnpm test:models`** uses `RUN_MODEL_TESTS=1 vitest ...`, which does not work in cmd or PowerShell. It needs a cross-platform env tool, or a note to use WSL.
- **Lint tests (done).** `mcp-security.test.ts` now requires `command` to be `node` with the app's `mcp-launch.cjs`.
- **Image paths.** The decoder uses `node:path`, which handles drive letters. Case differences, 8.3 short names and UNC paths are untested.

**Not verified (needs a Windows machine)**
- Whether Kiro on Windows runs MCP servers from the workspace root (the `sh apps/...` entries on macOS rely on that).
- Whether `sh` is on Kiro's PATH on a typical Windows install.
- Whether the tests and the apps run at all.

**Suggested plan**
1. Add `.gitattributes` with `*.sh text eol=lf`.
2. Document option 1 as the Windows block, and add a Windows variant of the agent template.
3. Let the lint tests accept both launch forms.
4. Add a `windows-latest` CI job that installs the repo, starts a server with the Windows entry, and lists its tools. That job is the only way to know it works.
