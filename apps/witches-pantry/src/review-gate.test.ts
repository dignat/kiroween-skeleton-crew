import { describe, expect, it } from 'vitest';
import { checkReviewGate, type ReviewedItem } from './review-gate.js';
const items: ReviewedItem[] = [
  { label: 'banana', verdict: 'confirmed' },
  { label: 'lemon', verdict: 'rejected' },
  { label: 'broccoli', verdict: 'uncertain' },
];
describe('checkReviewGate', () => {
  it('allows ingredients the user typed, with no review', () => {
    expect(checkReviewGate({ ingredientsSource: 'user', ingredients: ['onion'] }, undefined)).toEqual({
      ok: true,
      rejectedIngredientsIncluded: [],
    });
  });
  it('refuses when there is neither a reviewId nor ingredientsSource "user"', () => {
    const result = checkReviewGate({ ingredients: ['banana'] }, undefined);
    expect(result.ok).toBe(false);
  });
  it('refuses an unknown or unaccepted reviewId', () => {
    const result = checkReviewGate({ reviewId: 'x', ingredients: ['banana'] }, undefined);
    expect(result).toMatchObject({ ok: false });
  });
  it('does not accept "user" together with a reviewId that is not accepted', () => {
    expect(checkReviewGate({ reviewId: 'x', ingredientsSource: 'user', ingredients: ['banana'] }, undefined).ok).toBe(false);
  });
  it('allows an accepted review and lists included ingredients the review rejected', () => {
    const result = checkReviewGate({ reviewId: 'r', ingredients: ['banana', 'lemon', 'broccoli'] }, items);
    expect(result).toEqual({ ok: true, rejectedIngredientsIncluded: ['lemon'] });
  });
  it('does not list an ingredient that another item confirmed', () => {
    const both: ReviewedItem[] = [...items, { label: 'lemon', verdict: 'confirmed' }];
    expect(checkReviewGate({ reviewId: 'r', ingredients: ['lemon'] }, both)).toEqual({ ok: true, rejectedIngredientsIncluded: [] });
  });
});
