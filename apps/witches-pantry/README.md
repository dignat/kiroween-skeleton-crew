# 🔮 The Witch's Pantry

A web app that looks at a photo of your ingredients and suggests recipes — themed as potions. Part of [The Skeleton Crew Anything You Can Do](../../README.md), built on `@skeleton-crew/core`.

**Live app:** https://dignat.github.io/kiroween-skeleton-crew/

Drop in a photo of what you have; on-device detection pre-fills an editable ingredient list; and the cauldron suggests potions you can brew, with a playful "Curse Level", dietary filters, and a food-relevance guard.

## Features

- **On-device food detection** (MobileNet v2 via TensorFlow.js, in the browser) that **pre-fills** ingredient chips. Detection is a best-effort helper — the editable chips and quick-add list are the primary input, so the app works even when detection is weak. Uploading a new image **replaces** the previous image's detections while keeping anything you added by hand, and a header **Start over** button clears the image and all ingredients for a fresh slate.
- **Recipe suggestions** — `suggestRecipes` matches 27 original potion recipes, showing the ingredients you have and the ones you still need, best match first.
- **Curse Level & Potion Purity** — a playful per-serving nutrition score (0–100) from a local USDA-based table, with a "Best match / Purest first" sort and a potion-bottle meter.
- **Dietary filters** (a choice, not advice) — vegetarian, lower sugar, lower sodium, higher fibre, higher protein, lighter.
- **Cauldron Calculator** — a standalone view that tallies the nutrition of any list of ingredients: total and per-serving calories and macros, with a servings control and an optional comparison against **your own** daily targets (shown as a plain percentage — no recommended values are supplied). Ingredients with no data are flagged, never silently dropped. It runs in two modes you pick from a dropdown: **Synced with pantry** (rows mirror your pantry list, names read-only and grams editable, updating live as you edit the pantry) or **Separate list** (a free scratchpad with manual add/remove/edit, independent of the pantry).
- **Food-relevance guard** — declines non-food images (a relevance check, *not* content moderation).
- **Accessible** — semantic HTML, keyboard support, `aria-live` status, visible focus, and meters readable without relying on colour alone.

> The nutrition, curse-level, and dietary features are a **playful guide, not medical or dietary advice.** Dietary filters describe the recipes, not a person.

## Requirements

- Node 22 (repo `.nvmrc` = `22.23.0`) and pnpm 10. Run `nvm use` at the repo root, then `pnpm install`.

## Run it

From the repo root:

```bash
pnpm --filter witches-pantry dev       # dev server at http://localhost:5173/
pnpm --filter witches-pantry build     # static build into dist/
pnpm --filter witches-pantry preview   # preview the production build
```

First use downloads the ~14 MB MobileNet model in the browser (cached afterwards). Everything runs client-side — no backend, no API key.

### Deploying

The app builds to static files and is deployed to GitHub Pages by `.github/workflows/deploy-pantry.yml`. The Vite `base` is derived from the repo name at build time (`VITE_BASE`), so it serves correctly from `https://<user>.github.io/<repo>/`.

## MCP server (for Kiro)

The app runs as an MCP server exposing `suggest_recipes`, `check_image`, `calculate_nutrition`, and the built-in `detect_objects` / `count_objects`:

```bash
pnpm --filter witches-pantry mcp       # (served via mcp-launch.sh in Kiro)
```

It's registered in `.kiro/settings/mcp.json` and driven by the `witches-pantry` Kiro agent (a kitchen-witch persona). The agent calls `check_image` first and politely declines non-food photos. The `suggest_recipes` tool returns per-serving nutrition, Curse Level, purity, and accepts a `sortBy` and `filters` so the agent can match the web UI. The `calculate_nutrition` tool adds up totals and per-serving nutrition for an ingredient list, reporting any ingredients it has no data for, and — when you pass your own daily targets — each amount as a percentage of them (your numbers, not a recommendation).

The web UI and the MCP tools share the exact same recipe, nutrition, filter, and relevance logic — one implementation, two surfaces.

## Tests

Run from the repo root: `pnpm test`. The recipe matching, nutrition/curse-level maths, dietary filters, food-relevance check, and the Cauldron Calculator all have unit and property-based tests (e.g. matched ∪ missing equals the recipe's ingredients, Curse Level stays within 0–100 and is monotonic, a filter only ever removes recipes, calculator totals are never negative and `perServing × servings` equals the total, and a percentage is only ever shown for a target the user actually entered).

## Credits & licenses

- MIT (code). Detection by [MobileNet](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet) / [TensorFlow.js](https://www.tensorflow.org/js) (Apache-2.0).
- Nutrition values derived from USDA FoodData Central — https://fdc.nal.usda.gov/ (public domain, CC0 1.0).
- Recipes and sample images are original to this project.
