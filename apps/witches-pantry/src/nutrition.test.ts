import { describe, expect, it } from 'vitest';
import { nutritionTable } from './nutrition.js';
import { recipes } from './recipes.js';

/**
 * Fibre-aware Atwater estimate: protein and non-fibre carbs at 4 kcal/g, fibre
 * at ~2 kcal/g, fat at 9 kcal/g. USDA kcal values already discount fibre, so the
 * plain 4*carbs formula over-counts high-fibre foods; this matches reality.
 */
function estimatedKcal(v: {
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}): number {
  return 4 * v.protein + 4 * (v.carbs - v.fibre) + 2 * v.fibre + 9 * v.fat;
}

describe('nutrition table (Requirement 14.2, 14.3, 14.13)', () => {
  it('has an entry for every ingredient used by the recipes', () => {
    const used = new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.name)));
    const missing = [...used].filter((name) => !(name in nutritionTable));
    expect(missing).toEqual([]);
  });

  it('kcal is consistent with protein, carbs, fat and fibre (Requirement 14.13)', () => {
    // A hand-curated table has rounding and water-content noise, so allow the
    // estimate to be within 15% OR within 10 kcal of the listed value.
    for (const [name, v] of Object.entries(nutritionTable)) {
      const estimate = estimatedKcal(v);
      const absDiff = Math.abs(estimate - v.kcal);
      const withinPct = v.kcal > 0 && absDiff <= v.kcal * 0.15;
      const withinAbs = absDiff <= 10;
      expect(
        withinPct || withinAbs,
        `${name}: kcal ${v.kcal} vs estimate ${estimate.toFixed(1)} (diff ${absDiff.toFixed(1)})`,
      ).toBe(true);
    }
  });

  it('every entry carries a data source (Requirement 14.3)', () => {
    for (const [name, v] of Object.entries(nutritionTable)) {
      expect(v.source, name).toBeTruthy();
    }
  });

  it('addedSugar is zero for whole foods and non-zero only for sweeteners', () => {
    const sweeteners = new Set(['sugar', 'honey']);
    for (const [name, v] of Object.entries(nutritionTable)) {
      if (sweeteners.has(name)) {
        expect(v.addedSugar, name).toBeGreaterThan(0);
      } else {
        // bread is the one processed item with a little added sugar; allow it.
        if (name !== 'bread') expect(v.addedSugar, name).toBe(0);
      }
    }
  });

  it('addedSugar never exceeds total carbs', () => {
    for (const [name, v] of Object.entries(nutritionTable)) {
      expect(v.addedSugar, name).toBeLessThanOrEqual(v.carbs);
    }
  });
});
