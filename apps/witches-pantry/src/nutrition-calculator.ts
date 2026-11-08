// The Cauldron Calculator: pure nutrition-calculator logic (nutrition-calculator
// feature). Browser-safe, no Node imports. Shared by the standalone UI view and
// the `calculate_nutrition` MCP tool so both compute identical numbers.
//
// Framing note: daily targets are the user's OWN numbers. This module never
// supplies recommended or default target values and never judges a food as good
// or bad. `percentOfTargets` is plain arithmetic against numbers the caller
// typed in. It is a choice, not advice.

import type { Nutrition, NutritionTable } from './types.js';

/** The eight nutrient keys of the `Nutrition` shape. */
export const NUTRIENT_KEYS = [
  'kcal',
  'protein',
  'carbs',
  'fat',
  'satFat',
  'fibre',
  'sodiumMg',
  'addedSugar',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

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
 * One line item in the calculator: an ingredient name and an amount in grams.
 * Detected ingredients, recipe ingredients and hand-entered ("manual") items
 * all use this same shape, so they flow through the maths identically.
 */
export interface CalculatorIngredient {
  /** Normalized, lower-case ingredient name, for example "onion". */
  name: string;
  /** Amount in grams. Negative amounts are treated as zero. */
  grams: number;
}

/**
 * The calculator's result for a list of ingredients.
 * `total` is the sum across all ingredients; `perServing` divides by `servings`.
 * `missing` names the ingredients with no entry in the nutrition table, so the
 * UI can say "no data for X" rather than silently dropping them.
 */
export interface CalculatorTotals {
  /** Summed nutrition across every ingredient that had data. */
  total: Nutrition;
  /** `total` divided by the serving count (servings >= 1). */
  perServing: Nutrition;
  /** Serving count actually used (clamped to at least 1). */
  servings: number;
  /** Names that contributed nutrition (found in the table). */
  counted: string[];
  /** Names with no nutrition data (contributed nothing). */
  missing: string[];
}

/** Clamp a number to a finite, non-negative value (NaN / -Infinity -> 0). */
function nonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/** Add ingredient `entry` scaled by `grams` into the running `total`. */
function addScaled(total: Nutrition, entry: Nutrition, grams: number): void {
  const factor = grams / 100;
  total.kcal += entry.kcal * factor;
  total.protein += entry.protein * factor;
  total.carbs += entry.carbs * factor;
  total.fat += entry.fat * factor;
  total.satFat += entry.satFat * factor;
  total.fibre += entry.fibre * factor;
  total.sodiumMg += entry.sodiumMg * factor;
  total.addedSugar += entry.addedSugar * factor;
}

/** Divide every nutrient of `n` by `divisor` (divisor >= 1 enforced by caller). */
function divide(n: Nutrition, divisor: number): Nutrition {
  return {
    kcal: n.kcal / divisor,
    protein: n.protein / divisor,
    carbs: n.carbs / divisor,
    fat: n.fat / divisor,
    satFat: n.satFat / divisor,
    fibre: n.fibre / divisor,
    sodiumMg: n.sodiumMg / divisor,
    addedSugar: n.addedSugar / divisor,
  };
}

/**
 * Sum nutrition across a list of ingredients and divide by the serving count.
 *
 * Each ingredient contributes (grams / 100) * its per-100 g table values.
 * Ingredients absent from the table contribute nothing and are reported in
 * `missing`. `servings` is clamped to at least 1 (a non-positive or non-finite
 * serving count is treated as a single serving).
 */
export function calculateTotals(
  ingredients: readonly CalculatorIngredient[],
  table: NutritionTable,
  servings = 1,
): CalculatorTotals {
  const total: Nutrition = { ...EMPTY_NUTRITION };
  const counted: string[] = [];
  const missing: string[] = [];

  for (const ing of ingredients) {
    const grams = nonNegative(ing.grams);
    const entry = table[ing.name];
    if (!entry) {
      missing.push(ing.name);
      continue;
    }
    addScaled(total, entry, grams);
    counted.push(ing.name);
  }

  const safeServings =
    Number.isFinite(servings) && servings >= 1 ? Math.floor(servings) : 1;

  return {
    total,
    perServing: divide(total, safeServings),
    servings: safeServings,
    counted,
    missing,
  };
}

/**
 * The user's own targets, the numbers they typed in. Every field is optional;
 * only the ones the user fills in are compared. This module NEVER populates
 * defaults — an empty object means "no targets given" and `percentOfTargets`
 * returns an empty result.
 *
 * Deliberately distinct from `DAILY_VALUES` in nutrition-math.ts: those are
 * fixed FDA reference figures the Curse Level uses internally. The calculator
 * never borrows them as targets — a target here is always the user's own.
 */
export type UserTargets = { [K in NutrientKey]?: number | undefined };

/** Percentage of a user target met by an amount (0..) for one nutrient. */
export interface TargetPercent {
  nutrient: NutrientKey;
  /** The amount being compared (from `total` or `perServing`). */
  amount: number;
  /** The user-entered target for this nutrient. */
  target: number;
  /** 100 * amount / target, rounded to one decimal. >= 0. */
  percent: number;
}

/**
 * Compare nutrition amounts against the user's own targets.
 *
 * Returns one entry per target the user actually provided (positive, finite).
 * Targets of zero or below, or nutrients the user left blank, are skipped — we
 * do not invent a target. This is arithmetic, not a recommendation: it says
 * "this is X% of the number you entered", nothing about whether that is good.
 */
export function percentOfTargets(
  amounts: Nutrition,
  targets: UserTargets,
): TargetPercent[] {
  const result: TargetPercent[] = [];
  for (const nutrient of NUTRIENT_KEYS) {
    const target = targets[nutrient];
    if (target === undefined || !Number.isFinite(target) || target <= 0) continue;
    const amount = nonNegative(amounts[nutrient]);
    const percent = Math.round((100 * amount) / target * 10) / 10;
    result.push({ nutrient, amount, target, percent });
  }
  return result;
}
