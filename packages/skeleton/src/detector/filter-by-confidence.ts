import type { Detection } from './types.js';
/**
 * Keeps only Detections at or above their threshold (Requirement 2.3).
 * A label listed in minConfidenceByLabel uses that threshold. Every other label uses minConfidence.
 * Pure function: does not mutate the input array.
 */
export function filterByConfidence(
  detections: readonly Detection[],
  minConfidence: number,
  minConfidenceByLabel: Readonly<Record<string, number>> = {},
): Detection[] {
  return detections.filter((d) => {
    const own = Object.hasOwn(minConfidenceByLabel, d.label) ? minConfidenceByLabel[d.label] : undefined;
    return d.confidence >= (own ?? minConfidence);
  });
}
