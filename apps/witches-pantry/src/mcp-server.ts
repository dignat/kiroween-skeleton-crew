#!/usr/bin/env -S node --import tsx
// The Witch's Pantry MCP server (task 21.1). Registers `suggest_recipes` on top
// of the skeleton's built-in detect_objects / count_objects, using the same
// suggestRecipes logic and recipe dataset as the web UI (Requirement 6.14).
//
// Node-only. It must not import the browser decoder (browser-image-decoder.ts).
// The recipe logic modules it imports are browser-safe and have no DOM use.

import {
  createAppServer,
  defineTool,
  jsonResult,
  serveApp,
  z,
} from '@skeleton-crew/core/node';
import { assessFoodRelevance } from './food-relevance.js';
import { normalizeIngredients } from './ingredient-map.js';
import { createFoodDetector } from './node-detector.js';
import { nutritionTable } from './nutrition.js';
import { recipes } from './recipes.js';
import { suggestRecipes } from './suggest-recipes.js';

const SERVER_NAME = 'witches-pantry';
const SERVER_VERSION = '0.1.0';

const suggestInput = z.object({
  ingredients: z
    .array(z.string().min(1))
    .min(1)
    .describe('Ingredient names you have, for example ["onion","tomato","garlic"]. Synonyms are accepted.'),
  sortBy: z
    .enum(['match', 'purity'])
    .optional()
    .describe('Sort order. "match" (default) is by number of matched ingredients. "purity" sorts by ascending Curse Level (purest first).'),
  filters: z
    .array(z.enum(['vegetarian', 'lowerSugar', 'lowerSodium', 'higherFibre', 'higherProtein', 'lighter']))
    .optional()
    .describe(
      'Dietary preference filters (a choice, not advice). All must pass. They describe the recipe: ' +
      'vegetarian (no meat/poultry/fish), lowerSugar, lowerSodium, higherFibre, higherProtein, lighter (fewer calories per serving).',
    ),
});

const checkImageInput = z.object({
  imagePath: z
    .string()
    .min(1)
    .describe('Path to a JPEG or PNG image, resolved inside the allowed images folder.'),
});

/** Builds the server: built-in tools plus this app's tools, sharing one detector. */
export function createServer() {
  const allowedRoot = process.cwd();
  const detector = createFoodDetector(allowedRoot);

  const suggestRecipesTool = defineTool({
    name: 'suggest_recipes',
    description:
      'Suggest potion recipes for the ingredients you have. Returns recipes that match at least ' +
      'one ingredient, each with the ingredients you have and the ones you still need, best match first.',
    inputSchema: suggestInput,
    handler: async (input) => {
      // Normalize synonyms the same way the UI does, keeping names the mapping
      // does not list (so a user can name an ingredient the detector never sees).
      const normalized = normalizeIngredients(input.ingredients);
      const extras = input.ingredients
        .map((i) => i.trim().toLowerCase())
        .filter((i) => i.length > 0 && !normalized.includes(i));
      const have = Array.from(new Set([...normalized, ...extras]));

      const matches = suggestRecipes(have, recipes, {
        sortBy: input.sortBy ?? 'match',
        nutritionTable,
        filters: input.filters,
      });

      // Return a compact, model-friendly shape (not the full Recipe objects),
      // including per-serving nutrition, Curse Level and purity (Requirement 14.11).
      const round1 = (x: number): number => Math.round(x * 10) / 10;
      const result = matches.map((m) => ({
        id: m.recipe.id,
        name: m.recipe.name,
        servings: m.recipe.servings,
        matched: m.matched,
        missing: m.missing,
        curseLevel: m.curseLevel,
        purity: m.purity,
        nutritionPerServing: m.nutrition
          ? {
              kcal: Math.round(m.nutrition.kcal),
              protein: round1(m.nutrition.protein),
              carbs: round1(m.nutrition.carbs),
              fat: round1(m.nutrition.fat),
              satFat: round1(m.nutrition.satFat),
              fibre: round1(m.nutrition.fibre),
              sodiumMg: Math.round(m.nutrition.sodiumMg),
              addedSugar: round1(m.nutrition.addedSugar),
            }
          : undefined,
      }));
      return jsonResult({ have, count: result.length, recipes: result });
    },
  });

  const checkImageTool = defineTool({
    name: 'check_image',
    description:
      'Check whether an image looks like food before suggesting recipes. Runs the food detector ' +
      'and reports whether any ingredients were recognized, the ingredient names, and a message. ' +
      'This is a relevance check (is this a food photo?), not content moderation — it cannot judge ' +
      'whether an image is harmful or inappropriate. Use it to decline non-food images politely.',
    inputSchema: checkImageInput,
    handler: async (input) => {
      const detections = await detector.detect({ kind: 'filePath', path: input.imagePath });
      const assessment = assessFoodRelevance(detections);
      return jsonResult(assessment);
    },
  });

  return createAppServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    detector,
    tools: [suggestRecipesTool, checkImageTool],
  });
}

// Only serve when invoked directly, not when imported by tests.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  serveApp(SERVER_NAME, createServer);
}
