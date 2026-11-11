# How Kiro Was Used

Skeleton Crew is one reusable detection skeleton (`@skeleton-crew/core`) and two apps built on it: Poltergeist Detector (a CLI) and The Witch's Pantry (a web UI). This file explains which Kiro features were used to build it, what each one did, and where to find the evidence in the repo.

## At a glance

| Kiro feature | What it did in this project | Where to look |
| --- | --- | --- |
| **Specs** | Requirements (EARS acceptance criteria) → design → tasks tied to requirement numbers. Spikes first to test the riskiest assumptions. Made a mid-build change of app 1 a controlled edit. | `.kiro/specs/skeleton-crew/` |
| **Steering** | All three inclusion modes: `always` (conventions), `fileMatch` (the "add an MCP tool" recipe), `manual` (the "write an agent" recipe). Generated code matched the repo without corrections. | `.kiro/steering/`, `AGENTS.md` |
| **Custom agents** | Two app agents that are the AI layer of each app (no paid LLM API), and two developer agents (`tool-builder`, `app-generator`) that scaffold tools and whole apps. | `.kiro/agents/` |
| **MCP** | Each app runs its own stdio MCP server built with the skeleton's `createAppServer` / `defineTool` / `serveApp`. Kiro agents call it, so on-device TensorFlow.js detection is available to the agent. | `.kiro/settings/mcp.json`, `apps/*/src/mcp-server.ts`, `apps/*/mcp-launch.sh` |
| **Agent hooks** | Tests on save, a usage-log entry after each spec task, and a tool-registration check on new files. | `.kiro/hooks/` |
| **Powers** | Evaluated, none adopted (steering plus the project's own MCP kit covered the need). | [Kiro Powers](#kiro-powers) |
| **IDE vs CLI** | Custom agents were run in both. The IDE was the reliable surface for agents plus MCP tools. | [Kiro CLI vs IDE](#kiro-cli-vs-ide) |
| **Judgment calls** | Kiro pushed back on medical-advice features and on overclaiming content moderation, and caught a naming collision. | [Where Kiro changed the outcome](#where-kiro-changed-the-outcome) |
| **Vibe vs spec** | One feature was deliberately built without a spec to compare the two modes. | [Spec vs. vibe coding](#spec-vs-vibe-coding) |

Highlights a reviewer can verify quickly:

- `app-generator` scaffolded a working third app (code, tests, MCP server, launcher, agent) in one step, which demonstrates "one skeleton, many apps".
- `tool-builder` added a new MCP tool by following the steering recipe with no corrections.
- The `tool-registration-check` hook fired on its own during later work and caught a file that needed wiring as a tool.
- Spikes run before the design changed the design twice (inference speed, and ingredient chips as the primary input).
- Property tests (fast-check) found a real bug in how the MCP kit meets the SDK.

---

## Specs

**Summary:** the spec in `.kiro/specs/skeleton-crew/` (requirements with EARS-style acceptance criteria, design, tasks tied to requirement numbers) was the source of truth. Spikes went first to test the riskiest assumptions, and two of them changed the design. Because the spec was authoritative, swapping app 1 mid-build was a controlled edit across the spec files while typecheck and tests stayed green.

- Started with a rough idea (one template + two apps) and turned it into `requirements.md` using EARS-style acceptance criteria.
- A first review of the hackathon rubric changed the spec: "custom agents" and "MCP" were reinterpreted as Kiro development features, and Requirements 8 to 13 were added (MCP in Kiro, custom agents, hooks, steering, property-based testing, this log).
- Decided to make Kiro the agent layer: custom agents in Kiro call the project's own MCP servers, so there are no paid LLM APIs. This removed the planned agent runtime and LLM provider code from the spec, which made the skeleton smaller.
- Chose one CLI app and one web UI app on the same skeleton, to show the template works across different interfaces. Added shared requirements so each app's CLI/UI and its MCP tools use the same logic.
- Pasted the official submission rules into Kiro and reviewed them together. This corrected an assumption (two separate GitHub repos) to one repo with two app folders, and added a submission-readiness requirement (license, `.kiro/` committed, deployable web UI).
- Finalized the two apps. App 1 was first planned as "Graveyard Shift Inventory" (a CLI photo sorter) and was later replaced by the Poltergeist Detector (see below). App 2 is "The Witch's Pantry" (web UI food detection + recipes). Wrote concrete property tests for each app's logic (grouping, recipe matching).
- **Changed app 1 mid-build, after the skeleton was done.** The idea was set against what had been measured: COCO-SSD detects 80 classes with boxes, about 5 s per image, and is sometimes wrong. The Poltergeist Detector (compare a before and an after photo, report what appeared, vanished or moved) won because it uses the bounding boxes, has a clear demo moment, and gives better property tests (every detection reported exactly once, swapping the photos swaps appeared and vanished). Because the spec was the source of truth, the swap meant editing requirements 5 and 10.5 to 10.6, `design.md`, `tasks.md`, the steering file and `AGENTS.md`, and renaming the app folder, and `pnpm typecheck` and `pnpm test` stayed green. A new Spike E was added first, since noisy detections across two photos are the idea's main risk.
- Researched the MCP TypeScript SDK, TensorFlow.js Node backends, and food-classifier options before writing `design.md`, instead of assuming the first library guess was right. This caught two real issues: local Node (18.20.4) is below the MCP SDK v2's minimum (20+), and COCO-SSD has almost no food classes, which is why the design adds a swappable model-adapter layer and a `Detection` shape that supports both boxes (COCO-SSD) and whole-image labels (MobileNet-style food classifier).
- Wrote `tasks.md` with each task tied to requirement numbers, spikes placed first, and a must-have vs stretch split with an explicit cut order.
- Added a stretch feature mid-spec: nutrition, a Curse Level (0 to 100) and Potion Purity labels for the Witch's Pantry, with a "Best match" / "Purest first" toggle. Because it sits in its own requirement (14) marked stretch, the core app does not depend on it, and its scoring rules became property tests (bounds, monotonicity, scaling invariance).

### Spikes that changed the design

- **Task 1 (workspace scaffold):** Kiro checked each tool's Node requirement before installing and found that Vitest 5.1.0 needs Node 22.12 or later, so `engines.node` was tightened from `>=22` to `>=22.12.0`. The first typecheck failed because `pnpm add -w` only installs the root; a full `pnpm install` was needed to create the `workspace:*` links.
- **Spike B (task 4):** ran COCO-SSD on the pure-JS CPU backend (`@tensorflow/tfjs` 4.22.0) with `jpeg-js` and `pngjs` decoders in Node 22.23.0. Measured ~5.6 s cold model load (one-time) and 4.8 to 6.4 s per-image inference on 4 real food photos (avg 5.2 s). Inference is flat across image sizes: the bottleneck is JS execution, not pixel upload. Found that `tf.browser.fromPixels` in Node needs `{ data: Buffer, width, height }` where `data instanceof Uint8Array`; passing a re-wrapped `Uint8Array` view breaks the internal check. Decision: document `@tensorflow/tfjs-node` as an optional speed-up, not a requirement.
- **Spike C (task 5):** The classifier results changed the design: ImageNet MobileNet scored one clear hit in 15 images and has no tomato, onion, carrot, garlic or avocado class, so the editable ingredient chips became the primary input and detection became a helper. A TLS certificate error on the model download was solved with `node --use-system-ca` instead of disabling certificate checks.
- **Spike D (task 6):** Kiro checked the licensing before any nutrition data was built. The USDA FoodData Central home page states its data is public domain under CC0 1.0, and the FDA Daily Values were read straight from the FDA's DRV table. The PDF text had table footnote markers glued to the numbers ("178" for 78 g of fat), so each value was checked against the known label values instead of trusted as extracted.
- **Spike E (task 14.1, Poltergeist Detector):** ran COCO-SSD on before/after photo pairs to set the scene-comparison thresholds. The first photos detected nothing even at 0.01 confidence, so Kiro verified the pipeline against the canonical darknet dog.jpg (bicycle 96%, dog 86%, car 84%) to prove the code was correct, then isolated the cause to framing: small objects top-down in a 4000×3000 frame become a tiny blob after the model's internal downscale to ~300×300. It also found COCO-SSD detection flickers between near-identical frames and mislabels food (tomato → apple/cake). Decisions: default `moveTolerance` 5% (measured unchanged-object drift was 2.4%), confidence 0.5, and appeared/vanished-per-label as the reliable primary output with "moved" as a best-effort extra.
- **Checkpoint 8:** all four early spikes are recorded in `design.md`. Two of them changed the design: Spike B (inference is slow on the pure-JS backend) and Spike C (ingredient chips are the primary input in the Witch's Pantry).
- **Task 7 (sample images):** Kiro built a throwaway script (outside the repo) that pixelates the labelled areas, removes the camera stamp and metadata, shrinks the photos to 1400 px, and makes the rotated copies. It reviewed each result by eye and added extra blur regions after the first pass missed a few small labels. Four stock PNGs reappeared in `samples/` during the work and were removed again.

### Spec vs. vibe coding

- Task 31: built one small feature without a spec, to compare against the spec-driven work. The feature is localStorage persistence of the ingredient list in the Witch's Pantry (add some ingredients, refresh the page, they are still there). It was vibe-coded: no requirement, no design entry, no task breakdown, no test, just two small helpers (`loadSavedIngredients`/`saveIngredients`) wired into the existing `refresh()` and startup in `main.ts`, about 20 lines. Done in one short pass, typecheck and build green.
- **Speed:** the vibe feature was much faster to land than a spec task. For something this small and low-risk (a browser-only nicety that fails silently in private mode), the spec overhead would not have paid off.
- **Quality and safety net:** the spec-driven work carries property tests, requirement traceability, and a design record. The vibe feature has none, so a future refactor of `refresh()` could silently break persistence and no test would catch it.
- **Fit:** vibe-coding was fine because the feature is isolated (one storage key, two helpers, graceful failure). The core detection/recipe/nutrition logic has real invariants (every image in exactly one group, matched ∪ missing = ingredients, Curse Level monotonicity) that are only trustworthy because the spec forced them into property tests.
- **A second, bigger case: the nutrition calculator (`calculate_nutrition`, "Cauldron Calculator").** This feature was also built without a spec entry: it has no requirement, design section or task in `.kiro/specs/skeleton-crew/`. It is not the same kind of vibe coding as the localStorage helper, though. The design decisions were made in conversation before any code (including splitting "daily target limits" into a safe version, see "Where Kiro changed the outcome"), and the logic has its own property tests (non-negative totals, scaling, unknown ingredients reported as `missing`). What it lacks is traceability: the spec does not mention it, and the Pantry App_Agent does not list the tool. This is the cost of skipping the spec on a feature with real logic and a new MCP tool: the tests protect the behaviour, but the spec and the agent drifted behind the code.
- **Takeaway:** vibe-coding suits small, isolated, low-risk niceties; the spec earns its overhead on anything with invariants, shared logic, or a blast radius. This repo uses both deliberately.

---

## Steering

**Summary:** steering used all three inclusion modes, so each piece of guidance loads only when it is useful. A small always-on file holds the hard rules, and on-demand files hold step-by-step recipes. Kiro followed the conventions without being re-told.

| File | Inclusion | Purpose |
| --- | --- | --- |
| `AGENTS.md` | always | Project overview, architecture, hard rules (no paid APIs, never ignore `.kiro/`, skeleton stays generic, never commit from the agent). Keeps spec decisions in every conversation. |
| `.kiro/steering/project-structure.md` | `always` | Stack, layout, naming (`kebab-case` files, `snake_case` MCP tool names), behavior rules (log only to stderr in MCP servers, validate input with Zod). The reason generated code matched the repo without corrections. |
| `.kiro/steering/adding-a-tool.md` | `fileMatch` on `apps/*/src/mcp-server.ts` and the MCP kit | The ordered recipe for adding a tool. Loads only when one of those files is open. `tool-builder` followed it with no corrections when it added `list_labels`. |
| `.kiro/steering/adding-an-agent.md` | `manual` (pulled in with `#`) | How to write an App_Agent. Captures the hard-won agent format findings (for example, `allowedTools` silently drops an agent from the selector). |

- **Biggest lever: writing down the failures.** The nvm launcher rule, the stderr-only logging rule and the agent field set all came from debugging sessions and were then moved into steering so they did not have to be rediscovered.
- Steering also carried the project rules into every later feature: the "ingredients and amounts only, no medical advice" wording rule shaped the Curse Level, the dietary filters and the nutrition calculator (see the build notes).

---

## Custom agents

**Summary:** four custom agents live in `.kiro/agents/`, all used in the Kiro IDE (and tried in the CLI).

| Agent | Type | What it does |
| --- | --- | --- |
| `poltergeist-detector` | App agent (calls MCP) | Compares before/after photos with `compare_scenes`. |
| `witches-pantry` | App agent (calls MCP) | Calls `check_image`, then `suggest_recipes`; follows the "ingredients and amounts only, no medical advice" rule. |
| `tool-builder` | Developer agent (built-in file/shell tools) | Adds a new MCP tool to an app. |
| `app-generator` | Developer agent (built-in file/shell tools) | Scaffolds a whole new app from the skeleton. |

- **Impact:** the app agents are the AI layer of both apps and need no paid LLM API. The developer agents made "one skeleton, many apps" demonstrable.
- **Agent format findings.** Spike A (task 3) built a throwaway `spike-hello` agent to learn the real file format. Kiro's current docs showed that the `allowedTools` field I first wrote is CLI 2.x legacy and IDE 1.0 uses `permissions.rules`, so the file was rewritten before testing. With the agent active, a "list the project files" request was refused while `hello` still worked. Later, for the developer agents, a controlled A/B test showed that an agent that declares `allowedTools` is silently dropped from the agent selector (no error, no welcome message, prompts fall through to the default agent). The working field set is `name`, `description`, `prompt`, `tools`, `includeMcpJson`, `welcomeMessage`.
- **Finding the built-in tool names** took a real debugging session. They are `fs_read`, `fs_write`, `execute_bash`, `grep`, `glob`, discovered by reading Kiro's own `~/.kiro/agents/kirocrew*.json` agents, after guesses based on the CLI docs (`shell`) and the IDE changelog (`read`/`write`/`shell`) both failed.
- **`tool-builder`, tested live (task 28.1):** asked to add a `list_labels` tool to the poltergeist-detector app, it read `project-structure.md`, wrote a pure function `coco-labels.ts` with a Vitest test (including a property test that the returned array can't mutate the source), registered a snake_case `list_labels` tool with a Zod schema from `@skeleton-crew/core/node`, and prompted for approval on each write and command. The result followed the steering with no corrections; the tool was kept (returns the 80 COCO class names). The `welcomeMessage` did not display when switching agents in an existing chat (cosmetic; it shows in a fresh chat).
- **`app-generator`, verified (task 28.3 rehearsal):** following its prompt, it scaffolded a throwaway third app (`shelf-scanner`, one tool `list_shelf`). All seven artifacts were generated (package.json, tsconfig, pure logic + Vitest test, `mcp-server.ts` using the skeleton's `createAppServer`/`defineTool`/`serveApp`, the nvm launcher, and the App_Agent). `pnpm install` and typecheck were clean, tests green, and the server listed `detect_objects`, `count_objects`, `list_shelf` over stdio, all without touching `packages/`. The demo app was then deleted so the repo keeps exactly two real apps. The exercise surfaced one inconsistency that was fixed: the App_Agent template's `mcpServers` command did not match what the prompt and the real agents use (`sh apps/<app>/mcp-launch.sh`), so the template now uses a `{{MCP_LAUNCHER}}` placeholder running `sh`, with its test updated. This is the clearest single demonstration of the "one skeleton, many apps" thesis.
- **`witches-pantry` agent:** the prompt enforces the "ingredients and amounts only, no medical advice" rule, and was later updated to call `check_image` first and politely decline non-food images.

---

## MCP

**Summary:** each app runs its own stdio MCP server built from the skeleton's `createAppServer` / `defineTool` / `serveApp` helpers, and Kiro agents call it. This made the "Kiro is the agent layer" design possible with no paid LLM API: the model reasoning is Kiro's, and the project supplies on-device detection as tools. It also let one `compareScenes` / `suggestRecipes` function back both the CLI/UI and the MCP tool. Without MCP, the agents could not have run local TensorFlow.js detection at all.

| App | MCP tools |
| --- | --- |
| both (built into the skeleton) | `detect_objects`, `count_objects` |
| poltergeist-detector | `compare_scenes`, `list_labels` |
| witches-pantry | `suggest_recipes`, `check_image`, `calculate_nutrition` |

### Findings worth reading

- **The nvm launcher (task 17).** The Poltergeist Detector server would not connect; `mcpGateway.log` only said "Connection closed". The server ran fine standalone under Node 22, but Kiro spawns MCP servers in a minimal, non-interactive environment that never runs `nvm use`, so `node` fell through to an old system binary (Node 16/18, via `/usr/local/bin/node` and a leftover Volta shim). Node 16 rejects `--import` outright, so the process died instantly. The machine had three Node managers fighting over PATH (nvm, Volta, a root `/usr/local/bin/node`), and macOS's `path_helper` kept re-prioritising the system one on login shells. Fix: each app ships `mcp-launch.sh`, a POSIX launcher that loads nvm, picks the `.nvmrc` version, and execs the server (nvm chatter to stderr so stdout stays clean); `mcp.json` and the agent run it via `sh`. One launcher per app, no shared root script. The README warns users to make Node 22 the default when they are not on nvm.
- **Spike A (task 3).** A one-tool MCP server was registered in `.kiro/settings/mcp.json` and called from Kiro. Findings: the server only showed up after a window reload, Kiro runs servers from the workspace root so relative `args` work, and `node --import tsx` runs TypeScript with no build step. A raw stdio check confirmed stdout carries only protocol messages and bad input returns an error result without stopping the server.
- **Phase 3 (tasks 9 to 14).** Two typing problems came from reading the SDK's own `.d.mts` files: `serveStdio` returns a handle, not a promise, and `registerTool` needs a Standard Schema type that a plain `ZodType` does not satisfy. Checkpoint 14 ran a real server with the real COCO-SSD model over stdio on the sample photos, and showed the model calling a potato a cake at 0.93 confidence, which is why Spike C's "chips first" decision matters.
- **One function, two surfaces.** Checkpoint 18 ran the CLI end to end on all three sample before/after pairs, then drove the same compare through the MCP `compare_scenes` tool inside Kiro and got the identical result, confirming the CLI and the MCP tool share one `compareScenes` function. As Spike E predicted, the changes COCO-SSD reports between near-identical frames are mostly label flicker, which is why the UI copy and the agent prompt both warn that a lone appeared/vanished is unreliable and only a matched "moved" is trustworthy.
- **Task 21 (Witch's Pantry server + agent).** The server registers `suggest_recipes` alongside the built-in tools and reuses the exact `suggestRecipes` function and recipe dataset the web UI uses. Driven live in Kiro through the `witches-pantry` agent, `suggest_recipes(["onion","garlic","tomato"])` returned 21 potions best-match-first, with Crimson Hex Soup top.
- **Sharpening the "one skeleton" thesis (`serveApp`).**  The rule-respecting version added `createAppServer` / `serveApp` / `defineTool` to `@skeleton-crew/core/node`. Each app's `mcp-server.ts` is now a declaration (its name, detector, and a list of `defineTool({...})` entries) handed to the skeleton, which wires the built-in tools and registration. Typing detail: a mixed array of tools with different Zod schemas needs `defineTool` (an identity function) to pin each tool's inferred input type. Behaviour unchanged, 160 tests green.
- **Warm-up investigation (performance).** Added an optional `warmUp` flag to both model adapters to run one throwaway inference at `load()` time, expecting it to hide first-call latency. Measured on the real COCO model: on the Node CPU backend there was no per-call speedup (both ~6.5 s); it only moved ~4.4 s of work into `load()`. That benefit is specific to the browser's WebGL backend, so the default is `warmUp: false` and only the web app opts in. The lesson: measuring beat assuming.

---

## Agent hooks

**Summary:** three hooks in `.kiro/hooks/`, created with Kiro's hook tooling (not hand-written), automate the repetitive checks.

| Hook | Trigger | Action | Proof it worked |
| --- | --- | --- | --- |
| Test on save | `PostFileSave` on `*.ts` | Runs `pnpm test` | A change that breaks a property test is caught immediately rather than at the next manual run. |
| Usage log on task | `PostTaskExec` | Agent prompt: append a short entry to this log | Part of why this file stayed current through the build instead of being written from memory at the end. |
| Tool registration check | `PostFileCreate` on `apps/*/src/*.ts` | Agent prompt: if the new file backs an MCP tool, verify snake_case name, Zod schema, docs, stderr-only logging; otherwise do nothing | Fired on every new file in the stretch work (below). |

**The tool-registration-check hook earned its place during later work.** As the dietary-filter and food-relevance files were created, the hook fired on each one: it correctly treated `dietary-filters.ts` and its test as logic (no new tool to wire) and, when `food-relevance.ts` was created, flagged that it backed a new tool. That prompted wiring `check_image` into `mcp-server.ts` with a Zod schema and `jsonResult`. A hook written in an early phase doing real work in a later phase, with no prompting.

---

## Kiro Powers

**Summary:** no Powers were installed or adopted. The project's steering files and its own MCP kit already encode the conventions a TypeScript/MCP/testing Power would add. The third-party tooling used was open source and keyless: the MCP TypeScript SDK, TensorFlow.js with COCO-SSD and MobileNet, `fast-check`, Vitest, and USDA FoodData Central (CC0) data.

- Task 30 (powers + surfaces): checked Powers; none were installed in the project's Kiro, and the Powers surface offered nothing specifically for TypeScript, MCP, or testing that the project's own steering and MCP kit did not already cover. The `kiro-cli powers` subcommand exists (install/uninstall), so Powers are a plugin mechanism, but for this build steering plus the skeleton's MCP kit were the better fit. Recorded as "tried, nothing added" rather than skipped.

---

## Kiro CLI vs IDE

**Summary:** the build ran in the Kiro IDE. Custom agents were also run from the Kiro CLI (`kiro-cli` 2.35.2) to compare. The IDE was the reliable surface for custom agents plus MCP tools. Kiro Web and Crew were not used for this project.

- `kiro-cli agent list` discovers all four workspace agents, each tagged "Workspace (v3 format)", so the CLI reads the same `.kiro/agents/` files the IDE does.
- The engine flag matters. `kiro-cli chat --agent poltergeist-detector` failed with "Mode 'poltergeist-detector' not found" on the default engine; adding `--v3` launched the agent.
- MCP tools are wired less reliably in the CLI. `kiro-cli mcp list` shows the workspace `mcp.json` servers registered under the default agent, not attached to the custom App_Agents. In a `--v3` agent session, a real `compare_scenes` call failed with "Load context: compare_scenes ... Failed" and the agent reported it only had `disclose_context`, not its MCP tools.
- **Conclusion:** the App_Agent's inline `mcpServers` + `permissions.rules` that work in the IDE did not reliably surface the tools in the CLI. For the demo and submission, drive the agents from the IDE.

---

## Property-based testing

- **A property test found a real bug in how the kit meets the SDK.** The "registering any name twice is rejected" property used arbitrary strings, and fast-check shrank a failure to the name `valueOf`: the SDK keeps tools in a plain object, so `valueOf`, `toString` and `constructor` count as "already registered" on first use. The fix was to enforce snake_case tool names, which the steering file already required, with a clear error, and to keep `constructor` reserved.
- **Mutation checks showed the tests can fail.** For the confidence filter, the label counter, the folder-containment check and the stdout redirect, a deliberate bug was introduced, the tests were run to see them fail, and the code was restored. It confirmed each property is not vacuous.
- **Skeleton:** confidence filter keeps only detections at or above the threshold; label counts sum to the number of detections (unit-level and through a real MCP client); duplicate tool names are always rejected; input that fails a schema never reaches the handler; non-JPEG/PNG bytes are rejected with `UnsupportedImageError`.
- **Poltergeist Detector:** every detection is reported in exactly one category; swapping before/after swaps appeared and vanished; comparing a scene with itself reports no change.
- **Witch's Pantry:** matched ∪ missing equals a recipe's ingredients with no overlap; adding an ingredient never lowers a recipe's matched count; Curse Level stays within 0 to 100 and is monotonic in each nutrient; per-serving nutrition is invariant under scaling amounts and servings together; "purest first" never lets Curse Levels decrease; a dietary filter only ever removes recipes and every result passes every selected filter; `check_image` reports food exactly when an ingredient is recognized; calculator totals are never negative and unknown ingredients are reported as `missing`.

---

## Where Kiro changed the outcome

Moments where Kiro made a decision instead of just writing code. All of them share the wording rule from steering: ingredients and amounts only, no medical or diet advice.

- **Dietary filters (Requirement 15).** The first idea covered health conditions, weight loss and refeeding after a fast, which is advice the app should not give. Kiro proposed objective preference filters that describe the recipe, not the person (vegetarian, lower sugar, lower sodium, higher fibre, higher protein, lighter). A test asserts the filter description contains no weight, diet or diabetes wording.
- **Food-relevance guardrail (`check_image`).** Asked for a guard against harmful uploads, Kiro said a real safety classifier needs a dedicated model or a keyed cloud service, which the no-paid-services rule forbids, and that faking it with the food model would be worse. It built a food-relevance gate instead and states in the tool description, the agent prompt and the code that it does not detect harmful content.
- **Nutrition calculator (`calculate_nutrition`).** Kiro flagged "daily target limits" as the part that could turn into dietary advice and split it: the user enters their own targets and the calculator shows a plain percentage, never a recommended value. The user chose that version.
- **Naming collision.** Kiro caught that user-entered `DailyTargets` read like the internal FDA `DAILY_VALUES` and renamed it `UserTargets`, with a cross-reference comment.
- **Data check.** Testing the nutrition data showed the plain Atwater formula over-counts high-fibre foods (cinnamon was ~100 kcal off), so it was replaced with a fibre-aware estimate.

---

## Submission checklist (required by Devpost)

- [x] Public GitHub repo, license visible in About section, `.kiro/` committed
- [x] Web UI deployed and reachable at a public URL (https://dignat.github.io/kiroween-skeleton-crew/)
- [x] CLI run instructions in its app README
- [ ] Devpost text description written
- [ ] Demo video (3 minutes or less, public on YouTube, no copyrighted music, shows real usage)
- [ ] This file finished and linked from the submission
- [ ] Blog post published during the submission period, mentions "Kiroween Hackathon 2026"
- [x] Social post published, starts with `#KiroweenHackathon26`, written by hand (not AI-generated)
