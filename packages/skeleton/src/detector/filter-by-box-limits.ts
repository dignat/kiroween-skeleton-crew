import type { Detection } from './types.js';
/** Plausible box size and shape for one label. Every field is optional. Sizes are in pixels. */
export interface BoxLimits {
  /** Smallest allowed width times height, in square pixels. */
  minArea?: number;
  /** Largest allowed width times height, in square pixels. */
  maxArea?: number;
  /** Smallest allowed width divided by height. 0.5 means at least half as wide as tall. */
  minAspectRatio?: number;
  /** Largest allowed width divided by height. 2 means at most twice as wide as tall. */
  maxAspectRatio?: number;
  /** Smallest allowed box area as a fraction of the image area, from 0 to 1. Needs the image size. */
  minAreaFraction?: number;
  /** Largest allowed box area as a fraction of the image area, from 0 to 1. Needs the image size. */
  maxAreaFraction?: number;
}
/** Size of the image the boxes belong to, in pixels. */
export interface ImageSize {
  width: number;
  height: number;
}
function withinLimits(box: NonNullable<Detection['box']>, limits: BoxLimits, imageSize?: ImageSize): boolean {
  const area = box.width * box.height;
  if (imageSize && imageSize.width * imageSize.height > 0) {
    const fraction = area / (imageSize.width * imageSize.height);
    if (limits.minAreaFraction !== undefined && fraction < limits.minAreaFraction) return false;
    if (limits.maxAreaFraction !== undefined && fraction > limits.maxAreaFraction) return false;
  }
  if (limits.minArea !== undefined && area < limits.minArea) return false;
  if (limits.maxArea !== undefined && area > limits.maxArea) return false;
  if (limits.minAspectRatio !== undefined || limits.maxAspectRatio !== undefined) {
    if (box.height <= 0) return false;
    const ratio = box.width / box.height;
    if (limits.minAspectRatio !== undefined && ratio < limits.minAspectRatio) return false;
    if (limits.maxAspectRatio !== undefined && ratio > limits.maxAspectRatio) return false;
  }
  return true;
}
/**
 * Drops Detections whose box is outside the limits listed for their label. Labels without limits and
 * Detections without a box are kept. Fraction limits apply only when imageSize is given, and are
 * skipped otherwise (for example for a model that does not report the image size). Pure function: does not mutate the input array.
 */
export function filterByBoxLimits(
  detections: readonly Detection[],
  limitsByLabel: Readonly<Record<string, BoxLimits>>,
  imageSize?: ImageSize,
): Detection[] {
  return detections.filter((d) => {
    if (!d.box || !Object.hasOwn(limitsByLabel, d.label)) return true;
    return withinLimits(d.box, limitsByLabel[d.label]!, imageSize);
  });
}
