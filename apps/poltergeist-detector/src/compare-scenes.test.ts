import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Detection } from '@skeleton-playground/core';
import {
  compareScenes,
  DEFAULT_MOVE_TOLERANCE,
  type SceneComparison,
} from './compare-scenes.js';

// A Detection arbitrary with a normalized box (0..1). Labels are drawn from a
// small set so matches actually happen.
const detectionArb: fc.Arbitrary<Detection> = fc.record({
  label: fc.constantFrom('cup', 'apple', 'book', 'bottle'),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  box: fc.record({
    x: fc.float({ min: 0, max: Math.fround(0.8), noNaN: true }),
    y: fc.float({ min: 0, max: Math.fround(0.8), noNaN: true }),
    width: fc.float({ min: Math.fround(0.05), max: Math.fround(0.2), noNaN: true }),
    height: fc.float({ min: Math.fround(0.05), max: Math.fround(0.2), noNaN: true }),
  }),
});

const sceneArb = fc.array(detectionArb, { maxLength: 8 });

/** Count every detection the comparison reports from the "before" side. */
function beforeReportCount(r: SceneComparison): number {
  return r.vanished.length + r.moved.length + r.unchanged.length;
}

/** Count every detection the comparison reports from the "after" side. */
function afterReportCount(r: SceneComparison): number {
  return r.appeared.length + r.moved.length + r.unchanged.length;
}

describe('compareScenes', () => {
  it('every before Detection is reported exactly once and every after Detection exactly once (Requirement 10.5)', () => {
    fc.assert(
      fc.property(sceneArb, sceneArb, (before, after) => {
        const r = compareScenes(before, after);
        expect(beforeReportCount(r)).toBe(before.length);
        expect(afterReportCount(r)).toBe(after.length);
      }),
    );
  });

  it('swapping before and after swaps appeared and vanished counts per label (Requirement 10.6)', () => {
    fc.assert(
      fc.property(sceneArb, sceneArb, (before, after) => {
        const forward = compareScenes(before, after);
        const backward = compareScenes(after, before);
        // Appeared in one direction is vanished in the other, and vice versa.
        expect(countByLabel(backward.vanished)).toEqual(countByLabel(forward.appeared));
        expect(countByLabel(backward.appeared)).toEqual(countByLabel(forward.vanished));
      }),
    );
  });

  it('comparing a scene with itself reports nothing appeared, vanished or moved (Requirement 10.6)', () => {
    fc.assert(
      fc.property(sceneArb, (scene) => {
        const r = compareScenes(scene, scene);
        expect(r.appeared).toEqual([]);
        expect(r.vanished).toEqual([]);
        expect(r.moved).toEqual([]);
        // Everything is accounted for as unchanged.
        expect(r.unchanged.length).toBe(scene.length);
      }),
    );
  });

  // --- Example tests for the tolerance edges (Requirement 15.4) ---

  const boxAt = (cx: number, cy: number): NonNullable<Detection['box']> => ({
    x: cx - 0.05,
    y: cy - 0.05,
    width: 0.1,
    height: 0.1,
  });

  it('an object just inside moveTolerance is unchanged', () => {
    const before: Detection[] = [{ label: 'cup', confidence: 0.9, box: boxAt(0.5, 0.5) }];
    // drift of 0.04 < 0.05 tolerance
    const after: Detection[] = [{ label: 'cup', confidence: 0.9, box: boxAt(0.54, 0.5) }];
    const r = compareScenes(before, after);
    expect(r.unchanged).toHaveLength(1);
    expect(r.moved).toHaveLength(0);
    expect(r.unchanged[0]!.drift).toBeCloseTo(0.04, 5);
  });

  it('an object just outside moveTolerance is moved', () => {
    const before: Detection[] = [{ label: 'cup', confidence: 0.9, box: boxAt(0.5, 0.5) }];
    // drift of 0.06 > 0.05 tolerance
    const after: Detection[] = [{ label: 'cup', confidence: 0.9, box: boxAt(0.56, 0.5) }];
    const r = compareScenes(before, after);
    expect(r.moved).toHaveLength(1);
    expect(r.unchanged).toHaveLength(0);
    expect(r.moved[0]!.drift).toBeCloseTo(0.06, 5);
  });

  it('a Detection without a bounding box matches by label and counts as unchanged', () => {
    const before: Detection[] = [{ label: 'apple', confidence: 0.8 }];
    const after: Detection[] = [{ label: 'apple', confidence: 0.7 }];
    const r = compareScenes(before, after);
    expect(r.unchanged).toHaveLength(1);
    expect(r.unchanged[0]!.drift).toBe(0);
    expect(r.moved).toHaveLength(0);
  });

  it('two objects of one label swapping places are both matched (nearest-pair, both within tolerance stays unchanged)', () => {
    const before: Detection[] = [
      { label: 'cup', confidence: 0.9, box: boxAt(0.2, 0.2) },
      { label: 'cup', confidence: 0.9, box: boxAt(0.8, 0.8) },
    ];
    // Both cups swap corners. Greedy nearest-pair matches each to the nearest
    // available after-cup, so both are matched (no spurious appeared/vanished).
    const after: Detection[] = [
      { label: 'cup', confidence: 0.9, box: boxAt(0.8, 0.8) },
      { label: 'cup', confidence: 0.9, box: boxAt(0.2, 0.2) },
    ];
    const r = compareScenes(before, after);
    expect(r.appeared).toHaveLength(0);
    expect(r.vanished).toHaveLength(0);
    expect(r.moved.length + r.unchanged.length).toBe(2);
  });

  it('empty lists produce an all-empty comparison', () => {
    const r = compareScenes([], []);
    expect(r).toEqual({ appeared: [], vanished: [], moved: [], unchanged: [] });
  });

  it('all before, no after: everything vanished', () => {
    const before: Detection[] = [
      { label: 'cup', confidence: 0.9, box: boxAt(0.3, 0.3) },
      { label: 'apple', confidence: 0.8, box: boxAt(0.6, 0.6) },
    ];
    const r = compareScenes(before, []);
    expect(r.vanished).toHaveLength(2);
    expect(r.appeared).toHaveLength(0);
  });

  it('no before, all after: everything appeared', () => {
    const after: Detection[] = [{ label: 'book', confidence: 0.9, box: boxAt(0.5, 0.5) }];
    const r = compareScenes([], after);
    expect(r.appeared).toHaveLength(1);
    expect(r.vanished).toHaveLength(0);
  });

  it('exposes the Spike E default tolerance of 0.05', () => {
    expect(DEFAULT_MOVE_TOLERANCE).toBe(0.05);
  });
});

/** Local helper: count detections per label (mirrors the skeleton's countByLabel). */
function countByLabel(detections: readonly Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of detections) counts[d.label] = (counts[d.label] ?? 0) + 1;
  return counts;
}
