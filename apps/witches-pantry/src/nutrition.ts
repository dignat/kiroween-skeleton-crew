// Loads and validates the per-100 g nutrition table (task 24.1). Browser-safe:
// a static JSON import, not a file read. Values come from USDA FoodData Central
// (CC0, confirmed in Spike D); each entry carries a `source` field.

import { z } from 'zod';
import rawNutrition from './data/nutrition.json' with { type: 'json' };
import type { NutritionTable } from './types.js';

const nutritionEntrySchema = z.object({
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  satFat: z.number().nonnegative(),
  fibre: z.number().nonnegative(),
  sodiumMg: z.number().nonnegative(),
  addedSugar: z.number().nonnegative(),
  source: z.string().min(1),
});

export const nutritionTableSchema = z.record(z.string(), nutritionEntrySchema);

/** The validated nutrition table, keyed by normalized ingredient name. */
export const nutritionTable: NutritionTable = nutritionTableSchema.parse(rawNutrition.ingredients);
