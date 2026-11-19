// Scene signals and context rules for COCO-SSD labels. Pure, browser-safe.
//
// The skeleton's `contextRules` option drops a label based on which other labels are in the same image.
// This file lists the COCO labels that signal a kitchen or an outdoor scene and the labels that do not
// belong in the other kind of scene, and builds the detect options from them. The CLI (--scene) and the
// compare_scenes MCP tool (scene) both go through buildDetectOptions.
import type { ContextRule, DetectOptions } from '@skeleton-playground/core';
export const SCENE_KINDS = ['kitchen', 'outdoor'] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];
/** COCO labels that show the photo was taken in a kitchen. */
export const KITCHEN_SIGNALS: readonly string[] = ['oven', 'microwave', 'refrigerator', 'sink', 'toaster'];
/** COCO labels that show the photo was taken outdoors. */
export const OUTDOOR_SIGNALS: readonly string[] = [
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'boat',
  'airplane',
  'train',
  'bus',
  'truck',
  'kite',
  'surfboard',
  'skis',
  'snowboard',
];
/** COCO labels that are implausible in a kitchen: the outdoor signals plus motorcycle and large animals. */
export const NOT_IN_KITCHEN: readonly string[] = [
  ...OUTDOOR_SIGNALS,
  'motorcycle',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
];
/** COCO labels that are implausible outdoors: fixed kitchen appliances and bathroom fixtures. */
export const NOT_OUTDOORS: readonly string[] = [...KITCHEN_SIGNALS, 'hair drier', 'toilet'];
/** Evidence detections must be at least this confident to count as a scene signal. */
export const SCENE_EVIDENCE_MIN_CONFIDENCE = 0.6;
/**
 * Context rules for one scene.
 * - kitchen: drops NOT_IN_KITCHEN labels when a kitchen signal is present.
 * - outdoor: drops NOT_OUTDOORS labels when an outdoor signal is present.
 */
export function sceneContextRules(scene: SceneKind): ContextRule[] {
  const evidenceMinConfidence = SCENE_EVIDENCE_MIN_CONFIDENCE;
  return scene === 'kitchen'
    ? [{ label: NOT_IN_KITCHEN, dropWhenPresent: KITCHEN_SIGNALS, evidenceMinConfidence }]
    : [{ label: NOT_OUTDOORS, dropWhenPresent: OUTDOOR_SIGNALS, evidenceMinConfidence }];
}
/** Builds the DetectOptions for a compare run from the optional minConfidence and scene. */
export function buildDetectOptions(input: { minConfidence?: number | undefined; scene?: SceneKind | undefined }): DetectOptions {
  const options: DetectOptions = {};
  if (input.minConfidence !== undefined) options.minConfidence = input.minConfidence;
  if (input.scene !== undefined) options.contextRules = sceneContextRules(input.scene);
  return options;
}
