The Skeleton Crew Anything You Can Do

A reusable **object-detection skeleton** with a built-in **MCP server kit**, and **two apps built on it** — a spooky CLI and a Halloween-themed web app. Kiroween Hackathon 2026, *Skeleton Crew* category.

One template. Two very different apps. Every app's CLI/UI and its Kiro agent share the same code.

- 🔮 **The Witch's Pantry** — a web app: photograph your ingredients and it suggests recipes, themed as potions, with a playful "Curse Level", dietary filters, and a food-relevance guard.
- 👻 **The Poltergeist Detector** — a CLI: compare two photos of the same place and it reports what *appeared, vanished, or moved*.
- 🧩 **`@skeleton-playground/core`** — the shared skeleton: a pluggable detector abstraction and an MCP server kit both apps are built from.

**Live web app:** https://dignat.github.io/kiroween-skeleton-crew/

## Try it in 2 minutes (for judges)

**Witch's Pantry:** open the live link above. No install.

**Poltergeist Detector (CLI):** needs Node 22 and pnpm.

```bash
nvm use && pnpm install
pnpm demo:poltergeist
```

This compares a bundled before/after pair from `samples/`, prints the haunting report, and writes `demo-output/haunting-report.png`: the two photos side by side with the findings boxed (green = appeared, red = vanished, amber = moved, blue = unchanged). The first run downloads the COCO-SSD model. The CLI is a general tool: add `--out report.png` to any `compare` command to get the same image for your own photos.

**Through Kiro (the AI layer of both apps):** open this folder in Kiro, reload the window so it picks up `.kiro/settings/mcp.json`, then switch agent and paste a prompt.

| Agent | Prompt to paste |
| --- | --- |
| `poltergeist-detector` | `Compare samples/before_tomatoes.jpg and samples/after_tomatoes.jpg and tell me what the poltergeist did.` |
| `witches-pantry` | `Check samples/fridge-salad-drawer.jpg is food, then suggest potions I can brew from what you can see.` |
| `app-generator` | `Create a cli app called shelf-scanner with one tool list_shelf.` (or `web`, or `mcp-only`) |

The detector is a small on-device model, so results on casual photos can flicker. A lone "appeared" or "vanished" is a hint, and "moved" is the most trustworthy finding. Large, clearly separated objects (cup, bottle, book, laptop) photographed from the same spot work best.

> Detection runs entirely on-device with TensorFlow.js — no paid services, no API keys. Kiro is the only AI layer: custom agents call each app's own MCP tools.

---

## What's in the box

```
packages/skeleton/          @skeleton-playground/core — detector abstraction + MCP server kit
apps/poltergeist-detector/  CLI: before/after scene comparison
apps/witches-pantry/        web app: food detection + recipe "potions"
samples/                    sample images (original, no copyrighted material)
.kiro/                      specs, steering, hooks, agents, MCP settings (all committed)
```

### The skeleton (`@skeleton-playground/core`)

- A `Detector` with a swappable `ModelAdapter`, so an app picks a model without touching the interface. Two adapters ship: `createCocoSsdAdapter` (80 COCO classes, with bounding boxes) and `createMobileNetFoodAdapter` (whole-image food classification, filtered to an app-supplied allowlist).
- A browser-safe entry point (`@skeleton-playground/core`) and a Node-only entry point (`@skeleton-playground/core/node`), enforced by a build test so the browser bundle never pulls in Node modules.
- An **MCP server kit**: `createSkeletonServer` (pre-wired with `detect_objects` and `count_objects`), `registerTool` (snake_case names, duplicate-name rejection, Zod validation, errors become results not crashes), and a stdio helper that keeps stdout clean for the protocol.
- The model loads once per detector and is reused.

### 👻 Poltergeist Detector (CLI)

Compare two photos taken from the same spot and get a "haunting report".

