import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { iou, nonMaxSuppression } from './non-max-suppression.js';
import type { Detection } from './types.js';
const det = (label: string, confidence: number, x: number, y = 0, w = 10, h = 10): Detection => ({
  label,
  confidence,
  box: { x, y, width: w, height: h },
});
const detectionArb = fc.record({
  label: fc.constantFrom('a', 'b', 'c'),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  box: fc.record({
    x: fc.integer({ min: 0, max: 50 }),
    y: fc.integer({ min: 0, max: 50 }),
    width: fc.integer({ min: 1, max: 30 }),
    height: fc.integer({ min: 1, max: 30 }),
  }),
}) as fc.Arbitrary<Detection>;
describe('iou', () => {
  it('is 1 for identical boxes and 0 for disjoint ones', () => {
    expect(iou(det('a', 1, 0).box!, det('a', 1, 0).box!)).toBe(1);
    expect(iou(det('a', 1, 0).box!, det('a', 1, 100).box!)).toBe(0);
  });
});
describe('nonMaxSuppression', () => {
  it('keeps the most confident of two overlapping same-label boxes', () => {
    const result = nonMaxSuppression([det('a', 0.6, 1), det('a', 0.9, 0)], 0.5);
    expect(result.map((d) => d.confidence)).toEqual([0.9]);
  });
  it('keeps overlapping boxes with different labels unless acrossLabels is set', () => {
    const input = [det('a', 0.9, 0), det('b', 0.8, 0)];
    expect(nonMaxSuppression(input, 0.5)).toHaveLength(2);
    expect(nonMaxSuppression(input, 0.5, { acrossLabels: true })).toHaveLength(1);
  });
  it('keeps boxes that overlap less than the threshold', () => {
    expect(nonMaxSuppression([det('a', 0.9, 0), det('a', 0.8, 8)], 0.5)).toHaveLength(2);
  });
  it('always keeps detections without a box', () => {
    const input: Detection[] = [{ label: 'a', confidence: 0.1 }, { label: 'a', confidence: 0.2 }];
    expect(nonMaxSuppression(input, 0)).toEqual(input);
  });
  it('keeps input order and never adds detections', () => {
    fc.assert(
      fc.property(fc.array(detectionArb), fc.float({ min: 0, max: 1, noNaN: true }), (input, t) => {
        const result = nonMaxSuppression(input, t);
        const positions = result.map((d) => input.indexOf(d));
        return positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]!));
      }),
    );
  });
  it('leaves no kept same-label pair at or above the threshold', () => {
    fc.assert(
      fc.property(fc.array(detectionArb), fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }), (input, t) => {
        const r = nonMaxSuppression(input, t);
        return r.every((a, i) => r.every((b, j) => i === j || a.label !== b.label || iou(a.box!, b.box!) < t));
      }),
    );
  });
});
