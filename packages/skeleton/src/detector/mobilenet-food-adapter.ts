import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import type { ModelAdapter } from './model-adapter.js';
import type { ImageDecoder } from './pixel-image.js';
import type { Detection, DetectorImageInput } from './types.js';

/** The part of a MobileNet result that this adapter uses. */
export interface ClassifierPrediction {
  /** ImageNet class name. May hold synonyms, for example "cucumber, cuke". */
  className: string;
  probability: number;
}

/**
 * Keeps only predictions whose name matches the allowlist, as whole-image Detections
 * (no bounding box). A class name with several comma-separated synonyms matches if any
 * synonym is in the allowlist, and the matched synonym becomes the label, so the label is
 * always a value the app put in its own allowlist. Matching ignores case and spacing.
 * The first matching synonym wins when more than one matches.
 */
export function filterToAllowedLabels(
  predictions: readonly ClassifierPrediction[],
  allowedLabels: ReadonlySet<string>,
): Detection[] {
  const detections: Detection[] = [];
  for (const prediction of predictions) {
    const synonyms = prediction.className.split(',').map((s) => s.trim().toLowerCase());
    const matched = synonyms.find((s) => allowedLabels.has(s));
    if (matched !== undefined) {
      detections.push({ label: matched, confidence: prediction.probability });
    }
  }
  return detections;
}

export interface MobileNetFoodAdapterOptions {
  decodeImage: ImageDecoder;
  /**
   * Labels the app accepts, for example ["broccoli", "cucumber", "banana"]. Passed in by the
   * app so the skeleton stays generic. Anything else the model says (plate, tray, ...) is dropped.
   */
  allowedLabels: readonly string[];
  /** Default 0.1. Whole-image scores are low on busy scenes (Spike C), so the default is low. */
  defaultMinConfidence?: number;
  /** How many top predictions to read before filtering. Default 10. */
  topK?: number;
  /**
   * Run one throwaway classification at load() time to prime the backend. Helps
   * the browser's WebGL backend (lazy shader compilation on first run); does not
   * help the Node CPU backend, so the default is false. The web app passes true.
   * A warm-up failure never breaks load().
   */
  warmUp?: boolean;
}

/**
 * Whole-image classification (ImageNet MobileNet v2) filtered to an allowlist of food labels.
 * Best-effort only: Spike C found it misses common ingredients (no tomato, onion, carrot,
 * garlic or avocado class), so apps should treat results as suggestions the user can edit.
 */
export function createMobileNetFoodAdapter(options: MobileNetFoodAdapterOptions): ModelAdapter {
  const { decodeImage } = options;
  const allowed: ReadonlySet<string> = new Set(options.allowedLabels.map((l) => l.trim().toLowerCase()));
  const defaultMinConfidence = options.defaultMinConfidence ?? 0.1;
  const topK = options.topK ?? 10;
  const warmUp = options.warmUp ?? false;
  let model: mobilenet.MobileNet | undefined;

  /**
   * Primes the backend with one classification on a small blank image. Any error
   * is swallowed and logged to stderr: warm-up is an optimization, not correctness.
   */
  async function warmUpOnce(loaded: mobilenet.MobileNet): Promise<void> {
    const dummy = tf.zeros([32, 32, 3], 'int32') as tf.Tensor3D;
    try {
      await loaded.classify(dummy, topK);
    } catch (error) {
      console.error(`[mobilenet-food] warm-up skipped: ${(error as Error).message}`);
    } finally {
      dummy.dispose();
    }
  }

  return {
    name: 'mobilenet-food',
    defaultMinConfidence,

    async load(): Promise<void> {
      await tf.ready();
      model = await mobilenet.load({ version: 2, alpha: 1.0 });
      if (warmUp) {
        await warmUpOnce(model);
      }
    },

    async infer(image: DetectorImageInput): Promise<Detection[]> {
      if (!model) throw new Error('mobilenet-food adapter: infer() called before load()');
      const pixels = await decodeImage(image);
      const tensor = tf.browser.fromPixels(pixels, 3);
      try {
        const predictions = await model.classify(tensor, topK);
        return filterToAllowedLabels(predictions, allowed);
      } finally {
        tensor.dispose();
      }
    },
  };
}