- `compare_scenes` matches detections per label by normalized box-centre distance, and reports **appeared / vanished / moved / unchanged**.
- CLI flags: `--json`, `--min-confidence`, `--tolerance`, `--help`.
- A `list_labels` tool lists the 80 object classes the detector knows.
- Honest about its model: COCO-SSD labels flicker between near-identical frames, so a lone appeared/vanished is treated with suspicion and only a matched "moved" is trusted (see the Spike E note in the spec).

### 🔮 The Witch's Pantry (web app)

Drop in a photo of what you have and brew a recipe.

- On-device food detection (MobileNet v2) **pre-fills** an editable ingredient list — detection is a best-effort helper, the chips are the primary input, so the app works even when detection is weak.
- `suggest_recipes` matches 27 original potion recipes by ingredient, showing what you have and what you still need.
- **Curse Level & Potion Purity** — a playful per-serving nutrition score (0–100) from a local USDA-based nutrition table, with a "Best match / Purest first" sort.
- **Dietary filters** (a choice, not advice) — vegetarian, lower sugar, lower sodium, higher fibre, higher protein, lighter.
- **Food-relevance guard** — a `check_image` tool (and a UI gate) that declines non-food images. This is a relevance check, *not* content moderation.
- Accessible: semantic HTML, keyboard support, `aria-live` status, visible focus, and meters readable without relying on colour.

> The nutrition, dietary, and curse-level features are a **playful guide, not medical or dietary advice.**

---

## Requirements

- **Node 22** (pinned in `.nvmrc` to `22.23.0`; `engines.node >= 22.12.0`)
- **pnpm 10** (pinned to `10.34.9` via `packageManager`)

