// Food-relevance guardrail for the Witch's Pantry. Pure, browser-safe.
//
// This is a RELEVANCE check, not content moderation. It decides whether an
// image looks like food by whether the food detector recognized any food
// ingredients in it (after the allowlist + normalization the app already uses).
// It does NOT, and cannot, detect harmful or inappropriate content — that would
// need a dedicated safety classifier, which is out of scope here (no paid/keyed
// services). The app is honest about this: it gates to food-relevant images.

import type { Detection } from '@skeleton-crew/core';
import { normalizeIngredients } from './ingredient-map.js';

export interface FoodRelevanceResult {
  /** True if at least one recognized ingredient came out of the detections. */
  isFood: boolean;
  /** The normalized ingredient names found (may be empty). */
  ingredients: string[];
  /** A neutral, user-facing message describing the outcome. */
  message: string;
}

/**
 * Judges whether detections indicate a food image, and returns the normalized
 * ingredients plus a friendly message. Pure: no I/O, no model calls.
 */
export function assessFoodRelevance(detections: readonly Detection[]): FoodRelevanceResult {
  const ingredients = normalizeIngredients(detections.map((d) => d.label));
  if (ingredients.length > 0) {
    return {
      isFood: true,
      ingredients,
      message: `Found possible ingredients: ${ingredients.join(', ')}. Please check them below.`,
    };
  }
  return {
    isFood: false,
    ingredients: [],
    message:
      "That doesn't look like food to the cauldron. Try a photo of ingredients — fruit, " +
      'vegetables, or what is on your shelf — or add ingredients by hand below.',
  };
}
