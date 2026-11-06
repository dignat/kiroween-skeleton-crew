// Nutrition maths for the Curse Level feature (task 25). Pure functions,
// browser-safe. Formula and weights follow design.md (Requirement 14). The
// weights are a playful design choice, not science; the UI says so.

import type { Nutrition, NutritionTable, Purity, Recipe } from './types.js';

/** FDA Daily Values used as references (confirmed against the source in Spike D). */
export const DAILY_VALUES = {
  sodiumMg: 2300,
  satFat: 20,
  addedSugar: 50,
  fibre: 28,
  protein: 50,
} as const;

/** Curse Level weights (a first-draft, playful choice; see design.md). */
export const CURSE_WEIGHTS = {
  sodium: 0.35,
  satFat: 0.35,
  addedSugar: 0.3,
  antidoteFibre: 0.5,
  antidoteProtein: 0.5,
  antidoteFactor: 0.25,
} as const;

const EMPTY_NUTRITION: Nutrition = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  satFat: 0,
  fibre: 0,
  sodiumMg: 0,
  addedSugar: 0,
};

/**
 * Per-serving nutrition for a recipe (Requirement 14.4).
 * Each ingredient contributes (grams / 100) * its per-100 g values; the recipe
 * total is divided by the serving count. Ingredients missing from the table
 * contribute nothing (they are rare and the data-check test guards coverage).
 */
export function nutritionPerServing(recipe: Recipe, table: NutritionTable): Nutrition {
  const total: Nutrition = { ...EMPTY_NUTRITION };
  for (const ing of recipe.ingredients) {
    const entry = table[ing.name];
    if (!entry) continue;
    const factor = ing.grams / 100;
    total.kcal += entry.kcal * factor;
    total.protein += entry.protein * factor;
    total.carbs += entry.carbs * factor;
    total.fat += entry.fat * factor;
    total.satFat += entry.satFat * factor;
    total.fibre += entry.fibre * factor;
    total.sodiumMg += entry.sodiumMg * factor;
    total.addedSugar += entry.addedSugar * factor;
  }
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return {
    kcal: total.kcal / servings,
    protein: total.protein / servings,
    carbs: total.carbs / servings,
    fat: total.fat / servings,
    satFat: total.satFat / servings,
    fibre: total.fibre / servings,
    sodiumMg: total.sodiumMg / servings,
    addedSugar: total.addedSugar / servings,
  };
}

/** amount / (⅓ of the daily value), clamped to 0..1. */
function ratio(amount: number, dailyValue: number): number {
  const r = amount / (dailyValue / 3);
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}

/**
 * Curse Level, 0 to 100, integer (Requirement 14.5).
 * Rises with sodium, saturated fat and added sugar; the antidote (fibre and
 * protein) can only lower it. Always within 0..100 by construction.
 */
export function curseLevel(n: Nutrition): number {
  const sodiumRatio = ratio(n.sodiumMg, DAILY_VALUES.sodiumMg);
  const satFatRatio = ratio(n.satFat, DAILY_VALUES.satFat);
  const addedSugarRatio = ratio(n.addedSugar, DAILY_VALUES.addedSugar);
  const fibreRatio = ratio(n.fibre, DAILY_VALUES.fibre);
  const proteinRatio = ratio(n.protein, DAILY_VALUES.protein);

  const penalty =
    100 *
    (CURSE_WEIGHTS.sodium * sodiumRatio +
      CURSE_WEIGHTS.satFat * satFatRatio +
      CURSE_WEIGHTS.addedSugar * addedSugarRatio);

  const antidote =
    CURSE_WEIGHTS.antidoteFibre * fibreRatio + CURSE_WEIGHTS.antidoteProtein * proteinRatio;

  const level = penalty * (1 - CURSE_WEIGHTS.antidoteFactor * antidote);
  return Math.round(level);
}

/** Purity label from a Curse Level (Requirement 14.6). */
export function potionPurity(level: number): Purity {
  if (level <= 33) return 'Pure';
  if (level <= 66) return 'Murky';
  return 'Cursed';
}

/**
 * The nutrient contributing most to the Curse Level, used to word the tip.
 * Returns null when nothing meaningfully contributes (a calm potion).
 */
export function dominantCurse(n: Nutrition): 'sodium' | 'saturatedFat' | 'addedSugar' | null {
  const contributions: Array<['sodium' | 'saturatedFat' | 'addedSugar', number]> = [
    ['sodium', CURSE_WEIGHTS.sodium * ratio(n.sodiumMg, DAILY_VALUES.sodiumMg)],
    ['saturatedFat', CURSE_WEIGHTS.satFat * ratio(n.satFat, DAILY_VALUES.satFat)],
    ['addedSugar', CURSE_WEIGHTS.addedSugar * ratio(n.addedSugar, DAILY_VALUES.addedSugar)],
  ];
  let best: 'sodium' | 'saturatedFat' | 'addedSugar' | null = null;
  let bestValue = 0;
  for (const [name, value] of contributions) {
    if (value > bestValue) {
      bestValue = value;
      best = name;
    }
  }
  return best;
}
