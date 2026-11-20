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

## Tuning detections
`detector.detect(image, options)` applies these filters in order. Every option is optional and off by default, and the MCP tools `detect_objects` and `count_objects` accept the same fields.

| Option | What it does |
| --- | --- |
| `minConfidence` | One confidence threshold for every label. Default is the adapter's `defaultMinConfidence` (0.5 for COCO-SSD, 0.1 for MobileNet). |
| `minConfidenceByLabel` | `{ apple: 0.2 }`. A listed label uses its own threshold. Other labels use `minConfidence`. |
| `boxLimitsByLabel` | `{ cup: { minArea, maxArea, minAspectRatio, maxAspectRatio, minAreaFraction, maxAreaFraction } }`. Drops boxes that are implausibly small, large or oddly shaped for their label. Areas are in pixels. The fraction fields are relative to the image and need the adapter to report the image size (COCO-SSD does). Detections without a box are kept. |
| `contextRules` | `[{ label: 'boat', dropWhenPresent: ['oven', 'sink'] }]`. Drops a label based on which other labels are in the same image. `keepOnlyWhenPresent` and `evidenceMinConfidence` are also available. Every rule is checked against the same list, so rule order does not matter. |
| `iouThreshold`, `nmsAcrossLabels` | Non-maximum suppression. Drops a box whose IoU with a more confident kept box is at or above `iouThreshold`. Only boxes with the same label compete unless `nmsAcrossLabels` is true. Detections without a box are kept. |

The pure functions behind them (`filterByConfidence`, `filterByBoxLimits`, `filterByContext`, `nonMaxSuppression`, `iou`) are exported too. A custom adapter that returns boxes should set `meta.imageSize` in `infer(image, meta)` so the fraction limits work. Pixel limits and the other options do not need it.

## Letting an agent review detections
`createReviewKit(detector)` (or `createReviewTools(detector)` for just the tools) gives your server two tools:

- `get_detections` returns the detections as JSON: a `reviewId`, the `imageSize`, and for each detection an `id`, `class`, `score` and `box` (`null` for whole-image classifiers).
- `submit_review` takes one item per detection id, each with a `verdict` (`confirmed`, `rejected` or `uncertain`), `evidence` and `reason`. It checks the review in code: an unknown id, a duplicate, a missing detection or a malformed item returns an error that lists what to fix, and the agent resubmits with the same `reviewId`.

```js
const reviews = createReviewKit(detector);
createAppServer({ name: 'my-app', version: '0.1.0', detector, tools: [...reviews.tools, myTool] });
// In another tool: reviews.getAcceptedReview(reviewId) returns the verdicts, or undefined.
```
Use `getAcceptedReview` to require a review before a tool runs. The kit keeps the last 20 reviews in memory. The prompt that tells the agent to use these tools is yours to write. Nothing forces the agent to call them unless one of your tools checks `getAcceptedReview`.

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
| `mcp-launch.template.cjs` | The default, cross-platform Node launcher (CommonJS, so it starts even on an old Node). Copy to `mcp-launch.cjs`, replace `{{APP_DISPLAY_NAME}}` and register it as `{ "command": "node", "args": ["mcp-launch.cjs"] }`. It reads the version from `.nvmrc`, looks for a matching install in the nvm folders when the default `node` is too old, and otherwise prints a clear error to stderr. It needs some `node` on Kiro's PATH. Tested on macOS only. |
| `mcp-launch.template.sh` | The fallback POSIX launcher (macOS, Linux, WSL; not plain Windows) for when Kiro has no `node` on its PATH. It selects the Node version from your `.nvmrc` through nvm, then starts your server. Copy to `mcp-launch.sh` and replace `{{APP_DISPLAY_NAME}}`. Its last line runs `node --import tsx src/mcp-server.ts`; change it to your server file, for example `node server.mjs`. |
| `security-reviewer.template.json` | A read-only Kiro agent (no shell, no write tools) that reviews an MCP server project for file access, permission and prompt-injection problems and reports findings in chat. Copy to `.kiro/agents/security-reviewer.json`. It treats everything it reads as data, not instructions. |

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
