// Node-only. Builds the COCO-SSD detector and an image sizer shared by the CLI
// and the MCP server, so both surfaces detect identically (Requirements 5.10).
import { createCocoSsdAdapter, createDetector, type Detector, type DetectorImageInput } from '@skeleton-playground/core';
import { createNodeImageDecoder } from '@skeleton-playground/core/node';
import type { ImageSizer } from './load-scenes.js';

/**
 * Creates a Detector backed by COCO-SSD, reading images only from `allowedRoot`.
 * The model loads once on first detect() and is reused (handled by createDetector).
 */
export function createCocoDetector(allowedRoot: string): Detector {
  const decodeImage = createNodeImageDecoder({ allowedRoot });
  const adapter = createCocoSsdAdapter({ decodeImage });
  return createDetector(adapter);
}

/**
 * Reads an image's pixel dimensions through the same guarded decoder the detector uses, so the
 * sizer can never read a file the detector would refuse (outside `allowedRoot`, wrong type,
 * too large). The image is decoded once more than strictly needed; that is the price of having
 * exactly one code path that touches the disk.
 */
export function createImageSizer(allowedRoot: string): ImageSizer {
  const decodeImage = createNodeImageDecoder({ allowedRoot });
  return async (input: DetectorImageInput): Promise<{ width: number; height: number }> => {
    const { width, height } = await decodeImage(input);
    return { width, height };
  };
}
