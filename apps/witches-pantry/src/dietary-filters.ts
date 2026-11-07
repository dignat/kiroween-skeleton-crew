// Dietary preference filters for the Witch's Pantry. Pure, browser-safe.
//
// These are a USER CHOICE that narrows the recipe list by objective properties
// of each recipe. They are NOT dietary or medical advice: a filter describes the
// recipe ("no meat", "lower in added sugar"), never a person or a health goal.
// The thresholds below are plain cut-offs for filtering, not nutrition targets.

import type { DietaryFilter, Nutrition, Recipe, RecipeMatch } from './types.js';

/** Ingredient names (normalized) that make a recipe non-vegetarian. */
const MEAT_INGREDIENTS: ReadonlySet<string> = new Set([
  'beef',
  'chicken',
  'bacon',
  'pork',
  'lamb',
  'fish',
  'ham',
  'sausage',
  'turkey',
]);

/** Per-serving cut-offs used by the filters. Objective, tunable, not health targets. */
export const FILTER_THRESHOLDS = {
  /** added sugar (g) at or below this counts as lower-sugar */
  lowerSugarMaxG: 5,
  /** sodium (mg) at or below this counts as lower-sodium */
  lowerSodiumMaxMg: 400,
  /** fibre (g) at or above this counts as higher-fibre */
  higherFibreMinG: 5,
  /** protein (g) at or above this counts as higher-protein */
  higherProteinMinG: 15,
  /** calories at or below this count as lighter */
  lighterMaxKcal: 250,
} as const;

/** Themed label and a neutral, recipe-describing caption for each filter. */
export const FILTER_INFO: Record<DietaryFilter, { label: string; describes: string }> = {
  vegetarian: { label: 'Garden-born', describes: 'no meat, poultry or fish' },
  lowerSugar: { label: 'Unsweetened hex', describes: `added sugar ≤ ${FILTER_THRESHOLDS.lowerSugarMaxG} g per serving` },
  lowerSodium: { label: 'Unsalted charm', describes: `sodium ≤ ${FILTER_THRESHOLDS.lowerSodiumMaxMg} mg per serving` },
  higherFibre: { label: 'Rootbound', describes: `fibre ≥ ${FILTER_THRESHOLDS.higherFibreMinG} g per serving` },
  higherProtein: { label: 'Strengthening', describes: `protein ≥ ${FILTER_THRESHOLDS.higherProteinMinG} g per serving` },
  lighter: { label: 'Faint brew', describes: `≤ ${FILTER_THRESHOLDS.lighterMaxKcal} kcal per serving` },
};

/** True if the recipe uses no meat, poultry or fish. Works from names alone. */
export function isVegetarian(recipe: Recipe): boolean {
  return !recipe.ingredients.some((i) => MEAT_INGREDIENTS.has(i.name.toLowerCase()));
}

/**
 * Whether a recipe match passes one filter. Nutrition-based filters need the
 * match to carry `nutrition` (i.e. suggestRecipes was given a nutritionTable);
 * if it is missing, those filters pass through rather than wrongly excluding.
 */
export function passesFilter(match: RecipeMatch, filter: DietaryFilter): boolean {
  if (filter === 'vegetarian') return isVegetarian(match.recipe);

  const n: Nutrition | undefined = match.nutrition;
  if (!n) return true; // no nutrition to judge by: do not exclude

  switch (filter) {
    case 'lowerSugar':
      return n.addedSugar <= FILTER_THRESHOLDS.lowerSugarMaxG;
    case 'lowerSodium':
      return n.sodiumMg <= FILTER_THRESHOLDS.lowerSodiumMaxMg;
    case 'higherFibre':
      return n.fibre >= FILTER_THRESHOLDS.higherFibreMinG;
    case 'higherProtein':
      return n.protein >= FILTER_THRESHOLDS.higherProteinMinG;
    case 'lighter':
      return n.kcal <= FILTER_THRESHOLDS.lighterMaxKcal;
    default:
      return true;
  }
}

/** Keeps only matches that pass every selected filter (AND). Empty filters = no change. */
export function applyFilters(
  matches: readonly RecipeMatch[],
  filters: readonly DietaryFilter[],
): RecipeMatch[] {
  if (filters.length === 0) return [...matches];
  return matches.filter((m) => filters.every((f) => passesFilter(m, f)));
}

/** A neutral one-line description of what the active filters show (not advice). */
export function describeFilters(filters: readonly DietaryFilter[]): string {
  if (filters.length === 0) return '';
  const parts = filters.map((f) => FILTER_INFO[f].describes);
  return `Showing potions with ${parts.join(', and ')}.`;
}
