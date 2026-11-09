// Poltergeist Detector: app logic entry point.
// The CLI and the compare_scenes MCP tool (task 16) both call this same logic.

import { SKELETON_NAME } from '@skeleton-crew/core';

export const APP_NAME = 'poltergeist-detector';
export const BUILT_ON = SKELETON_NAME;

export {
  compareScenes,
  DEFAULT_MOVE_TOLERANCE,
  type CompareScenesOptions,
  type MatchedChange,
  type SceneComparison,
} from './compare-scenes.js';
export {
  toReport,
  formatHauntingReport,
  formatJson,
  type HauntingReport,
} from './format-report.js';
export { loadScenes, type ImageSizer } from './load-scenes.js';
export { CliArgsError, SceneLoadError } from './errors/index.js';
