// Poltergeist Detector MCP server. Declares its two tools (compare_scenes,
// list_labels) and hands them to the skeleton's serveApp helper, which wires the
// built-in detect_objects / count_objects and serves over stdio. The CLI and
// these tools share the same compareScenes logic (Requirement 5.10).
import type { DetectOptions } from '@skeleton-crew/core';
import { createAppServer, defineTool, jsonResult, serveApp, z } from '@skeleton-crew/core/node';
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

/** Builds the server: built-in tools plus this app's tools, sharing one detector. */
export function createServer() {
  const allowedRoot = process.cwd();
  const detector = createCocoDetector(allowedRoot);
  const getSize = createImageSizer();

  return createAppServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    detector,
    tools: [
      defineTool({
        name: 'compare_scenes',
        description:
          'Compare two photos of the same place and report what appeared, vanished, moved or stayed. ' +
          'Take both photos from the same spot with objects large and clearly separated.',
        inputSchema: compareInput,
        handler: async (input) => {
          const options: DetectOptions =
            input.minConfidence === undefined ? {} : { minConfidence: input.minConfidence };
          const { before, after } = await loadScenes(detector, getSize, input.beforePath, input.afterPath, options);
          const comparison = compareScenes(before, after, { moveTolerance: input.tolerance });
          return jsonResult(toReport(comparison));
        },
      }),
      defineTool({
        name: 'list_labels',
        description:
          'List the object class names the detector can recognize (the 80 COCO classes). Takes no input. ' +
          'Use it to tell the user which objects compare_scenes can actually see.',
        inputSchema: z.object({}),
        handler: async () => {
          const labels = listCocoLabels();
          return jsonResult({ count: labels.length, labels });
        },
      }),
    ],
  });
}

// Only serve when invoked directly, not when imported by tests.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  serveApp(SERVER_NAME, createServer);
}
