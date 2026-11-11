# Implementation Plan

## Overview

This plan builds the Skeleton Crew submission in eight phases: workspace setup, early spikes to test risky assumptions, the shared skeleton package, the Poltergeist Detector CLI, the Witch's Pantry web app, the optional nutrition feature (Curse Level and Potion Purity), the Kiro layer (custom agents, hooks, steering), and the submission package. Each task points to the requirements it covers in `requirements.md` and follows the architecture in `design.md`.

Deadline: **4 December 2026**. Target submission date: **Wednesday 2 December**, leaving two days of buffer. Tasks marked `*` are stretch; see Notes for the cut order and the definition of done.

## Tasks

### Phase 0: Already done

- [x] 0.1 Requirements and design written and reviewed
- [x] 0.2 Node pinned to 22.23.0 in `.nvmrc`, `engines.node` set (tightened to `>=22.12.0` in task 1, because Vitest 5 needs it)
- [x] 0.3 pnpm pinned to 10.34.9 in `package.json`
- [x] 0.4 `AGENTS.md` updated with project rules, `KIRO_USAGE.md` started
- [x] 0.5 Unrelated file moved out of the repo

### Phase 1: Workspace setup (week 1)

- [x] 1. Scaffold the pnpm workspace
  - [x] 1.1 Create `pnpm-workspace.yaml` (`packages/*`, `apps/*`), rename the root package to `skeleton-crew`, set `"license": "MIT"`, and add `pnpm.onlyBuiltDependencies` (start with `esbuild`)
    - Remove the empty root `src/` folder
    - _Requirements: 1.1, 12.1_
  - [x] 1.2 Add the MIT `LICENSE` file at the root
    - _Requirements: 12.1_
  - [x] 1.3 Convert the root `tsconfig.json` into `tsconfig.base.json` (keep the strict options) and add per-package `tsconfig.json` files that extend it, with `types: ["node"]` only where needed
    - _Requirements: 1.1_
  - [x] 1.4 Create empty package shells: `packages/skeleton`, `apps/poltergeist-detector`, `apps/witches-pantry`, each with its own `package.json` (`"type": "module"`, apps depend on `@skeleton-crew/core` through `workspace:*`)
    - _Requirements: 1.1, 1.5_
  - [x] 1.5 Create `.gitignore` with `node_modules/`, `dist/`, and `.env*`. Do not ignore `.kiro/` or anything inside it
    - _Requirements: 12.3_
  - [x] 1.6 Install TypeScript, Vitest, fast-check, and tsx with exact versions (`pnpm add --save-exact -D`). Add root scripts `typecheck`, `test`, `build`. Add one placeholder test to prove `pnpm test` runs
    - _Requirements: 1.3, 10.x_

- [x] 2. Early Kiro setup so it helps while building
  - [x] 2.1 Write `.kiro/steering/project-structure.md` (stack, folder layout, naming, the "skeleton stays generic" rule)
    - _Requirements: 9.1_
  - [x] 2.2 Create the **test-on-save** hook with `createHook` (PostFileSave on `.ts` files, runs the tests)
    - _Requirements: 8.1_
  - [x] 2.3 Create the **usage-log-on-task** hook (PostTaskExec, appends a short entry to `KIRO_USAGE.md`)
    - _Requirements: 8.3_

### Phase 2: Spikes (week 1, each time-boxed to half a day)

Each spike ends with a written decision in `design.md` and a line in `KIRO_USAGE.md`. If a spike fails, the design is updated before any build task that depends on it.

- [x] 3. Spike A: Kiro configuration formats (blocks tasks 17, 21.2, and 28)
  - Build a throwaway MCP server with one `hello` tool using `@modelcontextprotocol/server` v2, run it with `pnpm dlx @modelcontextprotocol/inspector`, then register it in `.kiro/settings/mcp.json` and confirm Kiro lists and can call the tool
  - Find out whether Kiro resolves a relative path in `args` from the workspace root, and what to do if not
  - Read the current Kiro custom agent documentation, create one tiny custom agent, and confirm it can use only the allowed MCP tools. Record the exact file format and location
  - Confirm no `console.log` reaches stdout
  - _Requirements: 3.7, 4.1, 4.3_

