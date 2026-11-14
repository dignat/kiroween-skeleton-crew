# Developing the skeleton (monorepo guide)
**Platform:** the MCP launchers and the Kiro entries use `sh`, so work on this repo with Kiro on macOS, Linux or WSL. Plain Windows is not supported yet. Supporting it would need a `.cmd` launcher template, the lint tests accepting both launcher forms, and a `windows-latest` CI job that starts a server through it.

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

4. **Add the launcher and register the server with Kiro.** Copy `agent-template/mcp-launch.template.sh` to `apps/my-app/mcp-launch.sh` and replace only `{{APP_DISPLAY_NAME}}`. Kiro starts servers with whatever Node is the default, and the launcher selects the project's Node. In the server, set the allowed image folder from the file's own location, not the working directory: `process.env.MCP_IMAGES_DIR ?? fileURLToPath(new URL('../../../samples', import.meta.url))`. Tests (`src/tests/unit/mcp-launcher.test.ts` and `mcp-security.test.ts`) fail if a launcher differs from the template, a server uses `process.cwd()`, an app imports `fs`, `child_process` or network modules, or an agent gets wildcard or non-app tools. Then register it in `.kiro/settings/mcp.json`:

   ```json
   { "mcpServers": { "my-app": { "command": "sh", "args": ["apps/my-app/mcp-launch.sh"] } } }
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
Publishing needs an npm login for an account in the `skeleton-playground` npm organization (the `@skeleton-playground` scope). Check the tarball contents before the first real publish: no tests, fixtures or spike files should be in it.

Release checklist: update `version` in `package.json`, add a matching `## <version>` section to `CHANGELOG.md` (a test fails without it), run `pnpm test`, then publish. For a build with npm provenance, push a tag named `core-v<version>` (or run the workflow by hand): `.github/workflows/publish-core.yml` tests, then publishes with `--provenance`. It needs an `NPM_TOKEN` repository secret (an npm automation token). Publishing by hand from your machine also works but has no provenance.

## Tests

`pnpm test` from the repo root runs everything offline. The tests that load the real models are skipped unless you set `RUN_MODEL_TESTS=1`.
