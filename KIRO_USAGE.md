# How Kiro Was Used

Running log for the Kiroween (Skeleton Crew) write-up. Add short, concrete notes as you go: what you did, what Kiro produced, and what changed because of it.

## Kiro IDE / CLI / Web

- Task 1 (workspace scaffold) ran in the Kiro IDE from the spec. Kiro checked each tool's Node requirement before installing and found that Vitest 5.1.0 needs Node 22.12 or later, so `engines.node` was tightened from `>=22` to `>=22.12.0`. The first typecheck failed because `pnpm add -w` only installs the root; a full `pnpm install` was needed to create the `workspace:*` links. Both checks (`pnpm typecheck`, `pnpm test`) pass after that.

- Spike C (task 5): Kiro looked at the sample images before running the test and noticed that several were stock photos, one with a visible Getty Images watermark. That conflicts with the project rule that samples must be the author's own, so the images were used only for a local test and then taken out of the repo. The classifier results changed the design: ImageNet MobileNet scored one clear hit in 15 images and has no tomato, onion, carrot, garlic or avocado class, so the editable ingredient chips became the primary input and detection became a helper. A TLS certificate error on the model download was solved with `node --use-system-ca` instead of disabling certificate checks. Details in `design.md`.

- Task 7 (sample images): Kiro checked the four photos before copying them and found third-party brand names and logos in three of them, which breaks the project rule against trademarks in sample images. It built a throwaway script (outside the repo) that pixelates the labelled areas, removes the camera stamp and metadata, shrinks the photos to 1400 px, and makes the rotated copies. It then reviewed each result by eye and added extra blur regions after the first pass missed a few small labels. Four stock PNGs reappeared in `samples/` during the work and were removed again.

