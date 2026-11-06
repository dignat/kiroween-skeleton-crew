import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { recipes } from './recipes.js';
import { suggestRecipes } from './suggest-recipes.js';
import type { Recipe } from './types.js';

// Pool of normalized ingredient names drawn from the real dataset, so generated
// ingredient lists actually match recipes often enough to be meaningful.
const ingredientPool = Array.from(
  new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.name))),
);

const haveArb = fc.uniqueArray(fc.constantFrom(...ingredientPool), { maxLength: ingredientPool.length });

/** Distinct normalized ingredient names of a recipe (mirrors the function's view). */
function namesOf(recipe: Recipe): string[] {
  return Array.from(new Set(recipe.ingredients.map((i) => i.name.toLowerCase())));
}

describe('suggestRecipes properties (Requirements 10.7, 10.8, 10.9)', () => {
  it('every returned recipe matches at least one ingredient (10.7)', () => {
    fc.assert(
      fc.property(haveArb, (have) => {
        for (const m of suggestRecipes(have, recipes)) {
          expect(m.matched.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('matched + missing equals the recipe ingredient names, with no overlap (10.9)', () => {
    fc.assert(
      fc.property(haveArb, (have) => {
        for (const m of suggestRecipes(have, recipes)) {
          const union = new Set([...m.matched, ...m.missing]);
          expect(union).toEqual(new Set(namesOf(m.recipe)));
          // No overlap: sizes add up.
          expect(m.matched.length + m.missing.length).toBe(namesOf(m.recipe).length);
          const overlap = m.matched.filter((x) => m.missing.includes(x));
          expect(overlap).toEqual([]);
        }
      }),
    );
  });

  it('adding an ingredient never lowers a recipe matched count (10.8)', () => {
    fc.assert(
      fc.property(haveArb, fc.constantFrom(...ingredientPool), (have, extra) => {
        const before = new Map(
          suggestRecipes(have, recipes).map((m) => [m.recipe.id, m.matched.length]),
        );
        const after = new Map(
          suggestRecipes([...have, extra], recipes).map((m) => [m.recipe.id, m.matched.length]),
        );
        // For every recipe matched before, its count must not drop after adding one.
        for (const [id, count] of before) {
          expect(after.get(id) ?? 0).toBeGreaterThanOrEqual(count);
        }
      }),
    );
  });

  it('is sorted by matched count descending', () => {
    fc.assert(
      fc.property(haveArb, (have) => {
        const counts = suggestRecipes(have, recipes).map((m) => m.matched.length);
        for (let i = 1; i < counts.length; i++) {
          expect(counts[i - 1]!).toBeGreaterThanOrEqual(counts[i]!);
        }
      }),
    );
  });
});

describe('suggestRecipes examples', () => {
  it('returns nothing when no ingredient matches', () => {
    expect(suggestRecipes(['dragonfruit', 'unicorn horn'], recipes)).toEqual([]);
  });

  it('normalizes synonyms before matching', () => {
    // "Granny Smith" -> apple, "tomatoes" -> tomato
    const viaSynonym = suggestRecipes(['Granny Smith', 'tomatoes'], recipes);
    const viaNormalized = suggestRecipes(['apple', 'tomato'], recipes);
    expect(viaSynonym.map((m) => m.recipe.id)).toEqual(viaNormalized.map((m) => m.recipe.id));
  });

  it('finds the garlic recipes when the user has garlic', () => {
    const result = suggestRecipes(['garlic'], recipes);
    expect(result.length).toBeGreaterThan(0);
    for (const m of result) {
      expect(m.matched).toContain('garlic');
    }
  });
});