If you use [nvm](https://github.com/nvm-sh/nvm): `nvm use` picks the right Node. If you don't use nvm, make sure Node 22 is the default `node` on your PATH — Kiro and the MCP launchers spawn `node` from the environment, and an older Node will fail.

## Setup

```bash
nvm use            # selects Node 22.23.0 from .nvmrc
pnpm install       # installs the workspace (no native build step, no API keys)
pnpm typecheck     # type-checks every package
pnpm test          # runs the full test suite (Vitest + fast-check)
```

## Run the Witch's Pantry (web app)

```bash
pnpm --filter witches-pantry dev      # dev server at http://localhost:5173/
pnpm --filter witches-pantry build    # static build into apps/witches-pantry/dist
pnpm --filter witches-pantry preview  # preview the production build
```

Or just open the deployed app: **https://dignat.github.io/kiroween-skeleton-crew/**
First use downloads the ~14 MB MobileNet model in the browser; after that it's cached.

## Run the Poltergeist Detector (CLI)

Run from the **repo root** on Node 22. The CLI reads image paths relative to the
current directory, and only from inside it, so run it from the repo root and
pass repo-root-relative paths (e.g. `samples/...`):

```bash
node --import tsx apps/poltergeist-detector/src/cli.ts compare <before.jpg> <after.jpg> [options]

# examples
node --import tsx apps/poltergeist-detector/src/cli.ts compare samples/before_tomatoes.jpg samples/after_tomatoes.jpg
node --import tsx apps/poltergeist-detector/src/cli.ts compare samples/before_tomatoes.jpg samples/after_tomatoes.jpg --json --tolerance 0.08
```

Take both photos from the same spot, with objects large and clearly separated (the detector only knows the 80 COCO classes). `--help` shows all options. A missing or unsupported photo exits with code 1 and names the photo.

## Kiro: agents + MCP

Kiro is the AI layer — custom agents in `.kiro/agents/` call each app's own MCP server (`.kiro/settings/mcp.json`). After cloning, reload the Kiro window so it picks up the servers, then select an app agent:

- **witches-pantry** — the kitchen-witch agent: `check_image`, `detect_objects`, `count_objects`, `suggest_recipes`.
- **poltergeist-detector** — the ghost-hunter agent: `detect_objects`, `count_objects`, `compare_scenes`, `list_labels`.
- **tool-builder** / **app-generator** — developer agents that scaffold a new MCP tool, or a whole new app from the skeleton, following the project's steering rules.
- **security-reviewer** — a read-only reviewer (`fs_read`, `grep`, `glob`, no shell or write access). It traces model-chosen file paths, agent permissions, launchers and prompt-injection surfaces, then reports findings in chat. It treats everything it reads as data, not instructions. Try: `Review apps/witches-pantry for security.` Its template lives in `packages/skeleton/agent-template/security-reviewer.template.json`.

The skeleton package is ready for npm (`@skeleton-playground/core`, compiled to `dist/` on pack, entry points `.` and `./node`). See `packages/skeleton/README.md` for install and publishing steps. It has not been published.

Each MCP server runs through a small per-app launcher (`apps/<app>/mcp-launch.sh`) that selects the project's Node via nvm, so it works regardless of the default Node that Kiro spawns with. The launcher runs from the app's own folder, and the MCP servers read images only from `samples/` (set `MCP_IMAGES_DIR` to use another folder). The launcher comes from `packages/skeleton/agent-template/mcp-launch.template.sh`, and tests fail if an app's launcher differs from it or its server uses `process.cwd()`. A security lint test (`packages/skeleton/src/tests/unit/mcp-security.test.ts`) also checks every agent, `mcp.json` entry, launcher and app source file for known-bad patterns such as wildcard tool permissions, `fs` or network imports, download or `eval` commands, and hidden or prompt-override text. It is a pattern check, not a proof of safety.

### Building a new app with `app-generator`

The skeleton is used **from inside this repo** — it's a workspace package (`@skeleton-playground/core`, linked via `workspace:*`), not something published to npm. So a developer clones this repo and grows new detection apps within it:

1. Clone the repo, run `nvm use` (Node 22) and `pnpm install` at the root.
2. Open it in Kiro and switch to the **app-generator** agent.
3. Tell it the new app's **name**, its one **MCP tool** (snake_case) and its **interface**: `mcp-only`, `cli` (like the Poltergeist Detector) or `web` (like the Witch's Pantry). For example, "create a `cli` app called `shelf-scanner` with one tool `list_shelf`". If you leave the interface out, it asks. You don't give it a path; it writes `apps/<name>/` and `.kiro/agents/<name>.json` by convention.
4. It scaffolds the whole app (package.json, tsconfig, logic + test, `mcp-server.ts` using the skeleton's `createAppServer`/`defineTool`/`serveApp`, the nvm launcher, and the App_Agent, plus the CLI files or the Vite web UI if you chose one), runs install + typecheck + tests (and a build for `web`), and prints the `.kiro/settings/mcp.json` block for you to paste (it's intentionally not allowed to edit that file itself).

The generated app depends on the skeleton through `workspace:*` and never modifies `packages/` — new apps live entirely under `apps/`.

## Testing

- `pnpm test` — unit and **property-based** tests (`fast-check`), run offline with fake adapters.
- `pnpm test:models` — opt-in integration tests that load the real models (`RUN_MODEL_TESTS=1`).

## Credits & licenses

- **Code:** MIT (see `LICENSE`).
- **Detection models:** [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) and [MobileNet](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet) via [TensorFlow.js](https://www.tensorflow.org/js) (Apache-2.0).
- **Nutrition data:** derived from the U.S. Department of Agriculture, Agricultural Research Service, FoodData Central — https://fdc.nal.usda.gov/ (public domain, CC0 1.0).
- **Recipes & sample images:** original to this project. No third-party trademarks or copyrighted material.

## Project notes

Built spec-first: requirements, design, and tasks live in `.kiro/specs/skeleton-crew/`, and `KIRO_USAGE.md` records how Kiro was used (agents, hooks, steering, MCP, property tests, and the debugging stories behind them).

### Known limitations / future work

- Food detection uses general-purpose MobileNet v2, which misses many raw ingredients — the editable chips cover the gap. A fruit/vegetable-specialized model (36+ classes) is noted as future work.
- `check_image` is a food-relevance gate, not content moderation; true safety moderation would need a dedicated service.
