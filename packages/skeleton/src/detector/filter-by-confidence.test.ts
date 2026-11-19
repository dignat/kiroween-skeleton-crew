import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { filterByConfidence } from './filter-by-confidence.js';
import type { Detection } from './types.js';

const detectionArb = fc.record({
  label: fc.string({ minLength: 1 }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
}) satisfies fc.Arbitrary<Detection>;

describe('filterByConfidence', () => {
  it('keeps only detections at or above the threshold (Requirement 10.2)', () => {
    fc.assert(
      fc.property(
        fc.array(detectionArb),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (detections, minConfidence) => {
          const result = filterByConfidence(detections, minConfidence);
          return result.every((d) => d.confidence >= minConfidence);
        },
      ),
    );
  });

  it('never grows the input', () => {
    fc.assert(
      fc.property(
        fc.array(detectionArb),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (detections, minConfidence) => filterByConfidence(detections, minConfidence).length <= detections.length,
      ),
    );
  });

  it('does not mutate the input array', () => {
    const detections: Detection[] = [
      { label: 'cat', confidence: 0.9 },
      { label: 'dog', confidence: 0.2 },
    ];
    const copy = detections.map((d) => ({ ...d }));
    filterByConfidence(detections, 0.5);
    expect(detections).toEqual(copy);
  });
  it('uses a per-label threshold for listed labels and the global one for the rest', () => {
    const detections: Detection[] = [
      { label: 'apple', confidence: 0.3 },
      { label: 'cup', confidence: 0.3 },
      { label: 'banana', confidence: 0.8 },
    ];
    const result = filterByConfidence(detections, 0.5, { apple: 0.2, banana: 0.9 });
    expect(result.map((d) => d.label)).toEqual(['apple']);
  });
  it('ignores inherited object keys as labels', () => {
    const result = filterByConfidence([{ label: 'toString', confidence: 0.6 }], 0.5, {});
    expect(result).toHaveLength(1);
  });
});