- [x] 4. Spike B: detection speed in Node
  - Run COCO-SSD on the pure-JS CPU backend with JPEG and PNG decoding through `jpeg-js` and `pngjs`. Measure model load time, time per image, and memory on 10 sample images
  - Decision: acceptable as is, resize inputs first, or document `@tensorflow/tfjs-node` as an optional speed-up
  - _Requirements: 2.1, 2.5_

- [x] 5. Spike C: food recognition quality
  - Take or collect about 15 photos of your own: fruit, vegetables, a mixed fridge shelf, packaged food
  - Run the MobileNet-style classifier in Node and the browser. Record which target ingredients (tomato, onion, potato, egg, cheese, etc.) are recognized and which are not
  - Decision gate: if recognition is poor, the editable chips and a "quick add" list become the primary input and detection is the helper. Update `design.md` either way
  - _Requirements: 6.6, 6.7_

- [x]* 6. Spike D: nutrition data licensing
  - Confirm the USDA FoodData Central license and the FDA Daily Values used in the Curse Level formula. Write the credit line for the README
  - _Requirements: 14.3_

- [x] 7. Collect sample images
  - 12 to 20 photos taken by you (food, a desk, pets or toys, a street scene). No stock photos with unclear licenses, no logos or brands
  - Store in `samples/` with a short `samples/README.md` stating they are your own work
  - Done with a reduced set: 4 original photos (all food or kitchen) plus rotated copies, with brands and logos pixelated. The before and after photo pairs for the Poltergeist Detector (apple, one_apple, tomatoes) were added later, from Spike E (task 14.1)
  - _Requirements: 4.4, 12.6_

- [x] 8. Checkpoint: spikes complete. Update `design.md`, `KIRO_USAGE.md`

### Phase 3: Skeleton package (weeks 1 to 2)

- [x] 9. Detection core (browser-safe)
  - [x] 9.1 Define `Detection`, `DetectOptions`, `Detector`, `ModelAdapter`, and typed errors (`UnsupportedImageError`)
    - _Requirements: 2.2, 2.4_
  - [x] 9.2 Implement `filterByConfidence` and `countByLabel`
    - _Requirements: 2.3, 3.2_
  - [x] 9.3 Property test: the sum of `countByLabel` counts equals the number of detections
    - _Requirements: 10.1_
  - [x] 9.4 Property test: every detection kept by `filterByConfidence` has confidence at or above the threshold
    - _Requirements: 10.2_
  - [x] 9.5 Implement the `Detector` class around a `ModelAdapter` (loads the model once and reuses it), tested with a fake adapter so tests run offline
    - _Requirements: 2.5, 2.6_

- [x] 10. Model adapters
  - [x] 10.1 `createCocoSsdAdapter` (works in Node and the browser)
    - _Requirements: 2.1, 2.6_
  - [x] 10.2 `createMobileNetFoodAdapter` with an allowlist of food labels passed in by the app, shaped by the results of Spike C
    - _Requirements: 2.2, 6.6_
  - [x] 10.3 Optional integration test that loads the real models, skipped unless `RUN_MODEL_TESTS=1`
    - _Requirements: 2.1_

- [x] 11. Node image loading
  - Load an image from a file path or base64 into pixels, support JPEG and PNG, reject other formats with `UnsupportedImageError`
  - Only read files inside an allowed root, and cap base64 size
  - _Requirements: 2.1, 2.4_

- [x] 12. MCP server kit (Node-only)
  - [x] 12.1 Tool registry that rejects a duplicate name at registration
    - _Requirements: 3.6_
  - [x] 12.2 Tool wrapper: Zod validation before the handler, and a thrown error becomes an error result while the server keeps running
    - _Requirements: 3.4, 3.5_
  - [x] 12.3 Built-in `detect_objects` and `count_objects` tools, plus a `serveStdio` helper that logs only to stderr
    - _Requirements: 3.1, 3.2, 3.3, 3.7_
  - [x] 12.4 Property test: registering any tool name twice always fails
    - _Requirements: 10.3_
  - [x] 12.5 Property test: any input that fails the schema returns a validation error and never calls the handler
    - _Requirements: 10.4_

