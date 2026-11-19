import { filterByContext, type Detection } from '@skeleton-playground/core';
import { describe, expect, it } from 'vitest';
import { listCocoLabels } from './coco-labels.js';
import { KITCHEN_SIGNALS, NOT_IN_KITCHEN, NOT_OUTDOORS, OUTDOOR_SIGNALS, buildDetectOptions, sceneContextRules } from './scene-context.js';
const d = (label: string, confidence = 0.9): Detection => ({ label, confidence });
const labels = (list: Detection[]) => list.map((x) => x.label);
describe('scene context', () => {
  it('drops a boat in a kitchen scene', () => {
    expect(labels(filterByContext([d('boat'), d('oven'), d('cup')], sceneContextRules('kitchen')))).toEqual(['oven', 'cup']);
  });
  it('keeps a boat when there is no kitchen signal', () => {
    expect(labels(filterByContext([d('boat'), d('person')], sceneContextRules('kitchen')))).toEqual(['boat', 'person']);
  });
  it('drops kitchen appliances in an outdoor scene', () => {
    expect(labels(filterByContext([d('oven'), d('traffic light'), d('person')], sceneContextRules('outdoor')))).toEqual(['traffic light', 'person']);
  });
  it('ignores weak evidence below 0.6', () => {
    expect(filterByContext([d('boat'), d('oven', 0.4)], sceneContextRules('kitchen'))).toHaveLength(2);
  });
  it('uses only labels the COCO detector can return, and never lists a signal as implausible for its own scene', () => {
    const known = new Set(listCocoLabels());
    for (const l of [...KITCHEN_SIGNALS, ...OUTDOOR_SIGNALS, ...NOT_IN_KITCHEN, ...NOT_OUTDOORS]) expect(known.has(l), l).toBe(true);
    expect(NOT_IN_KITCHEN.some((l) => KITCHEN_SIGNALS.includes(l))).toBe(false);
    expect(NOT_OUTDOORS.some((l) => OUTDOOR_SIGNALS.includes(l))).toBe(false);
  });
  it('buildDetectOptions sets only what was given', () => {
    expect(buildDetectOptions({})).toEqual({});
    expect(buildDetectOptions({ minConfidence: 0.3 })).toEqual({ minConfidence: 0.3 });
    expect(buildDetectOptions({ scene: 'kitchen' }).contextRules).toEqual(sceneContextRules('kitchen'));
  });
});
