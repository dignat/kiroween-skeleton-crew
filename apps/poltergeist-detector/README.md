# 👻 Poltergeist Detector

A CLI that compares two photos of the same place and reports what a poltergeist **moved, took, or left behind**. Part of [The Skeleton Crew Anything You Can Do](../../README.md), built on `@skeleton-crew/core`.

Point it at a "before" and an "after" photo taken from the same spot, and it prints a haunting report: what **appeared**, what **vanished**, what **moved**, and what stayed put.

## How it works

- Runs COCO-SSD (80 object classes, with bounding boxes) on both photos via TensorFlow.js — on-device, no API key.
- `compareScenes` matches detections per label by normalized box-centre distance: a small drift is "unchanged", a larger drift is "moved", and unmatched detections are "appeared" (after only) or "vanished" (before only).
- The same `compareScenes` logic backs both the CLI and the `compare_scenes` MCP tool, so results match in the terminal and in Kiro.

> Honest caveat: COCO-SSD knows only 80 classes and its labels flicker between near-identical frames, so a lone "appeared"/"vanished" is unreliable — only a matched "moved" is trustworthy. Take both photos from the same spot with objects large and clearly separated.

## Requirements

- Node 22 (repo `.nvmrc` = `22.23.0`) and pnpm 10. Run `nvm use` at the repo root, then `pnpm install`.

## Run it

Run from the **repo root** on Node 22. The CLI reads image paths relative to the
current directory (and only from inside it), so run it from the repo root and
pass repo-root-relative paths such as `samples/...`:

```bash
node --import tsx apps/poltergeist-detector/src/cli.ts compare <before> <after> [options]
```

Examples:

```bash
node --import tsx apps/poltergeist-detector/src/cli.ts compare samples/before_tomatoes.jpg samples/after_tomatoes.jpg
node --import tsx apps/poltergeist-detector/src/cli.ts compare samples/before_tomatoes.jpg samples/after_tomatoes.jpg --json
node --import tsx apps/poltergeist-detector/src/cli.ts compare samples/before_apple.jpg samples/after_apple.jpg --tolerance 0.08 --min-confidence 0.6
```

Options:

| Flag | Meaning |
|---|---|
| `--json` | Print the result as JSON instead of the report. |
| `--min-confidence <0..1>` | Ignore detections below this confidence (default 0.5). |
| `--tolerance <0..1>` | Max normalized centre drift still counted as "unchanged" (default 0.05). |
| `--help` | Show usage. |

- Results go to **stdout**, progress to **stderr**.
- A missing, unsupported, or unreadable photo prints a message naming that photo and exits with code **1**.
- If neither photo has any detection, it says so instead of printing an empty report.

### Global command (optional)

```bash
pnpm --filter poltergeist-detector exec pnpm link --global
poltergeist-detector compare <before> <after>
```

## MCP server (for Kiro)

The app also runs as an MCP server exposing `compare_scenes`, `list_labels`, and the built-in `detect_objects` / `count_objects`:

```bash
pnpm --filter poltergeist-detector mcp     # serve over stdio
```

It's registered in `.kiro/settings/mcp.json` and driven by the `poltergeist-detector` Kiro agent (a wry ghost-hunter persona scoped to just this app's tools). The server launches through `mcp-launch.sh`, which selects the project's Node via nvm. The server reads images only from the repo's `samples/` folder (override with `MCP_IMAGES_DIR`), so MCP image paths are relative to `samples/`, for example `before_apple.jpg`. The CLI is different: it reads from the current directory, as described above.

## Tests

Run from the repo root: `pnpm test` (the Poltergeist logic has unit and property-based tests — e.g. every detection is reported in exactly one category, and swapping before/after swaps appeared/vanished).

## License

MIT. Detection by [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) / [TensorFlow.js](https://www.tensorflow.org/js) (Apache-2.0). Sample images are original to this project.