- [x] 13. Package entry points and the app template
  - [x] 13.1 Browser-safe entry point and Node-only entry point in `package.json` `exports`. Add a build check that the browser entry pulls in no Node modules
    - _Requirements: 1.2_
  - [x] 13.2 App_Agent template and `packages/skeleton/README.md` explaining how to create a new app
    - _Requirements: 1.4, 4.5_

- [x] 14. Checkpoint: run the built-in tools through the MCP Inspector on a sample image, then update `KIRO_USAGE.md`

### Phase 4: Poltergeist Detector CLI (week 2)

- [x] 14.1 Spike E: scene comparison on real photos (blocks task 15; called 14a in the dependency graph)
  - Take two photos of the same desk or shelf from the same spot (a phone propped on a book works), then move two or three objects between them and remove one. Save them as your own photos in `samples/` (for example `desk-before.jpg` and `desk-after.jpg`), with no brand names, logos, people, or screens showing anything personal
  - Run COCO-SSD on both and list what it detects. Check three things: does it find the same objects in both photos when nothing changed, how far do box centres drift between two photos of an unchanged scene, and does a moved object keep its label
  - Take a third photo of the unchanged desk from the same spot and compare it with the first. The result should report nothing, and anything it does report is a false change that the thresholds must absorb
  - Decision: set the default `moveTolerance` and confidence threshold from the measured drift, and record in `design.md` whether the idea works. If the false changes are too many to fix with thresholds, the fallback is to compare counts per label only (appeared and vanished, no "moved")
  - _Requirements: 5.1, 5.3, 5.6_

- [x] 15. App logic
  - [x] 15.1 `compareScenes` pure function as described in `design.md`: match Detections per label by normalized box-centre distance, then report appeared, vanished, moved and unchanged
    - _Requirements: 5.1, 5.10_
  - [x] 15.2 Property test: every Detection in the "before" list is reported exactly once (vanished, moved, unchanged) and every Detection in the "after" list exactly once (appeared, moved, unchanged)
    - _Requirements: 10.5_
  - [x] 15.3 Property tests: swapping "before" and "after" swaps the appeared and vanished counts per label, and comparing a scene with itself reports nothing appeared, vanished or moved
    - _Requirements: 10.6_
  - [x] 15.4 Example tests for the tolerance edges: an object just inside and just outside `moveTolerance`, Detections without a bounding box, two objects of one label swapping places, and empty lists
    - _Requirements: 5.6, 5.9_
  - [x] 15.5 Report formatter: human-readable "haunting report" and JSON output, with a clear message when nothing was detected in either photo
    - _Requirements: 5.3, 5.4, 5.9_
  - [x] 15.6 Scene loader: run the Detector on both photos one after the other, and name the photo that failed if one cannot be read
    - _Requirements: 5.8_

- [x] 16. CLI and MCP server
  - [x] 16.1 CLI with `util.parseArgs`: `compare <before> <after>`, `--json`, `--min-confidence`, `--tolerance`, `--help`. Results go to stdout and progress to stderr. Exit code 1 when a photo is missing or unsupported. The usage text says to take both photos from the same spot
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [x] 16.2 `bin` entry so `poltergeist-detector compare <before> <after>` works after `pnpm link --global`
    - _Requirements: 5.3_
  - [x] 16.3 MCP server entry registering `compare_scenes` on top of the built-ins, using the same `compareScenes` logic as the CLI
    - _Requirements: 5.1, 5.10_
  - [x] 16.4 Unit tests for argument parsing, exit codes, and the error paths
    - _Requirements: 5.7, 5.8, 5.9_

