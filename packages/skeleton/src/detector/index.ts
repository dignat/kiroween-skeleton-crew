// Browser-safe detection core. Do not import Node modules from this folder.

export { createCocoSsdAdapter, cocoPredictionToDetection } from './coco-ssd-adapter.js';
export type { CocoPrediction, CocoSsdAdapterOptions } from './coco-ssd-adapter.js';
export { countByLabel } from './count-by-label.js';
export { createMobileNetFoodAdapter, filterToAllowedLabels } from './mobilenet-food-adapter.js';
export type { ClassifierPrediction, MobileNetFoodAdapterOptions } from './mobilenet-food-adapter.js';
export type { ImageDecoder, PixelImage } from './pixel-image.js';
export { createDetector } from './detector.js';
export { filterByConfidence } from './filter-by-confidence.js';
export type { ModelAdapter } from './model-adapter.js';
export type { Detection, DetectOptions, Detector, DetectorImageInput } from './types.js';
