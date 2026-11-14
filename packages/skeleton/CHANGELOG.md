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
- `agent-template/`: a Kiro app agent template, an MCP launcher template and a read-only security reviewer agent.
- Two entry points: `@skeleton-playground/core` (browser-safe) and `@skeleton-playground/core/node`.

### Notes
- TensorFlow.js (`@tensorflow/tfjs`) and the model packages are **optional peer dependencies**. Install the ones you use. An adapter's `load()` throws a clear error if one is missing.
- Model weights are downloaded the first time a model loads.
- ESM only. Needs Node 22.12 or newer.
- The launcher template is a POSIX shell script (macOS, Linux, WSL). There is no Windows launcher yet, and nothing has been tested on Windows.
