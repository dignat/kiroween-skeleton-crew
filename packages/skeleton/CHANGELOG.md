# Changelog

All notable changes to `@skeleton-playground/core`. The format follows [Keep a Changelog](https://keepachangelog.com/),
and the project uses [Semantic Versioning](https://semver.org/). Versions before 1.0 may change between minor releases.

## 0.1.0 (unreleased)

First release.

### Added
- Detection core: `createDetector`, `Detection`, `Detector`, `ModelAdapter`, `countByLabel`, `filterByConfidence`.
- Model adapters: `createCocoSsdAdapter` (boxes, 80 classes) and `createMobileNetFoodAdapter` (whole-image labels filtered to an allowlist). Both take a `modelUrl` option to load the model from a copy you host.
- `createNodeImageDecoder` for Node: JPEG and PNG only, restricted to a required `allowedRoot` folder, with size, megapixel and base64 limits.
- MCP server kit: `createAppServer`, `createSkeletonServer`, `defineTool`, `registerTool`, `serveApp`, `serveOverStdio`, with `detect_objects` and `count_objects` built in.
- `agent-template/`: a Kiro app agent template, MCP launcher templates (a cross-platform Node launcher, `mcp-launch.template.cjs`, and a POSIX shell fallback) and a read-only security reviewer agent.
- Two entry points: `@skeleton-playground/core` (browser-safe) and `@skeleton-playground/core/node`.

- Detection tuning options on `detect()` and on `detect_objects` / `count_objects`: `minConfidenceByLabel`, `boxLimitsByLabel` (pixel and image-fraction limits), `contextRules`, `iouThreshold` and `nmsAcrossLabels`, with the pure functions `filterByBoxLimits`, `filterByContext`, `nonMaxSuppression` and `iou`.
- `ModelAdapter.infer(image, meta?)`: adapters can report the decoded image size through `meta.imageSize`. `Detector.detectWithInfo()` returns the detections together with that size. COCO-SSD and MobileNet both report it.
- Review tools: `createReviewKit` and `createReviewTools` add `get_detections` and `submit_review`, which validate an agent's `confirmed` / `rejected` / `uncertain` verdicts per detection. `getAcceptedReview` lets an app tool require an accepted review.
### Notes
- TensorFlow.js (`@tensorflow/tfjs`) and the model packages are **optional peer dependencies**. Install the ones you use. An adapter's `load()` throws a clear error if one is missing.
- Model weights are downloaded the first time a model loads.
- ESM only. Needs Node 22.12 or newer.
- The default launcher template is `mcp-launch.template.cjs` (Node, macOS, Linux and Windows). The shell launcher `mcp-launch.template.sh` is a fallback for machines where Kiro has no `node` on its PATH (macOS, Linux, WSL). Both are tested on macOS only; nothing has been tested on Windows.
