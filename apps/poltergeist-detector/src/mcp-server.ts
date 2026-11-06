#!/usr/bin/env -S node --import tsx
// Poltergeist Detector MCP server (task 16.3). Registers `compare_scenes` on top
// of the skeleton's built-in detect_objects / count_objects, using the same
// compareScenes logic as the CLI (Requirement 5.10).
import type { DetectOptions } from '@skeleton-crew/core';
import {
  createSkeletonServer,
  jsonResult,
  registerTool,
  serveOverStdio,
  z,
} from '@skeleton-crew/core/node';
import { listCocoLabels } from './coco-labels.js';
import { compareScenes, DEFAULT_MOVE_TOLERANCE } from './compare-scenes.js';
import { createCocoDetector, createImageSizer } from './detector.js';
import { toReport } from './format-report.js';
import { loadScenes } from './load-scenes.js';
const SERVER_NAME = 'poltergeist-detector';
const SERVER_VERSION = '0.1.0';
const compareInput = z.object({
  beforePath: z
    .string()
    .min(1)
    .describe('Path to the "before" photo (JPEG or PNG), resolved inside the allowed images folder.'),
  afterPath: z
    .string()
    .min(1)
    .describe('Path to the "after" photo (JPEG or PNG), taken from the same spot.'),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Ignore detections below this confidence, from 0 to 1 (default 0.5).'),
  tolerance: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(`Max normalized centre drift still counted as "unchanged" (default ${DEFAULT_MOVE_TOLERANCE}).`),
});
// list_labels takes no input.
const listLabelsInput = z.object({});
/** Builds the server: built-in tools plus compare_scenes, all sharing one detector. */
export function createServer() {
  const allowedRoot = process.cwd();
  const detector = createCocoDetector(allowedRoot);
  const getSize = createImageSizer();
  const server = createSkeletonServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    detector,
  });
  registerTool(server, {
    name: 'compare_scenes',
    description:
      'Compare two photos of the same place and report what appeared, vanished, moved or stayed. ' +
      'Take both photos from the same spot with objects large and clearly separated.',
    inputSchema: compareInput,
    handler: async (input) => {
      const options: DetectOptions =
        input.minConfidence === undefined ? {} : { minConfidence: input.minConfidence };
      const { before, after } = await loadScenes(
        detector,
        getSize,
        input.beforePath,
        input.afterPath,
        options,
      );
      const comparison = compareScenes(before, after, { moveTolerance: input.tolerance });
      return jsonResult(toReport(comparison));
    },
  });
  registerTool(server, {
    name: 'list_labels',
    description:
      'List the object class names the detector can recognize (the 80 COCO classes). Takes no input. ' +
      'Use it to tell the user which objects compare_scenes can actually see.',
    inputSchema: listLabelsInput,
    handler: async () => {
      const labels = listCocoLabels();
      return jsonResult({ count: labels.length, labels });
    },
  });
  return server;
}
// Only serve when invoked directly, not when imported by tests.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  serveOverStdio(SERVER_NAME, createServer);
}