- Spike D (task 6): Kiro checked the licensing before any nutrition data was built. The USDA FoodData Central home page states its data is public domain under CC0 1.0, and the FDA Daily Values were read straight from the FDA's DRV table. The PDF text had table footnote markers glued to the numbers ("178" for 78 g of fat), so each value was checked against the known label values instead of trusted as extracted. The design's two "must be confirmed" notes were replaced with confirmed ones.
- Checkpoint 8: all four spikes are done and recorded in `design.md`. Two of them changed the design: Spike B (inference is slow on the pure-JS backend) and Spike C (ingredient chips are the primary input in the Witch's Pantry).

- Spike E (task 14.1, Poltergeist Detector): ran COCO-SSD on before/after photo pairs to set the scene-comparison thresholds. The first photos detected nothing even at 0.01 confidence, so Kiro verified the pipeline against the canonical darknet dog.jpg (bicycle 96%, dog 86%, car 84%) to prove the code was correct, then isolated the cause to framing — small objects top-down in a 4000×3000 frame become a tiny blob after the model's internal downscale to ~300×300. It also found COCO-SSD detection flickers between near-identical frames and mislabels food (tomato → apple/cake). Decisions: default `moveTolerance` 5% (measured unchanged-object drift was 2.4%), confidence 0.5, and appeared/vanished-per-label as the reliable primary output with "moved" as a best-effort extra. Several throwaway diagnostic scripts were written and removed. Details in `design.md`.

## Custom agents

- Spike A (task 3): built a throwaway `spike-hello` agent to learn the real file format. Kiro's current docs showed that the `allowedTools` field I first wrote is CLI 2.x legacy and IDE 1.0 uses `permissions.rules`, so the file was rewritten before testing. With the agent active, a "list the project files" request was refused while `hello` still worked.

## Agent hooks

- 

## Spec-driven development

- Started with a rough idea (one template + two apps) and turned it into a requirements doc in `.kiro/specs/skeleton-crew/requirements.md` using EARS-style acceptance criteria.
- First review of the hackathon rubric changed the spec: "custom agents" and "MCP" were reinterpreted as Kiro development features, and Requirements 8–13 were added (MCP in Kiro, custom agents, hooks, steering, PBT, this log).

- Decided to make Kiro the agent layer: custom agents in Kiro call the project's own MCP servers, so there are no paid LLM APIs. This removed the planned agent runtime and LLM provider code from the spec, which made the skeleton smaller.

- Chose one CLI app and one web UI app on the same skeleton, to show the template works across different interfaces. Added shared requirements so each app's CLI/UI and its MCP tools use the same logic.

- Pasted the official submission rules into Kiro and reviewed them together. This corrected an assumption (two separate GitHub repos) to one repo with two app folders, and added a submission-readiness requirement (license, `.kiro/` committed, deployable web UI).

- Finalized the two apps: "Graveyard Shift Inventory" (CLI photo sorter) and "The Witch's Pantry" (web UI food detection + recipes). Filled in Requirements 5 and 6 and wrote concrete property tests for each app's logic (grouping, recipe matching).
- Changed app 1 mid-build, after the skeleton was done. Kiro was asked for a better idea than the photo sorter and proposed three, judged against what had been measured: COCO-SSD detects 80 classes with boxes, about 5 s per image, and is sometimes wrong. The "Poltergeist Detector" (compare a before and an after photo, report what appeared, vanished or moved) won because it uses the bounding boxes, has a clear demo moment, and gives better property tests (every detection reported exactly once, swapping the photos swaps appeared and vanished). Because the spec was the source of truth, the swap meant editing requirements 5 and 10.5 to 10.6, `design.md`, `tasks.md`, the steering file and `AGENTS.md`, and renaming the app folder, and `pnpm typecheck` and `pnpm test` stayed green. A new Spike E was added first, since noisy detections across two photos are the idea's main risk.

- Researched the MCP TypeScript SDK, TensorFlow.js Node backends, and food-classifier options before writing `design.md`, instead of assuming the first library guess was right. This caught two real issues: local Node (18.20.4) is below the MCP SDK v2's minimum (20+), and COCO-SSD has almost no food classes, which is why the design adds a swappable model-adapter layer and a `Detection` shape that supports both boxes (COCO-SSD) and whole-image labels (MobileNet-style food classifier).

- Wrote `tasks.md` with each task tied to requirement numbers, spikes placed first to test the riskiest assumptions, and a must-have vs stretch split with an explicit cut order.
- Added a stretch feature mid-spec: nutrition, a Curse Level (0 to 100) and Potion Purity labels for the Witch's Pantry, with a "Best match" / "Purest first" toggle. Because it sits in its own requirement (14) marked stretch, the core app does not depend on it, and its scoring rules became property tests (bounds, monotonicity, scaling invariance).

### Spec vs. vibe coding

- 

## Steering docs

- Updated `AGENTS.md` (always loaded by Kiro) with the project overview, architecture, and hard rules: no paid APIs, never ignore `.kiro/`, skeleton stays generic. This keeps the decisions from the spec in every conversation.

## MCP

- Phase 3 (tasks 9 to 14): Kiro built the detection core, both model adapters, the Node image loader and the MCP server kit, and checked each against the real SDK instead of assuming its API. Two typing problems came from reading the SDK's own `.d.mts` files: `serveStdio` returns a handle, not a promise, and `registerTool` needs a Standard Schema type that a plain `ZodType` does not satisfy. Checkpoint 14 ran a real server with the real COCO-SSD model over stdio on the sample photos, and showed the model calling a potato a cake at 0.93 confidence, which is why Spike C's "chips first" decision matters.
- Spike A (task 3): a one-tool MCP server was registered in `.kiro/settings/mcp.json` and called from Kiro. Findings: the server only showed up after a window reload, Kiro runs servers from the workspace root so relative `args` work, and `node --import tsx` runs TypeScript with no build step. A raw stdio check confirmed stdout carries only protocol messages and bad input returns an error result without stopping the server. Details are in `design.md`.

- Spike B (task 4): ran COCO-SSD on the pure-JS CPU backend (`@tensorflow/tfjs` 4.22.0) with `jpeg-js` and `pngjs` decoders in Node 22.23.0. Measured ~5.6 s cold model load (one-time) and **4.8–6.4 s per-image inference** on 4 real food photos (avg 5.2 s). Inference is flat across image sizes — the bottleneck is JS execution, not pixel upload. Detection quality on real photos was usable: bowl, broccoli, carrot, orange, banana all detected. Discovered that `tf.browser.fromPixels` in Node needs `{ data: Buffer, width, height }` where `data instanceof Uint8Array` — passing a re-wrapped `Uint8Array` view breaks the internal check. Decision: document `@tensorflow/tfjs-node` as an optional speed-up, not a requirement. Details in `design.md`.

- Task 17 (wiring the Poltergeist Detector into Kiro): the server would not connect — `mcpGateway.log` only said "Connection closed". Kiro helped trace it: the server ran fine standalone under Node 22, but Kiro spawns MCP servers in a minimal, non-interactive environment that never runs `nvm use`, so `node` fell through to an old system binary (Node 16/18, via `/usr/local/bin/node` and a leftover Volta shim). Node 16 rejects `--import` outright, so the process died instantly. The machine had three Node managers fighting over PATH (nvm, Volta, a root `/usr/local/bin/node`), and macOS's `path_helper` kept re-prioritising the system one on login shells. Fix: each app ships `mcp-launch.sh`, a POSIX launcher that loads nvm, picks the `.nvmrc` version, and execs the server (nvm chatter to stderr so stdout stays clean); `mcp.json` and the agent run it via `sh`. One launcher per app, no shared root script, so every app stays self-contained. After switching to the launcher the server connected. The README must warn users to make Node 22 the default when they are not on nvm.

- Checkpoint 18 (Phase 4, Poltergeist Detector): the CLI was run end to end on all three sample before/after pairs. `tomatoes` reported a dining table appeared and an apple vanished; `apple` reported nothing detected (with the "take clearer photos" hint); `one_apple` reported a dining table vanished. `--json` produced the same structure, and a missing photo exited 1 naming the "before" file. The same compare was driven through the MCP `compare_scenes` tool inside Kiro and returned the identical result, confirming the CLI and the MCP tool share one `compareScenes` function. As Spike E predicted, the changes COCO-SSD reports between near-identical frames are mostly label flicker (tomato read as apple, a table edge appearing and disappearing), which is why the UI copy and the agent prompt both warn that a lone appeared/vanished is unreliable and only a matched "moved" is trustworthy.

- Task 21 (Witch's Pantry MCP server + agent): the server registers `suggest_recipes` alongside the built-in detect/count tools and reuses the exact `suggestRecipes` function and recipe dataset the web UI uses, so there is one source of truth. Driven live in Kiro through the `witches-pantry` agent, `suggest_recipes(["onion","garlic","tomato"])` returned 21 potions best-match-first, with Crimson Hex Soup top (all three matched, only basil and cream missing). The agent prompt enforces the "ingredients and amounts only, no medical advice" rule.

- Task 22 (deploy): added a GitHub Pages Actions workflow (`.github/workflows/deploy-pantry.yml`) that builds only the web UI and derives the Vite `base` from the repo name at build time (`VITE_BASE=/${{ github.event.repository.name }}/`), so local dev stays at `/` and production serves from `/<repo>/` without hardcoding. Verified locally with `vite preview` at the subpath: index and assets resolve (HTTP 200). First-load JS bundle (app + TensorFlow.js runtime) is ~1.23 MB, ~319 KB gzipped; the MobileNet weights (~14 MB) download separately from TF Hub on first detection. The first deploy 404'd because Pages was not enabled yet; after setting Pages Source to "GitHub Actions" the re-run went green. Live at https://dignat.github.io/kiroween-skeleton-crew/.

- Checkpoint 23 (Phase 5): used the deployed app with 5 real photos. Results confirmed Spike C exactly. A fruit photo recognized only banana (missing the rest). A cooked/ready-food photo recognized no ingredients at all. A dark veg photo with tomatoes and pepper produced a wrong "orange". A clean, background-free veg photo recognized broccoli and cucumber (the best case, a clear single-ish subject). A tomatoes-and-cucumber photo recognized only cucumber. So whole-image MobileNet detection is weak and inconsistent on real food: it works best on one clear item against a plain background, misses most multi-item scenes, and sometimes mislabels. This is why the design makes the editable chips and quick-add the primary input and detection only a helper; in every weak case the user can finish the ingredient list by hand and still get recipe matches. No code change was triggered, the behaviour matches the documented decision.

## Property-based testing

- **A property test found a real bug in how the kit meets the SDK.** The "registering any name twice is rejected" property used arbitrary strings, and fast-check shrank a failure to the name `valueOf`: the SDK keeps tools in a plain object, so `valueOf`, `toString` and `constructor` count as "already registered" on first use. The fix was to enforce snake_case tool names, which the steering file already required, with a clear error, and to keep `constructor` reserved.
- **Mutation checks showed the tests can fail.** For the confidence filter, the label counter, the folder-containment check and the stdout redirect, a deliberate bug was introduced, the tests were run to see them fail, and the code was restored. That caught nothing wrong, but it confirmed that each property is not vacuous.
- Properties written so far: confidence filter keeps only detections at or above the threshold, label counts sum to the number of detections (both unit-level and through a real MCP client), duplicate tool names are always rejected, input that fails a schema never reaches the handler, and any bytes that are not JPEG or PNG are rejected with `UnsupportedImageError`.
- 

## Kiro powers

- 

## Submission checklist (not scored by Kiro, but required by Devpost)

- [ ] Public GitHub repo, license visible in About section, `.kiro/` committed
- [ ] Web UI deployed and reachable at a public URL
- [ ] CLI run instructions in its app README
- [ ] Devpost text description written
- [ ] Demo video (≤3 min, public on YouTube, no copyrighted music, shows real usage)
- [ ] This file finished and linked from the submission
- [ ] Blog post published during the submission period, mentions "Kiroween Hackathon 2026"
- [ ] Social post published, starts with `#KiroweenHackathon26`, written by hand (not AI-generated)

