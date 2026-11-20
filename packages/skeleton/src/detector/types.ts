// Shared detection types. Browser-safe: no Node imports here (Requirement 1.2).
import type { BoxLimits } from './filter-by-box-limits.js';
import type { ContextRule } from './filter-by-context.js';

/** One detected object or whole-image classification. */
export interface Detection {
  label: string;
  /** Confidence score, 0 to 1. */
  confidence: number;
  /**
   * Present for localized detectors (for example COCO-SSD). Absent for
   * whole-image classifiers (for example a MobileNet-style food classifier),
   * which describe the whole image rather than a region of it.
   */
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectOptions {
  /** Detections below this confidence are excluded. Default is adapter-specific. */
  minConfidence?: number;
  /**
   * Per-label thresholds. A label listed here uses its own threshold instead of
   * minConfidence (or the adapter default). Other labels are unaffected.
   */
  minConfidenceByLabel?: Record<string, number>;
  /**
   * Per-label plausible box size (pixels) and shape. Detections whose box falls outside the limits
   * for their label are dropped. Labels not listed, and detections without a box, are kept.
   */
  boxLimitsByLabel?: Record<string, BoxLimits>;
  /**
   * Context rules: drop a label based on which other labels were detected in the same image, for
   * example drop "boat" when an "oven" is present. Evidence comes from detections that passed the
   * confidence and box-limit filters.
   */
  contextRules?: ContextRule[];
  /**
   * Non-maximum suppression. When set (0 to 1), a box is dropped if its IoU with a
   * higher-confidence kept box is at or above this value. Off by default.
   * Detections without a box are never removed.
   */
  iouThreshold?: number;
  /** With iouThreshold: also suppress overlapping boxes that have different labels. Default false. */
  nmsAcrossLabels?: boolean;
}

/** Input accepted by a Detector. File paths only resolve in Node. */
export type DetectorImageInput =
  | { kind: 'filePath'; path: string }
  | { kind: 'base64'; data: string; mimeType: string };

/** What one detection run found, plus facts about the image it ran on. */
export interface DetectionInfo {
  detections: Detection[];
  /** Size in pixels of the decoded image. Boxes are in this coordinate space. Absent if the adapter did not report it. */
  imageSize?: { width: number; height: number };
}
/** Implemented by model adapters (createCocoSsdAdapter, createMobileNetFoodAdapter, ...). */
export interface Detector {
  detect(image: DetectorImageInput, options?: DetectOptions): Promise<Detection[]>;
  /** Same as detect(), and also reports the image size. Optional so simple Detector fakes stay valid. */
  detectWithInfo?(image: DetectorImageInput, options?: DetectOptions): Promise<DetectionInfo>;
}
