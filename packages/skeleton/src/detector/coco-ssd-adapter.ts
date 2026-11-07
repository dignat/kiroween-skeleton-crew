import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import type { ModelAdapter } from './model-adapter.js';
import type { ImageDecoder } from './pixel-image.js';
import type { Detection, DetectorImageInput } from './types.js';

/** The part of a COCO-SSD result that this adapter uses. */
export interface CocoPrediction {
  /** [x, y, width, height] in pixels. */
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

/** Converts one COCO-SSD result into a Detection with a bounding box. */
export function cocoPredictionToDetection(prediction: CocoPrediction): Detection {
  const [x, y, width, height] = prediction.bbox;
  return {
    label: prediction.class,
    confidence: prediction.score,
    box: { x, y, width, height },
  };
}

export interface CocoSsdAdapterOptions {
  decodeImage: ImageDecoder;
  /** Default 0.5. */
  defaultMinConfidence?: number;
  /** Most boxes the model returns per image. Default 20. */
  maxBoxes?: number;
  /**
   * Run one throwaway inference at load() time to prime the backend. This helps
   * the browser's WebGL backend, which compiles shaders lazily on the first run,
   * so the first user-facing detect() does not stall. It does NOT help the Node
   * pure-JS CPU backend (measured: no per-call speedup, it only moves work into
   * load()), so the default is false. The web app should pass true; Node callers
   * leave it off. A warm-up failure never breaks load().
   */
  warmUp?: boolean;
}

/**
 * Localized object detection (80 COCO classes) with a bounding box per Detection.
 * Runs on whatever TensorFlow.js backend is active, so it works in Node and in the browser.
 */
export class CocoSsdAdapter implements ModelAdapter {
  readonly name = 'coco-ssd';
  readonly defaultMinConfidence: number;
  private model: cocoSsd.ObjectDetection | undefined;
  private readonly decodeImage: ImageDecoder;
  private readonly maxBoxes: number;
  private readonly warmUp: boolean;

  constructor(options: CocoSsdAdapterOptions) {
    this.decodeImage = options.decodeImage;
    this.defaultMinConfidence = options.defaultMinConfidence ?? 0.5;
    this.maxBoxes = options.maxBoxes ?? 20;
    this.warmUp = options.warmUp ?? false;
  }

  async load(): Promise<void> {
    await tf.ready();
    this.model = await cocoSsd.load();
    if (this.warmUp) {
      await this.warmUpOnce();
    }
  }

  /**
   * Primes the backend with one inference on a small blank image. Any error is
   * swallowed and logged to stderr: warm-up is an optimization, not correctness,
   * and must never stop the model from being usable.
   */
  private async warmUpOnce(): Promise<void> {
    if (!this.model) return;
    const dummy = tf.zeros([32, 32, 3], 'int32') as tf.Tensor3D;
    try {
      await this.model.detect(dummy, this.maxBoxes, 0);
    } catch (error) {
      console.error(`[coco-ssd] warm-up skipped: ${(error as Error).message}`);
    } finally {
      dummy.dispose();
    }
  }

  async infer(image: DetectorImageInput): Promise<Detection[]> {
    if (!this.model) throw new Error('CocoSsdAdapter.infer() called before load()');
    const pixels = await this.decodeImage(image);
    const tensor = tf.browser.fromPixels(pixels, 3);
    try {
      // minScore 0: the Detector applies the confidence threshold, not the model.
      const predictions = await this.model.detect(tensor, this.maxBoxes, 0);
      return predictions.map(cocoPredictionToDetection);
    } finally {
      tensor.dispose();
    }
  }
}
