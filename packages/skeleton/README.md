# @skeleton-playground/core

A small TypeScript kit for AI-integrated object detection apps. It gives you:

- a **detection core** with a swappable model adapter (COCO-SSD for objects with boxes, MobileNet for whole-image food labels), running on-device with TensorFlow.js;
- a **safe image loader** for Node that only reads JPEG and PNG files from a folder you choose;
- an **MCP server kit** (Model Context Protocol, over stdio) that comes with `detect_objects` and `count_objects` and lets you add your own tools, so an agent such as Kiro can call your app;
- copy-in **templates** for a Kiro agent, an MCP launcher script and a read-only security reviewer agent.

It knows nothing about any one app. It was built for the Kiroween hackathon, with two example apps in the [repository](https://github.com/dignat/kiroween-skeleton-crew).

## Install

```bash
pnpm add --save-exact @skeleton-playground/core
```

Needs Node 22.12 or newer. The package is ESM only and ships compiled JavaScript with type declarations, so you do not need `tsx` to use it.

**Good to know before you install**
- The install is large (about 280 MB, 76 packages) because it includes TensorFlow.js and both model adapters.
- Model weights are **downloaded the first time a model loads**, from `storage.googleapis.com` (COCO-SSD) and `tfhub.dev` (MobileNet). The first run needs internet access. The weights are not bundled, pinned or hash-checked.
- Detection runs on TensorFlow.js's pure JavaScript backend by default, about 5 seconds per image on a laptop for COCO-SSD. `@tensorflow/tfjs-node` is a faster optional backend you can install yourself.

## Quick start: an MCP server with one tool

Put a few JPEG or PNG files in an `images/` folder next to this file, as `server.mjs`:

```js
import { fileURLToPath } from 'node:url';
import { createCocoSsdAdapter, createDetector } from '@skeleton-playground/core';
import { createAppServer, createNodeImageDecoder, defineTool, jsonResult, serveApp, z } from '@skeleton-playground/core/node';

// The ONLY folder the server may read images from. Required, and no default.
const IMAGES_DIR = process.env.MY_IMAGES_DIR ?? fileURLToPath(new URL('./images', import.meta.url));

function createServer() {
  const decodeImage = createNodeImageDecoder({ allowedRoot: IMAGES_DIR });
  const detector = createDetector(createCocoSsdAdapter({ decodeImage }));
  return createAppServer({
    name: 'my-app',
    version: '0.1.0',
    detector, // adds detect_objects and count_objects
    tools: [
      defineTool({
        name: 'has_object', // snake_case
        description: 'Say whether an image contains a given object label, for example "cat".',
        inputSchema: z.object({ imagePath: z.string(), label: z.string() }),
        handler: async ({ imagePath, label }) => {
          const detections = await detector.detect({ kind: 'filePath', path: imagePath });
          return jsonResult({ label, found: detections.some((d) => d.label === label) });
        },
      }),
    ],
  });
}

serveApp('my-app', createServer); // serves over stdio
```

Run it with `node server.mjs`. It waits for an MCP client on stdin and stdout. To connect Kiro, add it to `.kiro/settings/mcp.json`:

```json
{ "mcpServers": { "my-app": { "command": "node", "args": ["server.mjs"] } } }
```

Kiro starts servers with whatever `node` is first on its PATH, which may be too old. If you use nvm and see "Connection closed", use the launcher template below instead of calling `node` directly.

## Entry points

| Import | What it is |
|---|---|
| `@skeleton-playground/core` | Browser-safe. Imports no Node modules, so a web app can bundle it. Detection core, `createDetector`, `createCocoSsdAdapter`, `createMobileNetFoodAdapter`, `countByLabel`, `filterByConfidence`, the `Detection` and `Detector` types. |
| `@skeleton-playground/core/node` | Node only. `createNodeImageDecoder`, `createAppServer`, `defineTool`, `serveApp`, `createSkeletonServer`, `registerTool`, `serveOverStdio`, `jsonResult`, `textResult`, `errorResult`, and the `z` (Zod) used by the kit. |

The adapters take an **image decoder** as a parameter, because decoding differs between environments. In Node use `createNodeImageDecoder`. In a browser, write a decoder that draws the image on a canvas and returns its pixels.

## Security: what the kit does, and what stays your job

A model chooses the file paths in MCP tool calls, so file access is the main risk.

**The kit does**
- `createNodeImageDecoder` **requires** an `allowedRoot` folder. Paths are resolved with symlinks followed, and anything outside that folder is refused.
- Only `.jpg`, `.jpeg` and `.png` are read, and the format is checked from the file's first bytes, not its name.
- Size limits apply: 25 MB per file, 50 megapixels per image, and a cap on base64 input.
- A tool handler that throws becomes an error result, and the server keeps running.
- The server writes only to stdout in the protocol format. `console.log` is redirected to stderr.

**Your job**
- Never read a path that came from a tool input with `fs` directly. Pass it through the decoder (as `detector.detect` does), including to get an image's size.
- Keep `allowedRoot` narrow, for example one `images/` folder, never your home folder or project root.
- Keep input schemas strict, and keep launch commands free of secrets.
- Treat text that comes back from a tool, such as image labels or file names, as untrusted input to the model.

These are guardrails, not a guarantee. Review your own tools. The `agent-template/security-reviewer.template.json` agent below can help.

## Templates you can copy

The package ships `agent-template/`. Nothing is imported from it; copy what you need into your project. After install it is at `node_modules/@skeleton-playground/core/agent-template/`.

| File | Use |
|---|---|
| `app-agent.template.json` | A Kiro agent for your app. Copy to `.kiro/agents/<name>.json` and fill in every `{{PLACEHOLDER}}`. It can use only your app's own MCP tools. |
| `mcp-launch.template.sh` | A POSIX launcher that selects the Node version from your `.nvmrc` through nvm, then starts your server. Copy to `mcp-launch.sh` and replace `{{APP_DISPLAY_NAME}}`. Its last line runs `node --import tsx src/mcp-server.ts`; change it to your server file, for example `node server.mjs`. |
| `security-reviewer.template.json` | A read-only Kiro agent (no shell, no write tools) that reviews an MCP server project for file access, permission and prompt-injection problems and reports findings in chat. Copy to `.kiro/agents/security-reviewer.json`. It treats everything it reads as data, not instructions. |

## Rules to know

- **Tool names are snake_case** (lower-case letters, digits, underscores, starting with a letter). `registerTool` rejects anything else, and rejects a name that is already registered.
- **Build input schemas with the `z` exported from `@skeleton-playground/core/node`**, so your app and the kit use the same Zod version. Keep them plain (no `.transform()` or `.default()`).
- **stdout belongs to the protocol.** Log with `console.error` in your own code.
- **The food classifier is best-effort.** `createMobileNetFoodAdapter` uses ImageNet labels, which lack tomato, onion, carrot, garlic and avocado. Treat its output as suggestions.
- **Model download behind a proxy:** if loading a model fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, run Node with `--use-system-ca` (for example `NODE_OPTIONS=--use-system-ca`).

## License

MIT. Third-party licenses of the dependencies (Apache-2.0, MIT, BSD, ISC) apply to their own code. The COCO-SSD and MobileNet model weights are downloaded from their publishers and are not covered by this license.
