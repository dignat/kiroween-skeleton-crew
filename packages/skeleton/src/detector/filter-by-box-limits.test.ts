import { describe, expect, it } from 'vitest';
import { filterByBoxLimits } from './filter-by-box-limits.js';
import type { Detection } from './types.js';
const det = (label: string, width: number, height: number): Detection => ({
  label,
  confidence: 0.9,
  box: { x: 0, y: 0, width, height },
});
describe('filterByBoxLimits', () => {
  it('drops boxes that are too small or too large for their label', () => {
    const input = [det('cup', 2, 2), det('cup', 50, 50), det('cup', 500, 500)];
    const result = filterByBoxLimits(input, { cup: { minArea: 100, maxArea: 10000 } });
    expect(result).toEqual([input[1]]);
  });
  it('drops boxes with an implausible aspect ratio', () => {
    const input = [det('person', 10, 100), det('person', 100, 10), det('person', 40, 80)];
    const result = filterByBoxLimits(input, { person: { minAspectRatio: 0.25, maxAspectRatio: 1 } });
    expect(result).toEqual([input[2]]);
  });
  it('keeps other labels, boxless detections and inherited keys untouched', () => {
    const input: Detection[] = [det('bowl', 1, 1), { label: 'apple', confidence: 0.5 }, det('toString', 1, 1)];
    expect(filterByBoxLimits(input, { apple: { minArea: 1000 } })).toEqual(input);
  });
  it('treats limits as inclusive', () => {
    const input = [det('cup', 10, 10)];
    expect(filterByBoxLimits(input, { cup: { minArea: 100, maxArea: 100 } })).toEqual(input);
  });
  it('applies area fractions relative to the image size', () => {
    const input = [det('cup', 10, 10), det('cup', 80, 80)];
    const size = { width: 100, height: 100 };
    expect(filterByBoxLimits(input, { cup: { maxAreaFraction: 0.5 } }, size)).toEqual([input[0]]);
    expect(filterByBoxLimits(input, { cup: { minAreaFraction: 0.005 } }, size)).toEqual(input);
    expect(filterByBoxLimits(input, { cup: { minAreaFraction: 0.05 } }, { width: 1000, height: 1000 })).toEqual([]);
  });
  it('skips fraction limits when the image size is unknown', () => {
    const input = [det('cup', 80, 80)];
    expect(filterByBoxLimits(input, { cup: { maxAreaFraction: 0.01 } })).toEqual(input);
  });
});
