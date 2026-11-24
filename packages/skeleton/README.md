# @skeleton-playground/core

A small TypeScript kit for AI-integrated object detection apps. It gives you:

- a **detection core** with a swappable model adapter (COCO-SSD for objects with boxes, MobileNet for whole-image food labels), running on-device with TensorFlow.js;
- a **safe image loader** for Node that only reads JPEG and PNG files from a folder you choose;
- an **MCP server kit** (Model Context Protocol, over stdio) that comes with `detect_objects` and `count_objects` and lets you add your own tools, so an agent such as Kiro can call your app;
- copy-in **templates** for a Kiro agent, an app-generator agent that scaffolds a project, an MCP launcher script and a read-only security reviewer agent.

It knows nothing about any one app. It was built for the Kiroween hackathon, with two example apps in the [repository](https://github.com/dignat/kiroween-skeleton-crew).

## Install

```bash
pnpm add --save-exact @skeleton-playground/core
```

That installs the MCP server kit and the image loader only (about 17 MB). The detection models need TensorFlow.js, which is an **optional peer dependency** (about 265 MB), so install what you use:

```bash
# COCO-SSD: objects with bounding boxes
pnpm add --save-exact @tensorflow/tfjs @tensorflow-models/coco-ssd
# MobileNet: whole-image food labels
pnpm add --save-exact @tensorflow/tfjs @tensorflow-models/mobilenet
```

If one is missing, the adapter's `load()` throws an error that names the package and the command to install it. Apps that use their own adapter never need TensorFlow.js.

Needs Node 22.12 or newer. The package is ESM only and ships compiled JavaScript with type declarations, so you do not need `tsx` to use it.

**Good to know before you install**
- Model weights are **downloaded the first time a model loads**, from `storage.googleapis.com` (COCO-SSD) and `tfhub.dev` (MobileNet). The first run needs internet access. The weights are not bundled, pinned or hash-checked.
- To work offline or pin a copy, host the model files yourself and pass `modelUrl` (the URL of a `model.json`) to `createCocoSsdAdapter` or `createMobileNetFoodAdapter`. Download the files once from the publisher, put them on your own server or CDN, and use an `http(s)` URL.
- The package itself is plain Node and has not been tested on Windows. The Node launcher template is the cross-platform default; only the fallback shell launcher template is POSIX-only.
- Detection runs on TensorFlow.js's pure JavaScript backend by default, about 5 seconds per image on a laptop for COCO-SSD. `@tensorflow/tfjs-node` is a faster optional backend you can install yourself.

## Quick start: an MCP server with one tool

Install the core package and the COCO-SSD packages from the commands above. Put a few JPEG or PNG files in an `images/` folder next to this file, as `server.mjs`:

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

Tool paths are relative to the `images/` folder: call the tools with `imagePath: "cat.jpg"`, not `"images/cat.jpg"`. Absolute paths work only if they point inside that folder.

Run it with `node server.mjs`. It waits for an MCP client on stdin and stdout. To connect Kiro, add it to `.kiro/settings/mcp.json`:

```json
{ "mcpServers": { "my-app": { "command": "node", "args": ["server.mjs"] } } }
```

Kiro starts servers with whatever `node` is first on its PATH, which may be too old. If you use nvm and see "Connection closed", use the Node launcher template below (`mcp-launch.template.cjs`, run as `node mcp-launch.cjs`) instead of calling your server directly. It works on macOS, Linux and Windows, needs only some `node` on Kiro's PATH, finds the `.nvmrc` version and prints a clear error if there is none. It has been tested on macOS only. If Kiro has no `node` on its PATH at all, use the shell launcher template (`mcp-launch.template.sh`, run with `sh`). It loads nvm itself, but it is a POSIX shell script, so it works on macOS, Linux and WSL and **not on plain Windows** (no `sh`, no `nvm.sh`).

## Entry points

| Import | What it is |
|---|---|
| `@skeleton-playground/core` | Browser-safe. Imports no Node modules, so a web app can bundle it. Detection core, `createDetector`, `createCocoSsdAdapter`, `createMobileNetFoodAdapter`, `countByLabel`, `filterByConfidence`, the `Detection`, `Detector` and `ModelAdapter` types. |
| `@skeleton-playground/core/node` | Node only. `createNodeImageDecoder`, `createAppServer`, `defineTool`, `serveApp`, `createSkeletonServer`, `registerTool`, `serveOverStdio`, `jsonResult`, `textResult`, `errorResult`, and the `z` (Zod) used by the kit. |

The adapters take an **image decoder** as a parameter, because decoding differs between environments. In Node use `createNodeImageDecoder`. In a browser, write a decoder that draws the image on a canvas and returns its pixels.

## Bring your own model

The `Detector` only talks to a small `ModelAdapter` interface, so any model can sit behind it: another TensorFlow.js model, ONNX, or a remote service.

```ts
interface ModelAdapter {
  readonly name: string; // short name for logs and errors
  readonly defaultMinConfidence: number; // used when the caller passes no minConfidence
  load(): Promise<void>; // load weights; the Detector calls it once and reuses the result
  infer(image: DetectorImageInput): Promise<Detection[]>; // run the model on one image
}
```

`infer` returns `Detection[]`: `{ label, confidence }`, plus an optional `box` (`{ x, y, width, height }`) for models that locate objects. The `Detector` applies the confidence filter, so the adapter returns raw results.

```ts
import { createDetector, type Detection, type ImageDecoder, type ModelAdapter } from '@skeleton-playground/core';

export function createMyAdapter(options: { decodeImage: ImageDecoder }): ModelAdapter {
  let model: MyModel | undefined; // your runtime's model type
  return {
    name: 'my-model',
    defaultMinConfidence: 0.5,
    async load() {
      model = await loadMyModel(); // for example an ONNX session
    },
    async infer(image) {
      const pixels = await options.decodeImage(image); // decode through the decoder, never with fs
      const raw = await model!.run(pixels);
      return raw.map((r): Detection => ({ label: r.className, confidence: r.score, box: r.box }));
    },
  };
}

const detector = createDetector(createMyAdapter({ decodeImage }));
```

Pass `detector` to `createAppServer` as in the quick start. `detect_objects`, `count_objects` and your own tools then use your model with no other change.

- Add your model's runtime as a dependency of your app (`pnpm add --save-exact ...`). TensorFlow.js is only needed by the two built-in adapters.
- Keep the adapter in your own app, not in this package.
- In a web app, the adapter must stay browser-safe: import only from `@skeleton-playground/core`, never `/node` or Node modules.
- Apps created by the `app-generator` agent start with COCO-SSD or MobileNet. To switch, replace the adapter in the app's `createDetector(...)` call.
- If your model has the same input and output format as COCO-SSD or MobileNet, you may not need an adapter: pass your own weights with `modelUrl`.

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
| `app-generator.template.json` | A Kiro dev agent that scaffolds a new MCP server project in your current folder: `package.json`, `tsconfig.json`, `src/mcp-server.ts` with one tool, both launchers and a Kiro agent for the app. Copy to `.kiro/agents/app-generator.json`, then see "Scaffold a project with the app-generator agent" below. |
| `mcp-launch.template.cjs` | The default, cross-platform Node launcher (CommonJS, so it starts even on an old Node). Copy to `mcp-launch.cjs`, replace `{{APP_DISPLAY_NAME}}` and register it as `{ "command": "node", "args": ["mcp-launch.cjs"] }`. It reads the version from `.nvmrc`, looks for a matching install in the nvm folders when the default `node` is too old, and otherwise prints a clear error to stderr. It needs some `node` on Kiro's PATH. Tested on macOS only. |
| `mcp-launch.template.sh` | The fallback POSIX launcher (macOS, Linux, WSL; not plain Windows) for when Kiro has no `node` on its PATH. It selects the Node version from your `.nvmrc` through nvm, then starts your server. Copy to `mcp-launch.sh` and replace `{{APP_DISPLAY_NAME}}`. Its last line runs `node --import tsx src/mcp-server.ts`; change it to your server file, for example `node server.mjs`. |
| `security-reviewer.template.json` | A read-only Kiro agent (no shell, no write tools) that reviews an MCP server project for file access, permission and prompt-injection problems and reports findings in chat. Copy to `.kiro/agents/security-reviewer.json`. It treats everything it reads as data, not instructions. |

### Scaffold a project with the app-generator agent

Kiro does not start this agent by itself. You copy it in and select it:

```bash
mkdir -p .kiro/agents
cp node_modules/@skeleton-playground/core/agent-template/app-generator.template.json .kiro/agents/app-generator.json
```

Open the project folder in Kiro and select the `app-generator` agent (in the IDE, pick it in the agent list; in kiro-cli, run `kiro-cli --agent app-generator` or `/agent` in a chat). It asks for three things: the app name, one tool name with a sentence on what it does, and the detector (`coco-ssd` or `mobilenet`). It then writes the project files, installs the TensorFlow.js packages with exact versions, runs the typecheck and tests, and prints the `.kiro/settings/mcp.json` block for you to paste, because it cannot write that file. It never overwrites an existing file, commits, or edits `node_modules`. Afterwards, switch to the `security-reviewer` agent and ask it to review the project.

## Rules to know

- **Tool names are snake_case** (lower-case letters, digits, underscores, starting with a letter). `registerTool` rejects anything else, and rejects a name that is already registered.
- **Build input schemas with the `z` exported from `@skeleton-playground/core/node`**, so your app and the kit use the same Zod version. Keep them plain (no `.transform()` or `.default()`).
- **stdout belongs to the protocol.** Log with `console.error` in your own code.
- **The food classifier is best-effort.** `createMobileNetFoodAdapter` uses ImageNet labels, which lack tomato, onion, carrot, garlic and avocado. Treat its output as suggestions.
- **Model download behind a proxy:** if loading a model fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, run Node with `--use-system-ca` (for example `NODE_OPTIONS=--use-system-ca`).

## More

- [Changelog](./CHANGELOG.md)
- [Security policy](https://github.com/dignat/kiroween-skeleton-crew/blob/main/SECURITY.md): how to report a problem, and the package's known limits.

## License

MIT. Third-party licenses of the dependencies (Apache-2.0, MIT, BSD, ISC) apply to their own code. The COCO-SSD and MobileNet model weights are downloaded from their publishers and are not covered by this license.
