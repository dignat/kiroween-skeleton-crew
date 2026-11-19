import type { Detection, DetectorImageInput } from './types.js';
/** Extra facts an adapter can report about one infer() call. */
export interface InferMeta {
  /** Size in pixels of the decoded image. Boxes in the Detections are in this coordinate space. */
  imageSize?: { width: number; height: number };
}

/**
 * A swappable model behind the Detector (Requirement 2.6). Adapters return raw,
 * unfiltered Detections. The Detector applies the confidence threshold.
 * Adapters throw UnsupportedImageError for input they cannot decode.
 */
export interface ModelAdapter {
  /** Short name used in logs and errors, for example "coco-ssd". */
  readonly name: string;
  /** Threshold used when the caller does not pass minConfidence. */
  readonly defaultMinConfidence: number;
  /** Loads model weights. Called by the Detector at most once at a time. */
  load(): Promise<void>;
  /**
   * Runs the model on one image. Called only after load() has resolved.
   * Adapters that return boxes set meta.imageSize, so the Detector can apply limits relative to the image.
   * meta belongs to this one call, so concurrent calls do not interfere.
   */
  infer(image: DetectorImageInput, meta?: InferMeta): Promise<Detection[]>;
}
