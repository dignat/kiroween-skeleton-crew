import type * as cocoSsd from '@tensorflow-models/coco-ssd';
import type * as TF from '@tensorflow/tfjs';
import { importOptionalPeer } from './optional-peer.js';
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
  /**
   * Where to load the model files from (the URL of a `model.json`). Default: the publisher's
   * hosted copy at storage.googleapis.com, downloaded on first use. Set this to host the files
   * yourself, for example on your own server or CDN, to work offline or to pin a copy.
   */
  modelUrl?: string;
}

/**
 * Localized object detection (80 COCO classes) with a bounding box per Detection.
 * Runs on whatever TensorFlow.js backend is active, so it works in Node and in the browser.
 */
export function createCocoSsdAdapter(options: CocoSsdAdapterOptions): ModelAdapter {
  const { decodeImage } = options;
  const defaultMinConfidence = options.defaultMinConfidence ?? 0.5;
  const maxBoxes = options.maxBoxes ?? 20;
  const warmUp = options.warmUp ?? false;
  let model: cocoSsd.ObjectDetection | undefined;
  let tf: typeof import('@tensorflow/tfjs') | undefined;

  /**
   * Primes the backend with one inference on a small blank image. Any error is
   * swallowed and logged to stderr: warm-up is an optimization, not correctness,
   * and must never stop the model from being usable.
   */
  async function warmUpOnce(loaded: cocoSsd.ObjectDetection, tfjs: typeof import('@tensorflow/tfjs')): Promise<void> {
    const dummy = tfjs.zeros([32, 32, 3], 'int32') as TF.Tensor3D;
    try {
      await loaded.detect(dummy, maxBoxes, 0);
    } catch (error) {
      console.error(`[coco-ssd] warm-up skipped: ${(error as Error).message}`);
    } finally {
      dummy.dispose();
    }
  }

  return {
    name: 'coco-ssd',
    defaultMinConfidence,

    async load(): Promise<void> {
      tf = await importOptionalPeer('@tensorflow/tfjs', 'coco-ssd', () => import('@tensorflow/tfjs'), '@tensorflow-models/coco-ssd');
      const coco = await importOptionalPeer('@tensorflow-models/coco-ssd', 'coco-ssd', () => import('@tensorflow-models/coco-ssd'), '@tensorflow/tfjs');
      await tf.ready();
      model = await coco.load(options.modelUrl === undefined ? {} : { modelUrl: options.modelUrl });
      if (warmUp) {
        await warmUpOnce(model, tf);
      }
    },

    async infer(image: DetectorImageInput): Promise<Detection[]> {
      if (!model || !tf) throw new Error('coco-ssd adapter: infer() called before load()');
      const pixels = await decodeImage(image);
      const tensor = tf.browser.fromPixels(pixels, 3);
      try {
        // minScore 0: the Detector applies the confidence threshold, not the model.
        const predictions = await model.detect(tensor, maxBoxes, 0);
        return predictions.map(cocoPredictionToDetection);
      } finally {
        tensor.dispose();
      }
    },
  };
}
