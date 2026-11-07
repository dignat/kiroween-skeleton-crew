import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  describeFilters,
  FILTER_THRESHOLDS,
  isVegetarian,
  passesFilter,
} from './dietary-filters.js';
import { nutritionTable } from './nutrition.js';
import { recipes } from './recipes.js';
import { suggestRecipes } from './suggest-recipes.js';
import type { DietaryFilter } from './types.js';

const ALL_FILTERS: DietaryFilter[] = [
  'vegetarian',
  'lowerSugar',
  'lowerSodium',
  'higherFibre',
  'higherProtein',
  'lighter',
];

// A rich ingredient list so many recipes match, giving the filters something to cut.
const allIngredients = Array.from(new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.name))));

describe('isVegetarian', () => {
  it('rejects recipes with meat and accepts those without', () => {
    const chili = recipes.find((r) => r.id === 'conjurers-chili')!; // has beef
    const salad = recipes.find((r) => r.id === 'witchs-garden-salad')!; // no meat
    expect(isVegetarian(chili)).toBe(false);
    expect(isVegetarian(salad)).toBe(true);
  });
});

describe('dietary filters (properties)', () => {
  const filterSetArb = fc.uniqueArray(fc.constantFrom(...ALL_FILTERS), { maxLength: ALL_FILTERS.length });

  it('filtering only ever removes recipes, never adds (subset of unfiltered)', () => {
    fc.assert(
      fc.property(filterSetArb, (filters) => {
        const base = suggestRecipes(allIngredients, recipes, { nutritionTable });
        const filtered = suggestRecipes(allIngredients, recipes, { nutritionTable, filters });
        const baseIds = new Set(base.map((m) => m.recipe.id));
        // every filtered recipe was in the unfiltered result
        expect(filtered.every((m) => baseIds.has(m.recipe.id))).toBe(true);
        // and the filtered list is no longer than the base
        expect(filtered.length).toBeLessThanOrEqual(base.length);
      }),
    );
  });

  it('every recipe in a filtered result passes every selected filter', () => {
    fc.assert(
      fc.property(filterSetArb, (filters) => {
        const filtered = suggestRecipes(allIngredients, recipes, { nutritionTable, filters });
        for (const m of filtered) {
          for (const f of filters) {
            expect(passesFilter(m, f)).toBe(true);
          }
        }
      }),
    );
  });

  it('adding a filter never grows the result (monotonic narrowing)', () => {
    fc.assert(
      fc.property(filterSetArb, fc.constantFrom(...ALL_FILTERS), (filters, extra) => {
        const before = suggestRecipes(allIngredients, recipes, { nutritionTable, filters });
        const after = suggestRecipes(allIngredients, recipes, {
          nutritionTable,
          filters: [...new Set([...filters, extra])],
        });
        expect(after.length).toBeLessThanOrEqual(before.length);
      }),
    );
  });

  it('no filters returns the same set as omitting filters entirely', () => {
    const none = suggestRecipes(allIngredients, recipes, { nutritionTable, filters: [] });
    const omitted = suggestRecipes(allIngredients, recipes, { nutritionTable });
    expect(none.map((m) => m.recipe.id)).toEqual(omitted.map((m) => m.recipe.id));
  });
});

describe('dietary filters (examples)', () => {
  it('vegetarian filter drops every recipe containing meat', () => {
    const veg = suggestRecipes(allIngredients, recipes, { nutritionTable, filters: ['vegetarian'] });
    for (const m of veg) expect(isVegetarian(m.recipe)).toBe(true);
    // at least one meat recipe exists in the full set, so filtering changed something
    const all = suggestRecipes(allIngredients, recipes, { nutritionTable });
    expect(veg.length).toBeLessThan(all.length);
  });

  it('lighter filter keeps only recipes at or below the kcal threshold', () => {
    const light = suggestRecipes(allIngredients, recipes, { nutritionTable, filters: ['lighter'] });
    for (const m of light) {
      expect(m.nutrition!.kcal).toBeLessThanOrEqual(FILTER_THRESHOLDS.lighterMaxKcal);
    }
  });

  it('nutrition-based filters pass through when no nutrition table is given', () => {
    // Without a table, matches carry no nutrition, so lowerSugar must not exclude.
    const withFilter = suggestRecipes(allIngredients, recipes, { filters: ['lowerSugar'] });
    const noFilter = suggestRecipes(allIngredients, recipes, {});
    expect(withFilter.length).toBe(noFilter.length);
  });

  it('describeFilters is neutral and recipe-describing, with no advice words', () => {
    const text = describeFilters(['vegetarian', 'lowerSugar']);
    expect(text).toContain('Showing potions with');
    expect(text.toLowerCase()).not.toMatch(/weight|diet|diabet|lose|calorie[- ]?restrict|should eat/);
  });

  it('describeFilters is empty for no filters', () => {
    expect(describeFilters([])).toBe('');
  });
});
