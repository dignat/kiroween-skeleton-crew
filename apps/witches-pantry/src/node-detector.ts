// Node-only. Builds the MobileNet food detector for the MCP server, so the
// server's detect_objects uses the same food adapter the web UI uses in the
// browser — only the image decoder differs (Node jpeg/png vs. canvas).

import { createDetector, createMobileNetFoodAdapter, type Detector } from '@skeleton-playground/core';
import { createNodeImageDecoder } from '@skeleton-playground/core/node';
import { FOOD_LABELS } from './food-labels.js';

/** Creates a food Detector that reads images only from `allowedRoot`. */
export function createFoodDetector(allowedRoot: string): Detector {
  const decodeImage = createNodeImageDecoder({ allowedRoot });
  const adapter = createMobileNetFoodAdapter({ decodeImage, allowedLabels: FOOD_LABELS });
  return createDetector(adapter);
}
