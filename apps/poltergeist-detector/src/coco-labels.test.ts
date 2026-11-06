import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { listCocoLabels } from './coco-labels.js';

describe('listCocoLabels', () => {
  it('returns the 80 COCO classes', () => {
    expect(listCocoLabels()).toHaveLength(80);
  });

  it('includes well-known COCO labels', () => {
    const labels = listCocoLabels();
    for (const label of ['person', 'cup', 'apple', 'dining table', 'cell phone']) {
      expect(labels).toContain(label);
    }
  });

  it('has no duplicates', () => {
    const labels = listCocoLabels();
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every label is a non-empty lower-case string', () => {
    for (const label of listCocoLabels()) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).toBe(label.toLowerCase());
    }
  });

  it('returns a fresh copy each call, so callers cannot mutate the source (property)', () => {
    fc.assert(
      fc.property(fc.string(), (junk) => {
        const first = listCocoLabels();
        first.push(junk);
        // A second call must be unaffected by mutating the first result.
        return listCocoLabels().length === 80;
      }),
    );
  });
});
