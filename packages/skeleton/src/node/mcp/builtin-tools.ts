// Node-only. The two Tools every app server gets for free (Requirements 3.1 and 3.2).

import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { countByLabel } from '../../detector/count-by-label.js';
import type { BoxLimits } from '../../detector/filter-by-box-limits.js';
import type { ContextRule } from '../../detector/filter-by-context.js';
import type { DetectOptions, Detector } from '../../detector/types.js';
import { registerTool } from './register-tool.js';
import { jsonResult } from './results.js';

const imageInput = z.object({
  imagePath: z
    .string()
    .min(1)
    .describe('Path to a JPEG or PNG image. Relative paths are resolved inside the allowed images folder.'),
  minConfidence: z.number().min(0).max(1).optional().describe('Ignore detections below this confidence, from 0 to 1.'),
  minConfidenceByLabel: z
    .record(z.string(), z.number().min(0).max(1))
    .optional()
    .describe(
      'Per-label confidence thresholds, from 0 to 1, for example {"apple": 0.2}. ' +
        'A listed label uses its own threshold instead of minConfidence. Other labels are unaffected.',
    ),
});

/** Zod marks optional fields as possibly undefined. Copy only the fields that are set. */
function stripUndefined(limits: Record<string, { [K in keyof BoxLimits]?: number | undefined }>): Record<string, BoxLimits> {
  const out: Record<string, BoxLimits> = {};
  for (const [label, l] of Object.entries(limits)) {
    const clean: BoxLimits = {};
    if (l.minArea !== undefined) clean.minArea = l.minArea;
    if (l.maxArea !== undefined) clean.maxArea = l.maxArea;
    if (l.minAspectRatio !== undefined) clean.minAspectRatio = l.minAspectRatio;
    if (l.maxAspectRatio !== undefined) clean.maxAspectRatio = l.maxAspectRatio;
    if (l.minAreaFraction !== undefined) clean.minAreaFraction = l.minAreaFraction;
    if (l.maxAreaFraction !== undefined) clean.maxAreaFraction = l.maxAreaFraction;
    out[label] = clean;
  }
  return out;
}
type ContextRuleInput = {
  label: string | string[];
  dropWhenPresent?: string[] | undefined;
  keepOnlyWhenPresent?: string[] | undefined;
  evidenceMinConfidence?: number | undefined;
};
function cleanRule(r: ContextRuleInput): ContextRule {
  const rule: ContextRule = { label: r.label };
  if (r.dropWhenPresent !== undefined) rule.dropWhenPresent = r.dropWhenPresent;
  if (r.keepOnlyWhenPresent !== undefined) rule.keepOnlyWhenPresent = r.keepOnlyWhenPresent;
  if (r.evidenceMinConfidence !== undefined) rule.evidenceMinConfidence = r.evidenceMinConfidence;
  return rule;
}
function optionsFrom(input: {
  minConfidence?: number | undefined;
  minConfidenceByLabel?: Record<string, number> | undefined;
  boxLimitsByLabel?: Record<string, { [K in keyof BoxLimits]?: number | undefined }> | undefined;
  contextRules?: ContextRuleInput[] | undefined;
  iouThreshold?: number | undefined;
  nmsAcrossLabels?: boolean | undefined;
}): DetectOptions {
  const options: DetectOptions = {};
  if (input.minConfidence !== undefined) options.minConfidence = input.minConfidence;
  if (input.minConfidenceByLabel !== undefined) options.minConfidenceByLabel = input.minConfidenceByLabel;
  if (input.boxLimitsByLabel !== undefined) options.boxLimitsByLabel = stripUndefined(input.boxLimitsByLabel);
  if (input.contextRules !== undefined) options.contextRules = input.contextRules.map(cleanRule);
  if (input.iouThreshold !== undefined) options.iouThreshold = input.iouThreshold;
  if (input.nmsAcrossLabels !== undefined) options.nmsAcrossLabels = input.nmsAcrossLabels;
  return options;
}

/**
 * Registers `detect_objects` and `count_objects`. Reading files safely (allowed folder, size caps,
 * JPEG and PNG only) is the job of the Detector's image decoder, so a model-chosen path is checked
 * there and a refusal comes back as an error result.
 */
export function registerBuiltinTools(server: McpServer, detector: Detector): void {
  registerTool(server, {
    name: 'detect_objects',
    description:
      'Detect objects in an image. Returns a list of detections, each with a label and a confidence from 0 to 1, ' +
      'and a bounding box when the model can locate the object.',
    inputSchema: imageInput,
    handler: async (input) => {
      const detections = await detector.detect({ kind: 'filePath', path: input.imagePath }, optionsFrom(input));
      return jsonResult(detections);
    },
  });

  registerTool(server, {
    name: 'count_objects',
    description: 'Count the objects in an image, grouped by label. Returns an object such as {"banana": 2, "bowl": 1}.',
    inputSchema: imageInput,
    handler: async (input) => {
      const detections = await detector.detect({ kind: 'filePath', path: input.imagePath }, optionsFrom(input));
      return jsonResult(countByLabel(detections));
    },
  });
}
