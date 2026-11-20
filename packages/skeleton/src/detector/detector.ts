import { filterByConfidence } from './filter-by-confidence.js';
import { filterByBoxLimits } from './filter-by-box-limits.js';
import { filterByContext } from './filter-by-context.js';
import { nonMaxSuppression } from './non-max-suppression.js';
import type { InferMeta, ModelAdapter } from './model-adapter.js';
import type { DetectOptions, DetectionInfo, Detector, DetectorImageInput } from './types.js';

/**
 * Creates a Detector built around a ModelAdapter.
 * - Loads the model once and reuses it (Requirement 2.5), even when detect() is
 *   called several times before the first load finishes.
 * - Applies the confidence threshold (Requirement 2.3), then optional box limits, then optional context rules, then optional non-maximum suppression.
 * - Lets UnsupportedImageError from the adapter reach the caller as a rejection,
 *   so callers handle it without the process crashing (Requirement 2.4).
 *
 * The load state lives in a closure, so it is private at runtime, not just in
 * the type system.
 */
export function createDetector(adapter: ModelAdapter): Detector {
  let loading: Promise<void> | undefined;

  const ensureLoaded = (): Promise<void> => {
    if (!loading) {
      loading = adapter.load().catch((error: unknown) => {
        // Forget a failed load so the next call can retry instead of failing forever.
        loading = undefined;
        throw error;
      });
    }
    return loading;
  };

  const detectWithInfo = async (image: DetectorImageInput, options: DetectOptions = {}): Promise<DetectionInfo> => {
    await ensureLoaded();
    const meta: InferMeta = {};
    const raw = await adapter.infer(image, meta);
    const byConfidence = filterByConfidence(
      raw,
      options.minConfidence ?? adapter.defaultMinConfidence,
      options.minConfidenceByLabel,
    );
    const sized = options.boxLimitsByLabel
      ? filterByBoxLimits(byConfidence, options.boxLimitsByLabel, meta.imageSize)
      : byConfidence;
    const confident = options.contextRules ? filterByContext(sized, options.contextRules) : sized;
    const detections =
      options.iouThreshold === undefined
        ? confident
        : nonMaxSuppression(confident, options.iouThreshold, { acrossLabels: options.nmsAcrossLabels ?? false });
    return meta.imageSize ? { detections, imageSize: meta.imageSize } : { detections };
  };
  return {
    detectWithInfo,
    async detect(image, options) {
      return (await detectWithInfo(image, options)).detections;
    },
  };
}
