// Browser-safe detection core. Do not import Node modules from this folder.

export { createCocoSsdAdapter, cocoPredictionToDetection } from './coco-ssd-adapter.js';
export type { CocoPrediction, CocoSsdAdapterOptions } from './coco-ssd-adapter.js';
export { countByLabel } from './count-by-label.js';
export { createMobileNetFoodAdapter, filterToAllowedLabels } from './mobilenet-food-adapter.js';
export type { ClassifierPrediction, MobileNetFoodAdapterOptions } from './mobilenet-food-adapter.js';
export type { ImageDecoder, PixelImage } from './pixel-image.js';
export { createDetector } from './detector.js';
export { filterByConfidence } from './filter-by-confidence.js';
export { filterByBoxLimits } from './filter-by-box-limits.js';
export type { BoxLimits, ImageSize } from './filter-by-box-limits.js';
export { filterByContext } from './filter-by-context.js';
export type { ContextRule } from './filter-by-context.js';
export { iou, nonMaxSuppression } from './non-max-suppression.js';
export type { NonMaxSuppressionOptions } from './non-max-suppression.js';
export type { InferMeta, ModelAdapter } from './model-adapter.js';
export type { Detection, DetectOptions, Detector, DetectorImageInput } from './types.js';
