import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calculateTotals,
  NUTRIENT_KEYS,
  percentOfTargets,
  type CalculatorIngredient,
  type UserTargets,
} from './nutrition-calculator.js';
import { nutritionTable } from './nutrition.js';
import type { Nutrition } from './types.js';

// Names that exist in the real table, so calculations have data to sum.
const knownNames = Object.keys(nutritionTable);

const knownIngredientArb: fc.Arbitrary<CalculatorIngredient> = fc.record({
  name: fc.constantFrom(...knownNames),
  grams: fc.float({ min: 0, max: 1000, noNaN: true }),
});

const ingredientListArb = fc.array(knownIngredientArb, { maxLength: 8 });

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

describe('calculateTotals', () => {
  it('never produces a negative nutrient total', () => {
    fc.assert(
      fc.property(ingredientListArb, fc.integer({ min: 1, max: 12 }), (ings, servings) => {
        const { total, perServing } = calculateTotals(ings, nutritionTable, servings);
        for (const key of NUTRIENT_KEYS) {
          expect(total[key]).toBeGreaterThanOrEqual(0);
          expect(perServing[key]).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it('perServing times servings equals the total (within tolerance)', () => {
    fc.assert(
      fc.property(ingredientListArb, fc.integer({ min: 1, max: 12 }), (ings, servings) => {
        const r = calculateTotals(ings, nutritionTable, servings);
        for (const key of NUTRIENT_KEYS) {
          expect(r.perServing[key] * r.servings).toBeCloseTo(r.total[key], 6);
        }
      }),
    );
  });

  it('scaling every amount by a factor scales the total by that factor', () => {
    fc.assert(
      fc.property(ingredientListArb, fc.integer({ min: 2, max: 6 }), (ings, factor) => {
        const base = calculateTotals(ings, nutritionTable, 1);
        const scaled = calculateTotals(
          ings.map((i) => ({ ...i, grams: i.grams * factor })),
          nutritionTable,
          1,
        );
        for (const key of NUTRIENT_KEYS) {
          expect(scaled.total[key]).toBeCloseTo(base.total[key] * factor, 4);
        }
      }),
    );
  });

  it('treats a manual ingredient identically to a detected one with the same data', () => {
    // Same name + grams must yield the same totals regardless of "origin":
    // the calculator has no notion of origin, which is the point.
    fc.assert(
      fc.property(knownIngredientArb, (ing) => {
        const asDetected = calculateTotals([ing], nutritionTable, 1);
        const asManual = calculateTotals([{ name: ing.name, grams: ing.grams }], nutritionTable, 1);
        for (const key of NUTRIENT_KEYS) {
          expect(asManual.total[key]).toBe(asDetected.total[key]);
        }
      }),
    );
  });

  it('reports unknown ingredients as missing and counts the known ones', () => {
    const r = calculateTotals(
      [
        { name: knownNames[0]!, grams: 100 },
        { name: 'definitely-not-an-ingredient-xyz', grams: 100 },
      ],
      nutritionTable,
      1,
    );
    expect(r.counted).toContain(knownNames[0]);
    expect(r.missing).toContain('definitely-not-an-ingredient-xyz');
  });

  it('clamps a non-positive or non-finite serving count to 1', () => {
    const ings = [{ name: knownNames[0]!, grams: 100 }];
    expect(calculateTotals(ings, nutritionTable, 0).servings).toBe(1);
    expect(calculateTotals(ings, nutritionTable, -3).servings).toBe(1);
    expect(calculateTotals(ings, nutritionTable, Number.NaN).servings).toBe(1);
  });

  it('treats negative grams as zero (no negative contribution)', () => {
    const r = calculateTotals([{ name: knownNames[0]!, grams: -500 }], nutritionTable, 1);
    for (const key of NUTRIENT_KEYS) {
      expect(r.total[key]).toBe(0);
    }
  });
});

describe('percentOfTargets', () => {
  it('returns nothing when the user gave no targets', () => {
    fc.assert(
      fc.property(nutritionArb, (n) => {
        expect(percentOfTargets(n, {})).toEqual([]);
      }),
    );
  });

  it('skips targets that are zero, negative or non-finite (never invents one)', () => {
    const amounts: Nutrition = {
      kcal: 500,
      protein: 20,
      carbs: 50,
      fat: 10,
      satFat: 3,
      fibre: 5,
      sodiumMg: 400,
      addedSugar: 5,
    };
    const targets: UserTargets = {
      kcal: 0,
      protein: -10,
      carbs: Number.NaN,
      fat: 70, // only this one is valid
    };
    const result = percentOfTargets(amounts, targets);
    expect(result.map((r) => r.nutrient)).toEqual(['fat']);
  });

  it('percent is monotonic in the amount for a fixed positive target', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        fc.float({ min: Math.fround(0.0001), max: 1000, noNaN: true }),
        fc.float({ min: Math.fround(1), max: 500, noNaN: true }),
        (amount, bump, target) => {
          const base: Nutrition = {
            kcal: amount,
            protein: 0,
            carbs: 0,
            fat: 0,
            satFat: 0,
            fibre: 0,
            sodiumMg: 0,
            addedSugar: 0,
          };
          const higher: Nutrition = { ...base, kcal: amount + bump };
          const p1 = percentOfTargets(base, { kcal: target })[0]!.percent;
          const p2 = percentOfTargets(higher, { kcal: target })[0]!.percent;
          expect(p2).toBeGreaterThanOrEqual(p1);
        },
      ),
    );
  });

  it('computes a plain ratio: 500 against a 2000 target is 25%', () => {
    const amounts: Nutrition = {
      kcal: 500,
      protein: 0,
      carbs: 0,
      fat: 0,
      satFat: 0,
      fibre: 0,
      sodiumMg: 0,
      addedSugar: 0,
    };
    const [entry] = percentOfTargets(amounts, { kcal: 2000 });
    expect(entry?.percent).toBe(25);
  });
});
