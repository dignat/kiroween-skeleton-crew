import { describe, expect, it } from 'vitest';
import type { Detection } from '@skeleton-crew/core';
import { compareScenes } from './compare-scenes.js';
import { formatHauntingReport, formatJson, toReport } from './format-report.js';

const box = (cx: number, cy: number): NonNullable<Detection['box']> => ({
  x: cx - 0.05,
  y: cy - 0.05,
  width: 0.1,
  height: 0.1,
});

describe('report formatter', () => {
  it('flags nothingDetected when both photos were empty (Requirement 15.5)', () => {
    const report = toReport(compareScenes([], []));
    expect(report.nothingDetected).toBe(true);
    const text = formatHauntingReport(compareScenes([], []));
    expect(text).toContain('Nothing was detected in either photo');
  });

  it('reports a calm scene when nothing appeared, vanished or moved', () => {
    const scene: Detection[] = [{ label: 'cup', confidence: 0.9, box: box(0.5, 0.5) }];
    const text = formatHauntingReport(compareScenes(scene, scene));
    expect(text).toContain('calm');
    expect(text).toContain('cup');
  });

  it('lists appeared, vanished and moved objects', () => {
    const before: Detection[] = [
      { label: 'cup', confidence: 0.9, box: box(0.2, 0.2) },
      { label: 'apple', confidence: 0.8, box: box(0.5, 0.5) },
    ];
    const after: Detection[] = [
      { label: 'cup', confidence: 0.9, box: box(0.4, 0.4) }, // moved
      { label: 'book', confidence: 0.7, box: box(0.8, 0.8) }, // appeared
    ];
    const text = formatHauntingReport(compareScenes(before, after));
    expect(text).toContain('Appeared');
    expect(text).toContain('book');
    expect(text).toContain('Vanished');
    expect(text).toContain('apple');
    expect(text).toContain('Moved');
    expect(text).toContain('cup');
  });

  it('produces valid JSON mirroring the comparison', () => {
    const before: Detection[] = [{ label: 'cup', confidence: 0.9, box: box(0.2, 0.2) }];
    const after: Detection[] = [{ label: 'cup', confidence: 0.9, box: box(0.8, 0.8) }];
    const json = formatJson(compareScenes(before, after));
    const parsed = JSON.parse(json);
    expect(parsed.moved).toHaveLength(1);
    expect(parsed.moved[0].label).toBe('cup');
    expect(parsed.nothingDetected).toBe(false);
  });
});
