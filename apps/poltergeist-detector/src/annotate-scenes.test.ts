import type { Detection, PixelImage } from '@skeleton-playground/core';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { annotateScenes, COLORS, downscale, renderComparisonPng, sideBySide } from './annotate-scenes.js';
import type { SceneComparison } from './compare-scenes.js';

function blank(width: number, height: number): PixelImage {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function det(label: string, x: number, y: number, w: number, h: number): Detection {
  return { label, confidence: 0.9, box: { x, y, width: w, height: h } };
}

function pixel(img: PixelImage, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
}

const empty: SceneComparison = { appeared: [], vanished: [], moved: [], unchanged: [] };

describe('annotateScenes', () => {
  it('draws vanished in the before image only and appeared in the after image only', () => {
    const before = blank(100, 100);
    const after = blank(100, 100);
    const comparison: SceneComparison = {
      ...empty,
      vanished: [det('cup', 0.1, 0.1, 0.4, 0.4)],
      appeared: [det('book', 0.5, 0.5, 0.4, 0.4)],
    };
    const out = annotateScenes(before, after, comparison);

    expect(pixel(out.before, 10, 10)).toEqual([...COLORS.vanished]);
    expect(pixel(out.after, 10, 10)).toEqual([0, 0, 0]);
    expect(pixel(out.after, 50, 50)).toEqual([...COLORS.appeared]);
    expect(pixel(out.before, 50, 50)).toEqual([0, 0, 0]);
  });

  it('draws a moved object in both photos', () => {
    const comparison: SceneComparison = {
      ...empty,
      moved: [
        { label: 'cup', drift: 0.3, before: det('cup', 0.1, 0.1, 0.2, 0.2), after: det('cup', 0.6, 0.6, 0.2, 0.2) },
      ],
    };
    const out = annotateScenes(blank(100, 100), blank(100, 100), comparison);
    expect(pixel(out.before, 10, 10)).toEqual([...COLORS.moved]);
    expect(pixel(out.after, 60, 60)).toEqual([...COLORS.moved]);
  });

  it('does not change the input images and clips boxes that leave the frame', () => {
    const before = blank(50, 50);
    const comparison: SceneComparison = { ...empty, vanished: [det('cup', 0.8, 0.8, 0.6, 0.6)] };
    expect(() => annotateScenes(before, blank(50, 50), comparison)).not.toThrow();
    expect(before.data.every((v) => v === 0)).toBe(true);
  });

  it('skips detections that have no box', () => {
    const noBox: Detection = { label: 'cup', confidence: 0.9 };
    const out = annotateScenes(blank(20, 20), blank(20, 20), { ...empty, vanished: [noBox] });
    expect(out.before.data.every((v) => v === 0)).toBe(true);
  });
});

describe('downscale', () => {
  it('keeps small images and shrinks wide ones, keeping the aspect ratio', () => {
    const small = blank(40, 30);
    expect(downscale(small, 100)).toBe(small);
    const shrunk = downscale(blank(400, 200), 100);
    expect(shrunk.width).toBe(100);
    expect(shrunk.height).toBe(50);
    expect(shrunk.data.length).toBe(100 * 50 * 4);
  });
});

describe('sideBySide and renderComparisonPng', () => {
  it('places the images next to each other with a gap', () => {
    const left = blank(10, 8);
    const right = blank(6, 12);
    left.data.fill(255);
    const combined = sideBySide(left, right);
    expect(combined.height).toBe(12);
    expect(combined.width).toBeGreaterThan(16);
    expect(pixel(combined, 0, 0)).toEqual([255, 255, 255]);
  });

  it('produces a valid PNG as wide as both photos plus the gap', () => {
    const bytes = renderComparisonPng(blank(30, 20), blank(30, 20), empty);
    const png = PNG.sync.read(bytes);
    expect(png.height).toBe(20);
    expect(png.width).toBeGreaterThan(60);
  });
});
