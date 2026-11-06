import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nutritionTable } from './nutrition.js';
import {
  curseLevel,
  dominantCurse,
  nutritionPerServing,
  potionPurity,
} from './nutrition-math.js';
import { recipes } from './recipes.js';
import { suggestRecipes } from './suggest-recipes.js';
import type { Nutrition, Recipe } from './types.js';

// A Nutrition arbitrary with realistic, non-negative amounts.
const nutritionArb: fc.Arbitrary<Nutrition> = fc.record({
  kcal: fc.float({ min: 0, max: 1000, noNaN: true }),
  protein: fc.float({ min: 0, max: 100, noNaN: true }),
  carbs: fc.float({ min: 0, max: 200, noNaN: true }),
  fat: fc.float({ min: 0, max: 100, noNaN: true }),
  satFat: fc.float({ min: 0, max: Math.fround(60), noNaN: true }),
  fibre: fc.float({ min: 0, max: Math.fround(60), noNaN: true }),
  sodiumMg: fc.float({ min: 0, max: 6000, noNaN: true }),
  addedSugar: fc.float({ min: 0, max: Math.fround(150), noNaN: true }),
});

describe('curseLevel (Requirements 14.5, 10.10, 10.11)', () => {
  it('is always an integer within 0..100', () => {
    fc.assert(
      fc.property(nutritionArb, (n) => {
        const level = curseLevel(n);
        expect(Number.isInteger(level)).toBe(true);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(100);
      }),
    );
  });

  it('never decreases when sodium, saturated fat or added sugar rise (10.10)', () => {
    const bump = fc.float({ min: 0, max: 500, noNaN: true });
    fc.assert(
      fc.property(nutritionArb, bump, bump, bump, (n, dSodium, dSat, dSugar) => {
        const higher: Nutrition = {
          ...n,
          sodiumMg: n.sodiumMg + dSodium,
          satFat: n.satFat + dSat,
          addedSugar: n.addedSugar + dSugar,
        };
        expect(curseLevel(higher)).toBeGreaterThanOrEqual(curseLevel(n));
      }),
    );
  });

  it('never increases when fibre or protein rise (10.11)', () => {
    const bump = fc.float({ min: 0, max: 100, noNaN: true });
    fc.assert(
      fc.property(nutritionArb, bump, bump, (n, dFibre, dProtein) => {
        const higher: Nutrition = {
          ...n,
          fibre: n.fibre + dFibre,
          protein: n.protein + dProtein,
        };
        expect(curseLevel(higher)).toBeLessThanOrEqual(curseLevel(n));
      }),
    );
  });
});

describe('potionPurity', () => {
  it('maps the three Curse Level bands', () => {
    expect(potionPurity(0)).toBe('Pure');
    expect(potionPurity(33)).toBe('Pure');
    expect(potionPurity(34)).toBe('Murky');
    expect(potionPurity(66)).toBe('Murky');
    expect(potionPurity(67)).toBe('Cursed');
    expect(potionPurity(100)).toBe('Cursed');
  });
});

describe('nutritionPerServing (Requirements 14.4, 10.12)', () => {
  it('is unchanged when every amount and the serving count scale by the same factor', () => {
    const recipeArb = fc.constantFrom(...recipes);
    const factorArb = fc.integer({ min: 2, max: 6 });
    fc.assert(
      fc.property(recipeArb, factorArb, (recipe, factor) => {
        const scaled: Recipe = {
          ...recipe,
          servings: recipe.servings * factor,
          ingredients: recipe.ingredients.map((i) => ({ ...i, grams: i.grams * factor })),
        };
        const base = nutritionPerServing(recipe, nutritionTable);
        const after = nutritionPerServing(scaled, nutritionTable);
        // Same per-serving values (floating point, so compare closely).
        expect(after.kcal).toBeCloseTo(base.kcal, 6);
        expect(after.protein).toBeCloseTo(base.protein, 6);
        expect(after.sodiumMg).toBeCloseTo(base.sodiumMg, 6);
        expect(after.satFat).toBeCloseTo(base.satFat, 6);
        expect(after.addedSugar).toBeCloseTo(base.addedSugar, 6);
      }),
    );
  });
});

describe("suggestRecipes sortBy 'purity' (Requirements 14.8, 10.13)", () => {
  it('returns Curse Levels in non-decreasing order', () => {
    const pool = Array.from(new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.name))));
    const haveArb = fc.uniqueArray(fc.constantFrom(...pool), { maxLength: pool.length });
    fc.assert(
      fc.property(haveArb, (have) => {
        const matches = suggestRecipes(have, recipes, { sortBy: 'purity', nutritionTable });
        const levels = matches.map((m) => m.curseLevel ?? 0);
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i - 1]!).toBeLessThanOrEqual(levels[i]!);
        }
      }),
    );
  });

  it('enriches matches with nutrition, curseLevel and purity when a table is given', () => {
    const matches = suggestRecipes(['onion', 'garlic', 'tomato'], recipes, { nutritionTable });
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m.nutrition).toBeDefined();
      expect(typeof m.curseLevel).toBe('number');
      expect(['Pure', 'Murky', 'Cursed']).toContain(m.purity);
    }
  });
});

describe('dominantCurse', () => {
  it('is null for an all-zero potion and the heaviest nutrient otherwise', () => {
    expect(
      dominantCurse({
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        satFat: 0,
        fibre: 0,
        sodiumMg: 0,
        addedSugar: 0,
      }),
    ).toBeNull();
    // Very salty, little else: sodium dominates.
    const salty: Nutrition = {
      kcal: 50,
      protein: 1,
      carbs: 2,
      fat: 1,
      satFat: 0.5,
      fibre: 0.5,
      sodiumMg: 1500,
      addedSugar: 0,
    };
    expect(dominantCurse(salty)).toBe('sodium');
  });
});
