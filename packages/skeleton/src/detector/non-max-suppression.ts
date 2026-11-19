import type { Detection } from './types.js';
type Box = NonNullable<Detection['box']>;
/** Intersection over union of two boxes, from 0 to 1. Returns 0 when either has no area. */
export function iou(a: Box, b: Box): number {
  const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (overlapW <= 0 || overlapH <= 0) return 0;
  const intersection = overlapW * overlapH;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union <= 0 ? 0 : intersection / union;
}
export interface NonMaxSuppressionOptions {
  /** Suppress overlapping boxes even when their labels differ. Default false (same label only). */
  acrossLabels?: boolean;
}
/**
 * Removes duplicate boxes. Detections are visited from highest to lowest confidence. One is dropped
 * when its IoU with an already kept detection is at or above iouThreshold. Detections without a box
 * (whole-image classifiers) are always kept. Pure function: does not mutate the input array.
 */
export function nonMaxSuppression(
  detections: readonly Detection[],
  iouThreshold: number,
  options: NonMaxSuppressionOptions = {},
): Detection[] {
  const acrossLabels = options.acrossLabels ?? false;
  const kept: Detection[] = [];
  const keptWithBox: Array<Detection & { box: Box }> = [];
  const sorted = detections
    .map((d, index) => ({ d, index }))
    .sort((p, q) => q.d.confidence - p.d.confidence || p.index - q.index);
  const keepIndexes = new Set<number>();
  for (const { d, index } of sorted) {
    const box = d.box;
    if (!box) {
      keepIndexes.add(index);
      continue;
    }
    const duplicate = keptWithBox.some(
      (k) => (acrossLabels || k.label === d.label) && iou(k.box, box) >= iouThreshold,
    );
    if (!duplicate) {
      keptWithBox.push({ ...d, box });
      keepIndexes.add(index);
    }
  }
  detections.forEach((d, index) => {
    if (keepIndexes.has(index)) kept.push(d);
  });
  return kept;
}
