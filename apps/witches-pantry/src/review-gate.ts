// Gate for suggest_recipes: ingredients that came from a photo must come with an accepted review
// (get_detections, then submit_review). Ingredients the user typed themselves do not need one.
// Pure: the accepted review is looked up by the caller. Browser-safe.
import { normalizeIngredient, normalizeIngredients } from './ingredient-map.js';
export interface ReviewGateInput {
  reviewId?: string | undefined;
  /** Set to "user" when the user named the ingredients and no photo was involved. */
  ingredientsSource?: 'user' | undefined;
  ingredients: readonly string[];
}
export interface ReviewedItem {
  label: string;
  verdict: 'confirmed' | 'rejected' | 'uncertain';
}
export type ReviewGateResult =
  | { ok: true; rejectedIngredientsIncluded: string[] }
  | { ok: false; message: string };
/**
 * Decides whether suggest_recipes may run.
 * - ingredientsSource "user": allowed, no review needed.
 * - otherwise a reviewId must belong to an accepted review (`reviewItems` is that review's items, or
 *   undefined if there is none).
 * A review does not block ingredients it rejected, because the user may overrule it. They are listed in
 * rejectedIngredientsIncluded so the agent can say so. An ingredient that another item of the review
 * confirmed or marked uncertain is not listed.
 */
export function checkReviewGate(input: ReviewGateInput, reviewItems: readonly ReviewedItem[] | undefined): ReviewGateResult {
  if (input.ingredientsSource === 'user' && input.reviewId === undefined) {
    return { ok: true, rejectedIngredientsIncluded: [] };
  }
  if (input.reviewId === undefined) {
    return {
      ok: false,
      message:
        'suggest_recipes needs a reviewId for ingredients found in a photo. Call get_detections on the photo, ' +
        'review the detections, and call submit_review. Pass the accepted reviewId here. If the user typed the ' +
        'ingredients themselves, set ingredientsSource to "user" and leave out reviewId.',
    };
  }
  if (reviewItems === undefined) {
    return {
      ok: false,
      message:
        'Unknown reviewId, or the review was not accepted. Call get_detections, then submit_review until it ' +
        'accepts the review, and pass that reviewId.',
    };
  }
  const keptByVerdict = (verdicts: ReviewedItem['verdict'][]) =>
    new Set(
      reviewItems
        .filter((i) => verdicts.includes(i.verdict))
        .map((i) => normalizeIngredient(i.label))
        .filter((n): n is string => n !== null),
    );
  const kept = keptByVerdict(['confirmed', 'uncertain']);
  const rejected = keptByVerdict(['rejected']);
  const rejectedIngredientsIncluded = normalizeIngredients(input.ingredients).filter((i) => rejected.has(i) && !kept.has(i));
  return { ok: true, rejectedIngredientsIncluded };
}
