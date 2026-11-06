import { describe, expect, it } from 'vitest';
import { recipes } from './recipes.js';
import { recipeDatasetSchema } from './recipe-schema.js';

describe('recipe dataset (Requirement 6.15, 14.1)', () => {
  it('loads and validates against the schema', () => {
    // recipes is already parsed at import; re-parse to assert explicitly.
    expect(() => recipeDatasetSchema.parse(recipes)).not.toThrow();
  });

  it('has at least 25 recipes', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(25);
  });

  it('has unique ids', () => {
    const ids = recipes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses normalized (lower-case) ingredient names', () => {
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        expect(ing.name).toBe(ing.name.toLowerCase());
      }
    }
  });

  it('has positive grams and servings everywhere', () => {
    for (const recipe of recipes) {
      expect(recipe.servings).toBeGreaterThan(0);
      for (const ing of recipe.ingredients) {
        expect(ing.grams).toBeGreaterThan(0);
      }
    }
  });

  it('every recipe has at least one step', () => {
    for (const recipe of recipes) {
      expect(recipe.steps.length).toBeGreaterThan(0);
    }
  });
});
