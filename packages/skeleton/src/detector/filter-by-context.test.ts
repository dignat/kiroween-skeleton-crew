import { describe, expect, it } from 'vitest';
import { filterByContext } from './filter-by-context.js';
import type { Detection } from './types.js';
const d = (label: string, confidence = 0.9): Detection => ({ label, confidence });
describe('filterByContext', () => {
  it('drops a label when a signalling label is present', () => {
    const input = [d('boat'), d('oven'), d('cup')];
    const result = filterByContext(input, [{ label: 'boat', dropWhenPresent: ['oven', 'sink'] }]);
    expect(result.map((x) => x.label)).toEqual(['oven', 'cup']);
  });
  it('keeps the label when no signalling label is present', () => {
    const input = [d('boat'), d('person')];
    expect(filterByContext(input, [{ label: 'boat', dropWhenPresent: ['oven'] }])).toEqual(input);
  });
  it('keepOnlyWhenPresent drops the label unless a required label is present', () => {
    const rule = { label: 'surfboard', keepOnlyWhenPresent: ['person'] };
    expect(filterByContext([d('surfboard')], [rule])).toEqual([]);
    expect(filterByContext([d('surfboard'), d('person')], [rule])).toHaveLength(2);
  });
  it('counts only evidence at or above evidenceMinConfidence', () => {
    const rule = { label: 'boat', dropWhenPresent: ['oven'], evidenceMinConfidence: 0.6 };
    expect(filterByContext([d('boat'), d('oven', 0.3)], [rule])).toHaveLength(2);
    expect(filterByContext([d('boat'), d('oven', 0.6)], [rule]).map((x) => x.label)).toEqual(['oven']);
  });
  it('accepts several target labels in one rule', () => {
    const rule = { label: ['boat', 'airplane'], dropWhenPresent: ['oven'] };
    expect(filterByContext([d('boat'), d('airplane'), d('oven')], [rule]).map((x) => x.label)).toEqual(['oven']);
  });
  it('checks rules against the original list, so rule order does not matter', () => {
    const rules = [
      { label: 'oven', dropWhenPresent: ['boat'] },
      { label: 'boat', dropWhenPresent: ['oven'] },
    ];
    const input = [d('boat'), d('oven')];
    expect(filterByContext(input, rules)).toEqual([]);
    expect(filterByContext(input, [...rules].reverse())).toEqual([]);
  });
  it('returns a copy and ignores an empty rule list', () => {
    const input = [d('boat')];
    const result = filterByContext(input, []);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});
