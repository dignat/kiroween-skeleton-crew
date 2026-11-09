import { filterByConfidence } from './filter-by-confidence.js';
import type { ModelAdapter } from './model-adapter.js';
import type { DetectOptions, Detection, Detector, DetectorImageInput } from './types.js';

/**
 * Creates a Detector built around a ModelAdapter.
 * - Loads the model once and reuses it (Requirement 2.5), even when detect() is
 *   called several times before the first load finishes.
 * - Applies the confidence threshold (Requirement 2.3).
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

  return {
    async detect(image: DetectorImageInput, options: DetectOptions = {}): Promise<Detection[]> {
      await ensureLoaded();
      const raw = await adapter.infer(image);
      return filterByConfidence(raw, options.minConfidence ?? adapter.defaultMinConfidence);
    },
  };
}
