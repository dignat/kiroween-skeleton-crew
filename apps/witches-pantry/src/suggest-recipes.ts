// Recipe matching (task 19.3). Pure function, no I/O. Browser-safe.
// Matches on normalized ingredient names only, so the core flow does not depend
// on the nutrition work (design.md). Passing a nutritionTable enriches each match
// and enables the 'purity' sort (Phase 6, task 25.3).

import { normalizeIngredient } from './ingredient-map.js';
import { curseLevel, nutritionPerServing, potionPurity } from './nutrition-math.js';
import type { Recipe, RecipeMatch, SuggestOptions } from './types.js';

/** The set of distinct normalized ingredient names in a recipe. */
function recipeIngredientNames(recipe: Recipe): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const ing of recipe.ingredients) {
    const name = ing.name.toLowerCase();
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/**
 * Suggests recipes for the ingredients the user has.
 *
 * - Input names are normalized (so "Granny Smith" and "apples" both match "apple").
 * - For each recipe, splits its ingredient names into matched (user has it) and
 *   missing (user does not).
 * - Returns only recipes with at least one matched ingredient (Requirement 10.7).
 * - Sorts by matched count descending; ties keep the dataset order (stable).
 */
export function suggestRecipes(
  haveIngredients: readonly string[],
  recipes: readonly Recipe[],
  options: SuggestOptions = {},
): RecipeMatch[] {
  // Normalize what the user has into a lookup set.
  const have = new Set<string>();
  for (const raw of haveIngredients) {
    const name = normalizeIngredient(raw);
    // Also accept an already-normalized name the mapping doesn't list as a synonym.
    have.add(name ?? raw.trim().toLowerCase());
  }
  have.delete('');

  const matches: RecipeMatch[] = [];
  for (const recipe of recipes) {
    const names = recipeIngredientNames(recipe);
    const matched: string[] = [];
    const missing: string[] = [];
    for (const name of names) {
      if (have.has(name)) matched.push(name);
      else missing.push(name);
    }
    if (matched.length > 0) {
      const match: RecipeMatch = { recipe, matched, missing };
      // Enrich with nutrition when a table is supplied (Requirement 14.11).
      if (options.nutritionTable) {
        const nutrition = nutritionPerServing(recipe, options.nutritionTable);
        const level = curseLevel(nutrition);
        match.nutrition = nutrition;
        match.curseLevel = level;
        match.purity = potionPurity(level);
      }
      matches.push(match);
    }
  }

  // Stable sort by matched count descending. Array.prototype.sort is stable in
  // modern engines, so equal counts keep their dataset order.
  matches.sort((a, b) => b.matched.length - a.matched.length);

  // 'purity' sort: lowest Curse Level first (purest). Only meaningful when a
  // nutrition table was supplied; without curseLevel it falls back to match order.
  if (options.sortBy === 'purity') {
    matches.sort((a, b) => (a.curseLevel ?? Infinity) - (b.curseLevel ?? Infinity));
  }

  return matches;
}
