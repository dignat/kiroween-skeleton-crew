// The Witch's Pantry: app logic entry point.
// The web UI (task 20) and the suggest_recipes MCP tool (task 21) both use this logic.

import { SKELETON_NAME } from '@skeleton-crew/core';

export const APP_NAME = 'witches-pantry';
export const BUILT_ON = SKELETON_NAME;

export { recipes } from './recipes.js';
export { suggestRecipes } from './suggest-recipes.js';
export { normalizeIngredient, normalizeIngredients } from './ingredient-map.js';
export { nutritionTable, nutritionTableSchema } from './nutrition.js';
export {
  nutritionPerServing,
  curseLevel,
  potionPurity,
  dominantCurse,
  DAILY_VALUES,
  CURSE_WEIGHTS,
} from './nutrition-math.js';
export {
  isVegetarian,
  passesFilter,
  applyFilters,
  describeFilters,
  FILTER_INFO,
  FILTER_THRESHOLDS,
} from './dietary-filters.js';
export { assessFoodRelevance } from './food-relevance.js';
export type { FoodRelevanceResult } from './food-relevance.js';
export {
  recipeSchema,
  recipeDatasetSchema,
  recipeIngredientSchema,
} from './recipe-schema.js';
export type {
  Recipe,
  RecipeIngredient,
  RecipeMatch,
  Nutrition,
  NutritionEntry,
  NutritionTable,
  Purity,
  SuggestOptions,
  DietaryFilter,
} from './types.js';
