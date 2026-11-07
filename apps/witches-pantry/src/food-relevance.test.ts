import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Detection } from '@skeleton-crew/core';
import { assessFoodRelevance } from './food-relevance.js';

const det = (label: string): Detection => ({ label, confidence: 0.8 });

describe('assessFoodRelevance (examples)', () => {
  it('flags an image with recognized food as food', () => {
    const r = assessFoodRelevance([det('banana'), det('broccoli')]);
    expect(r.isFood).toBe(true);
    expect(r.ingredients).toContain('banana');
    expect(r.ingredients).toContain('broccoli');
  });

  it('maps synonyms before judging', () => {
    const r = assessFoodRelevance([det('bell pepper')]);
    expect(r.isFood).toBe(true);
    expect(r.ingredients).toContain('pepper');
  });

  it('rejects an image with no recognized food', () => {
    const r = assessFoodRelevance([det('person'), det('laptop'), det('plate')]);
    expect(r.isFood).toBe(false);
    expect(r.ingredients).toEqual([]);
    expect(r.message).toMatch(/doesn't look like food/i);
  });

  it('rejects an empty detection list', () => {
    const r = assessFoodRelevance([]);
    expect(r.isFood).toBe(false);
    expect(r.ingredients).toEqual([]);
  });

  it('the rejection message contains no medical/weight/harm wording', () => {
    const r = assessFoodRelevance([det('car')]);
    expect(r.message.toLowerCase()).not.toMatch(/weight|diet|harm|inappropriate|nsfw|explicit/);
  });
});

describe('assessFoodRelevance (properties)', () => {
  const foodLabels = ['banana', 'broccoli', 'cucumber', 'orange', 'lemon', 'mushroom'];
  const nonFoodLabels = ['person', 'laptop', 'plate', 'car', 'chair', 'dog'];

  it('isFood is true exactly when at least one detection maps to an ingredient', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...foodLabels, ...nonFoodLabels)),
        (labels) => {
          const r = assessFoodRelevance(labels.map(det));
          const hasFood = labels.some((l) => foodLabels.includes(l));
          return r.isFood === hasFood && r.isFood === r.ingredients.length > 0;
        },
      ),
    );
  });

  it('every returned ingredient is unique (no duplicates)', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...foodLabels)), (labels) => {
        const r = assessFoodRelevance(labels.map(det));
        return new Set(r.ingredients).size === r.ingredients.length;
      }),
    );
  });
});