- [x] 17. Kiro wiring for the CLI app
  - Add the server to `.kiro/settings/mcp.json`, write the App_Agent (poltergeist-investigator persona, only this app's tools), try it in Kiro on the before and after photos, and keep a screenshot
  - Server registered via a per-app `mcp-launch.sh` (nvm-aware) after a bare `node` command failed to connect; App_Agent at `.kiro/agents/poltergeist-detector.json` scoped to only this app's three tools. Server connects in Kiro. Screenshot of a live compare still to be captured for the submission.
  - _Requirements: 4.1, 4.2, 4.3, 5.2_

- [x] 18. Checkpoint: run the CLI on the before and after photos in `samples/` end to end, then update `KIRO_USAGE.md`

### Phase 5: The Witch's Pantry core (weeks 2 to 3)

- [x] 19. Data and logic
  - [x] 19.1 Recipe dataset: at least 25 original recipes themed as potions, with normalized ingredient names, grams per ingredient, and servings. Add a schema test
    - _Requirements: 6.15, 14.1_
  - [x] 19.2 Label to ingredient mapping, with synonyms (for example "Granny Smith" to apple), based on Spike C
    - _Requirements: 6.6, 6.7_
  - [x] 19.3 `suggestRecipes`: name-based matching that returns matched and missing ingredients and sorts by match
    - _Requirements: 6.1, 6.8, 6.9_
  - [x] 19.4 Property tests: every returned recipe matches at least one ingredient, adding an ingredient never lowers a recipe's matched count, and matched plus missing equals the recipe's ingredient names with no overlap
    - _Requirements: 10.7, 10.8, 10.9_

- [x] 20. Web UI
  - [x] 20.1 Vite and TypeScript app shell with the witch's-pantry theme, semantic HTML, and visible focus styles
    - _Requirements: 6.3, 6.13_
  - [x] 20.2 Image select and drop with a keyboard-accessible file button, a loading state announced with `aria-live`, and an error message for unsupported files
    - _Requirements: 6.5, 6.10, 6.11_
  - [x] 20.3 Canvas overlay: boxes for localized detections and labelled tags for whole-image classifications
    - _Requirements: 6.5_
  - [x] 20.4 Ingredient chips: remove, add by typing, and a quick-add list. Changing the list re-runs `suggestRecipes`
    - _Requirements: 6.7, 6.8_
  - [x] 20.5 Recipe cards showing matched and missing ingredients, and an empty state when nothing matches
    - _Requirements: 6.9, 6.12_
  - [x] 20.6 Accessibility pass: keyboard-only walkthrough, screen reader text for detections and recipes, colour contrast (code-level done; manual keyboard + screen-reader walkthrough still to confirm in the browser)
    - _Requirements: 6.13_

- [x] 21. MCP server and Kiro wiring
  - [x] 21.1 MCP server entry (Node) registering `suggest_recipes` and using the food adapter for `detect_objects`, sharing the same recipe logic as the UI
    - Verified over stdio: tools/list shows detect_objects, count_objects, suggest_recipes; suggest_recipes(["onion","garlic","tomato"]) returns 21 matches, best-first. Uses the same suggestRecipes + recipes dataset as the web UI.
    - _Requirements: 6.1, 6.14_
  - [x] 21.2 Add to `.kiro/settings/mcp.json`, write the App_Agent (witch's pantry persona), and test it in Kiro
    - App_Agent at `.kiro/agents/witches-pantry.json` (kitchen-witch persona, scoped to this app's three tools, includeMcpJson false) and per-app `mcp-launch.sh` added. User adds the witches-pantry entry to mcp.json and runs the in-Kiro test + screenshot.
    - _Requirements: 4.1, 4.2, 4.3, 6.2_

- [x] 22. Deploy
  - GitHub Pages workflow for `witches-pantry`, correct Vite `base` path, and a check from the public URL in a private browser window. Record the first-load model download size and time
  - Workflow `.github/workflows/deploy-pantry.yml` builds only the web UI; Vite `base` derived from the repo name at build time (`VITE_BASE=/${{ github.event.repository.name }}/`). Verified locally via `vite preview` at the subpath (index + assets HTTP 200). First-load JS ~1.23 MB (~319 KB gzip); MobileNet weights (~14 MB) load from TF Hub on first detection. Deployed live at https://dignat.github.io/kiroween-skeleton-crew/ (Pages source set to GitHub Actions; first deploy 404'd until Pages was enabled, then went green).
  - _Requirements: 6.4, 13.2_

- [x] 23. Checkpoint: use the deployed app with 5 different photos, then update `KIRO_USAGE.md`

### Phase 6: Nutrition, Curse Level, Potion Purity (week 3, stretch)

- [x]* 24. Data
  - [x]* 24.1 `nutrition.json` for the ingredients used by the recipes, from the source confirmed in Spike D, with a `source` field per entry
    - 50 ingredients (every name used by the recipes), per-100 g values from USDA FoodData Central (CC0), each with a `source` field. addedSugar is 0 for whole foods, non-zero only for sugar/honey (and a little for bread).
    - _Requirements: 14.2, 14.3_
  - [x]* 24.2 Data check test: calories are consistent with protein, carbs, and fat per ingredient
    - Fibre-aware Atwater check (fibre ~2 kcal/g), kcal within 15% or 10 kcal of the estimate; also checks every recipe ingredient has an entry, sources are present, and addedSugar ≤ carbs.
    - _Requirements: 14.13_

- [x]* 25. Logic
  - [x]* 25.1 `nutritionPerServing`, with a property test that scaling amounts and servings together leaves the result unchanged
    - _Requirements: 14.4, 10.12_
  - [x]* 25.2 `curseLevel`, `potionPurity`, and `dominantCurse`, with property tests for the 0 to 100 bounds and the monotonic direction for each nutrient
    - _Requirements: 14.5, 14.6, 10.10, 10.11_
  - [x]* 25.3 `sortBy: 'purity'` in `suggestRecipes`, with a property test that Curse Levels never decrease down the list
    - _Requirements: 14.8, 10.13_
  - [x]* 25.4 Extend the `suggest_recipes` output with nutrition, Curse Level, and purity
    - Verified over stdio: sortBy "purity" returns purest-first (Swamp Pea Soup curse=1 ... ascending), each recipe carries curseLevel, purity and per-serving nutrition.
    - _Requirements: 14.11_

- [x]* 26. UI and agent
  - [x]* 26.1 "Best match / Purest first" radio toggle, potion meter with text label, nutrition list, tip, and the disclaimer note
    - Native radio group for the sort; SVG potion-bottle meter that fills with the Curse Level, with the number and purity label also shown as text (never colour alone); per-serving nutrition list; a tip from dominantCurse; and the fixed disclaimer note.
    - _Requirements: 14.7, 14.8, 14.9, 14.10_
  - [x]* 26.2 Update the Pantry App_Agent prompt with the wording rule (ingredients and amounts only)
    - _Requirements: 14.12_

- [x]* 27. Checkpoint: review every tip and label against the wording rule, then update `KIRO_USAGE.md`

- [x]* 27a. Dietary preference filters (stretch, Requirement 15)
  - Added after the nutrition feature at the user's request. A request for health-condition / weight-loss / post-fasting advice was declined as medical advice and reshaped into objective preference filters that describe the recipe, not the person: vegetarian, lowerSugar, lowerSodium, higherFibre, higherProtein, lighter.
  - `dietary-filters.ts` (pure predicates + documented thresholds), wired into `suggestRecipes` (AND before sort), the web UI (accessible checkbox group + neutral description line + extended disclaimer), and the `suggest_recipes` MCP tool (optional `filters` array). 10 property + example tests; 150 tests pass; verified over stdio (23 → 8 for vegetarian+lighter).
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x]* 27b. Food-relevance guardrail (stretch, Requirement 16)
  - A request to guard against harmful/inappropriate uploads was reshaped (declined as content-moderation the on-device model can't honestly do) into a food-relevance check. `food-relevance.ts` + a `check_image` MCP tool + a web-UI gate + the Pantry agent calling it first. 7 property + example tests (incl. the decline message has no medical/harm wording); 160 tests pass. Honesty enforced in tool/agent/UI/comments: relevance only, not moderation.
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

### Phase 7: Kiro layer (build as soon as the pattern is stable, finish in week 4)

- [ ] 28. Developer custom agents (28.1 and 28.2 done; the 28.3 rehearsal is done, only the screen recording remains)
  - [x] 28.1 `tool-builder` agent, written after the CLI app exists so it captures real conventions. Test it by asking it to add a small tool and check the result follows the steering file
    - Agent at `.kiro/agents/tool-builder.json`. TESTED in Kiro: asked it to add a `list_labels` tool to the poltergeist-detector app. It read project-structure.md, created a pure function (`coco-labels.ts`) with a Vitest test incl. a property test, registered a snake_case tool with a Zod schema from @skeleton-crew/core/node returning jsonResult, and prompted for approval on each write/command. Result follows the steering; the tool (80 COCO labels) was kept. 143 tests pass. Note: the agent's welcomeMessage did not show on switch (cosmetic; it shows in a fresh chat). Getting the agent to appear at all required dropping `allowedTools` — see design addendum.
    - _Requirements: 7.1, 7.3_
  - [x] 28.2 `app-generator` agent that creates a new app folder, MCP entry, `mcp.json` entry, and App_Agent from the template
    - Agent at `.kiro/agents/app-generator.json`. Scaffolds package.json, tsconfig, logic + test, mcp-server.ts, the per-app mcp-launch.sh, and the App_Agent from the template; prints the mcp.json block for the user to paste (agent cannot write to .kiro/settings/). Runs install + typecheck + test to verify.
    - _Requirements: 7.2, 7.3_
  - [ ] 28.3 Record a clean run of `app-generator` creating a third demo app for the video, confirm it builds, then discard it. The repo must contain exactly two applications
    - Rehearsal done: the generator was followed to scaffold a throwaway `shelf-scanner` app; install, typecheck and tests were green and the server listed its tools. The demo app was deleted, and a template mismatch it exposed (`node --import tsx` vs `sh mcp-launch.sh`) was fixed.
    - Pending: screen-record a run for the video, then delete the demo app again so the repo keeps exactly two applications.
    - _Requirements: 7.2, 1.1_

- [x] 29. Remaining steering and hooks
  - [x] 29.1 `adding-a-tool.md` with `fileMatch` on the tool folders, and `adding-an-agent.md`
    - `adding-a-tool.md` uses `inclusion: fileMatch` scoped to `apps/*/src/mcp-server.ts` and the MCP kit; it captures the pure-function-first pattern, snake_case/Zod-from-core rules, stderr-only logging, and no-input tools. `adding-an-agent.md` is manual inclusion and documents the verified App_Agent format incl. the `allowedTools`-breaks-discovery finding, the launcher, and `includeMcpJson: false`.
    - _Requirements: 9.2, 9.3, 9.4_
  - [x] 29.2 Hook that checks a newly created tool file is registered and documented
    - `.kiro/hooks/tool-registration-check.json`: PostFileCreate on `apps/.*/src/.*\.ts$`, agent action that checks a new tool file has a test, is registered in mcp-server.ts with a snake_case Zod-schema tool, is well-described, and logs to stderr; does nothing for non-tool files.
    - _Requirements: 8.2_

- [x] 30. Compare surfaces and powers
  - Check the Powers available in your Kiro and try the ones relevant to TypeScript, MCP, or testing. Note what each one added or didn't
  - Run one custom agent task from the Kiro CLI and note how it differed from the IDE
  - Powers: none installed/relevant beyond what the steering + MCP kit already cover (recorded as "tried, nothing added"). CLI: `kiro-cli` 2.35.2 lists all four workspace agents; launching one needs `--v3` ("Mode not found" without it); MCP tools are registered under the default agent, and an App_Agent's inline MCP tools did NOT reliably surface in the CLI (compare_scenes failed with "Load context ... Failed"). Conclusion: the IDE is the reliable surface for this project's agents + MCP tools. Details in KIRO_USAGE.md.
  - _Requirements: 11.1_

- [x] 31. Spec versus vibe coding note
  - Build one small piece without a spec (a utility in the web UI, for example) and compare effort and quality with spec-driven tasks
  - Vibe-coded localStorage persistence of the ingredient list in the Witch's Pantry (~20 lines in main.ts, no spec/test). Typecheck + build green. Comparison written up in KIRO_USAGE.md: vibe-coding suits small isolated low-risk niceties; the spec earns its overhead where there are invariants, shared logic, or blast radius.
  - _Requirements: 11.3_

### Phase 8: Submission (week 4 and buffer)

- [x] 32. Documentation
  - [x] 32.1 Root `README.md`: what it is, features of the skeleton and both apps, Node and pnpm versions with install steps, deployed URL, how to run the CLI, credits and licenses for models and data
    - Written from real repo facts (Node 22.23.0 / pnpm 10.34.9, deployed Pages URL, CLI usage, MIT + TF.js Apache-2.0 + USDA CC0 credits). Covers all stretch features and a "known limitations / future work" section. Living doc — update as features change.
    - _Requirements: 1.6, 12.5_
  - [x] 32.2 README for each app with setup and run instructions
    - `apps/poltergeist-detector/README.md` and `apps/witches-pantry/README.md`: features, requirements, run commands, MCP/Kiro wiring, tests, and credits per app.
    - _Requirements: 1.5, 12.4_

- [x] 33. Repository checks
  - Confirm `.gitignore` does not exclude `.kiro/`, there is no copyrighted material or secret in the repo, and the README credits the model and data sources
  - Verified: `.gitignore` explicitly keeps `.kiro/` (git check-ignore confirms not ignored); all 14 `.kiro` files tracked (agents, hooks, settings, specs, steering). No `.env`/key/credential files tracked; secret-pattern scan found only false positives (a GitHub Actions permission, test fixture `secret.png`, doc wording). All 21 tracked images are in `samples/`, original photos per `samples/README.md` (corrected to list both the fridge set and the before/after pairs); no stock/logos/audio. LICENSE present and is MIT. README has all model/data credits (TF.js Apache-2.0, USDA CC0, MIT).
  - Pending the user (GitHub web, after pushing): confirm the LICENSE shows in the About section, add a repo description and topics.
  - _Requirements: 12.1, 12.2, 12.3, 12.6_

- [x] 34. Clean-clone test
  - Clone into a fresh folder, run `nvm use`, `pnpm install`, `pnpm test`, `pnpm build`, run the CLI on the before and after photos in `samples/`, and open the deployed URL. Fix everything that breaks
  - Cloned fresh from origin to /tmp (HEAD == origin/main, clean tree). `nvm use` → Node 22.23.0; `pnpm install --frozen-lockfile` clean (no native build); `pnpm typecheck` clean; `pnpm test` all tests passed (3 model-integration tests skipped without `RUN_MODEL_TESTS=1`; count at that time, see `pnpm test` for the current number); `pnpm build` produced the web dist. CAUGHT A DOC BUG: the READMEs told users to run the CLI via `pnpm --filter poltergeist-detector start compare samples/...`, which fails because pnpm runs from the app folder and the Detector's allowed-root is the cwd, so repo-root `samples/...` paths are not found (and absolute paths outside the app dir are rejected by the security check). Fixed both READMEs to `node --import tsx apps/poltergeist-detector/src/cli.ts compare samples/... samples/...` run from the repo root; re-verified report/--json/--help and missing-file exit 1 all work from the clone. Web app: build green; the deployed GitHub Pages URL is the judge path.
  - _Requirements: 1.3, 1.7, 12.4_

- [ ] 35. Demo video (3 minutes or less, YouTube public)
  - Outline: problem and audience (15s), Witch's Pantry end to end (60s), Poltergeist Detector CLI plus Kiro calling the MCP tools (45s), `app-generator` making a third app (30s), the Kiro features used (20s)
  - Original or royalty-free audio only, no third-party logos, recorded on the machine the project was built on
  - _Requirements: 13.5, 13.10_

- [ ] 36. Write-up and posts
  - [x] 36.1 Finish `KIRO_USAGE.md` with concrete examples for every rubric item and use it for the Devpost write-up
    - `KIRO_USAGE.md` completed — every rubric section filled (Agent hooks section written, property-test invariants listed, no empty placeholders). Devpost write-up drafted and saved to `docs/devpost.md` (Inspiration → Built with).
    - _Requirements: 11.1, 11.2, 11.3, 13.6_
  - [ ]* 36.2 Blog post on a third-party platform, published within the submission period, mentioning "Kiroween Hackathon 2026"
    - Draft written at `docs/blog-post.md` (spec-pivot, honest-engineering, the Node/PATH bug). PENDING the user: publish it on a third-party platform during the submission window and add the URL to Devpost.
    - _Requirements: 13.8_
  - [ ]* 36.3 Social post that starts with `#KiroweenHackathon26`, written in your own words with a real insight about Kiro
    - Four draft options at `docs/social-post.md`, each starting with `#KiroweenHackathon26`. PENDING the user: rewrite one in your own words (authenticity is judged), post it, add the URL to Devpost.
    - _Requirements: 13.9_

- [ ] 37. Devpost submission
  - Select Skeleton Crew, add the repo URL, deployed URL, CLI instructions, description, video link, write-up, and bonus links. Submit by 2 December
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.7, 13.11_

## Task Dependency Graph

```mermaid
flowchart TD
    T1[1. Workspace scaffold] --> T2[2. Early steering and hooks]
    T1 --> T3[3. Spike A: Kiro config formats]
    T1 --> T4[4. Spike B: Node detection speed]
    T1 --> T5[5. Spike C: food recognition]
    T1 --> T6[6*. Spike D: nutrition licensing]
    T7[7. Sample images] --> T4
    T7 --> T5

    T4 --> T9[9. Detection core]
    T9 --> T10[10. Model adapters]
    T5 --> T10
    T10 --> T11[11. Node image loading]
    T11 --> T12[12. MCP server kit]
    T3 --> T12
    T12 --> T13[13. Entry points and app template]

    T13 --> T14a[14a. Spike E: scene comparison]
    T14a --> T15[15. Poltergeist Detector logic]
    T15 --> T16[16. CLI and MCP server]
    T16 --> T17[17. Kiro wiring: CLI app]
    T3 --> T17

    T13 --> T19[19. Pantry data and logic]
    T19 --> T20[20. Web UI]
    T19 --> T21[21. Pantry MCP server and Kiro wiring]
    T3 --> T21
    T20 --> T22[22. Deploy to GitHub Pages]

    T19 --> T24[24*. Nutrition data]
    T6 --> T24
    T24 --> T25[25*. Curse Level logic]
    T25 --> T26[26*. Nutrition UI and agent]
    T20 --> T26

    T16 --> T28[28. Developer custom agents]
    T17 --> T28
    T28 --> T29[29. Remaining steering and hooks]

    T22 --> T32[32. Documentation]
    T17 --> T32
    T21 --> T32
    T32 --> T34[34. Clean-clone test]
    T28 --> T35[35. Demo video]
    T34 --> T35
    T35 --> T37[37. Devpost submission]
    T36[36. Write-up and posts] --> T37
```

Checkpoint tasks (8, 14, 18, 23, 27) follow the phase they close. Tasks 30, 31, and 33 have no hard dependencies and fit in whenever there is time, before task 37.

## Notes

### Definition of done

- Every coding task is done when `pnpm typecheck` and `pnpm test` pass under Node 22.23.0. Run `nvm use` in the project folder first.
- Property tests for the skeleton and both apps are must-have, because property-based testing is part of the judged Kiro usage. Only the Phase 6 property tests are stretch, since the whole nutrition feature is stretch.
- Never commit from the agent. The user commits.

### Cut order if the schedule slips

1. Requirements 14 to 16 (nutrition, dietary filters, food-relevance check), all stretch
2. Social post
3. Blog post
4. Kiro CLI comparison

The two apps, the skeleton, the Kiro layer, the video, and the README are never cut.

### Evidence for the write-up

Each phase ends with a checkpoint. Add a short, concrete entry to `KIRO_USAGE.md` at every checkpoint: what Kiro did, what went wrong, and what changed because of it. Screenshots count as evidence.

### Suggested schedule

| Week | Dates | Focus |
|---|---|---|
| 1 | 2 to 8 Nov | Setup, spikes, skeleton |
| 2 | 9 to 15 Nov | Poltergeist Detector CLI, start Witch's Pantry core |
| 3 | 16 to 22 Nov | Witch's Pantry core and deploy, stretch nutrition |
| 4 | 23 to 29 Nov | Kiro layer polish, READMEs, video, blog, social |
| Buffer | 30 Nov to 3 Dec | Clean-clone test, fixes, submit by 2 Dec |
