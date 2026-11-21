# Branch notes: `agent-reviewer` (not in main yet)

> **Reminder.** These changes live on the `agent-reviewer` branch and may never be pushed or merged.
> `KIRO_USAGE.md` and `docs/` are git-ignored, so I did **not** edit them. The text below is ready to paste
> into them if and when the branch lands. Until then, nothing in `KIRO_USAGE.md` or `docs/` describes this work.
> Delete this file if the branch is dropped.

## What the branch changes (tracked files)

- `packages/skeleton`: per-label confidence, box limits (pixels and image fraction), context rules, non-maximum
  suppression, `InferMeta` / `detectWithInfo` (image size), and the review kit (`get_detections`, `submit_review`).
  README and CHANGELOG are updated.
- `apps/poltergeist-detector`: `--scene kitchen|outdoor` (CLI) and `scene` (`compare_scenes`), with the signal lists in
  `src/scene-context.ts`. Review tools added to its MCP server.
- `apps/witches-pantry`: review tools added, and `suggest_recipes` now needs a `reviewId` from an accepted review
  (or `ingredientsSource: "user"`). The gate is `src/review-gate.ts`.
- `.kiro/agents/poltergeist-detector.json` and `.kiro/agents/witches-pantry.json`: reviewer prompts, new tools.

Checks run on this branch: typecheck clean, and the test suites passed (skeleton 235 passed and 3 skipped,
poltergeist-detector 56, witches-pantry 64). The agents have **not** been run against a real model in Kiro yet, so
nothing below claims how well they follow the reviewer prompt.

## Paste into `KIRO_USAGE.md` (when merged)

**At a glance table, "Custom agents" row:** add "The two app agents also act as reviewers of their own detections."

**Custom agents table:** change the two app rows to:

| `poltergeist-detector` | App agent (calls MCP) | Compares before/after photos with `compare_scenes`, then reviews the detections behind each finding with `get_detections` and `submit_review` (confirmed, rejected or uncertain). |
| `witches-pantry` | App agent (calls MCP) | Calls `check_image`, reviews the detected ingredients, then calls `suggest_recipes`, which requires an accepted review for photo ingredients. |

**New bullet under Custom agents:**
- **Reviewer role for the app agents.** The agents were extended to verify the detector's output instead of repeating it.
  I gave Kiro a list of prompt principles (say what the detector is, pass structured JSON, allow "uncertain", forbid
  invention, evidence before verdict, validate the output and retry). Kiro split them by what a prompt can and cannot
  do: a prompt cannot enforce a schema, so validation went into a `submit_review` MCP tool that checks ids, duplicates and
  missing verdicts and returns an error the agent must fix. `get_detections` returns the image size, which the existing
  tools did not. Principles that needed measured data (per-class score thresholds, known confusions, worked examples)
  were left out on purpose because the repo has no such measurements. Not yet run against a real model.

**MCP table:** poltergeist-detector gains `get_detections`, `submit_review`; witches-pantry gains the same two.

**New bullet under "Where Kiro changed the outcome":**
- **Review gate on `suggest_recipes`.** Kiro pointed out that a prompt alone cannot force the review step, so
  `suggest_recipes` refuses photo ingredients without an accepted `reviewId`. It also kept an escape hatch
  (`ingredientsSource: "user"`) because hand-typed ingredients have no photo to review, and it warns about, but does not
  block, ingredients the review rejected, since the user may overrule it. The gate only proves a review happened, not
  that the ingredients match the photo.

## Paste into `docs/` (when merged)

- `docs/devpost.md`, after the line about the Kiro agents driving each app: "Both agents also review the detector's
  output. Each detection gets a verdict (confirmed, rejected or uncertain) with evidence, checked by an MCP tool that
  rejects malformed reviews, and the recipe tool refuses photo ingredients that were never reviewed."
- `docs/blog-post.md`, in the custom agents paragraph: "The app agents became reviewers: a prompt can ask for evidence
  before a verdict, but only code can enforce the format, so a `submit_review` tool validates every review."
- `docs/video-script.md`, optional demo beat: in the `witches-pantry` agent, ask for recipes from
  `samples/fridge-salad-drawer.jpg`. On screen: `get_detections`, `submit_review`, then `suggest_recipes` with a `reviewId`.
  Say only what the run actually shows.
