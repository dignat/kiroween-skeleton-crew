import { describe, expect, it } from 'vitest';
import type { Detection, DetectorInterface, DetectorImageInput } from '@skeleton-crew/core';
import { loadScenes, SceneLoadError, type ImageSizer } from './load-scenes.js';

/** Fake detector: returns canned pixel-box detections keyed by file path. */
function fakeDetector(byPath: Record<string, Detection[]>): DetectorInterface {
  return {
    async detect(image: DetectorImageInput): Promise<Detection[]> {
      if (image.kind !== 'filePath') throw new Error('expected filePath');
      const hit = byPath[image.path];
      if (!hit) throw new Error(`no fake detections for ${image.path}`);
      return hit;
    },
  };
}

const fixedSizer =
  (width: number, height: number): ImageSizer =>
  async () => ({ width, height });

describe('loadScenes', () => {
  it('normalizes pixel boxes to 0..1 using image size (Requirement 15.6)', async () => {
    const detector = fakeDetector({
      'before.jpg': [{ label: 'cup', confidence: 0.9, box: { x: 500, y: 250, width: 100, height: 100 } }],
      'after.jpg': [{ label: 'cup', confidence: 0.9, box: { x: 500, y: 250, width: 100, height: 100 } }],
    });
    const { before, after } = await loadScenes(detector, fixedSizer(1000, 500), 'before.jpg', 'after.jpg');
    expect(before[0]!.box).toEqual({ x: 0.5, y: 0.5, width: 0.1, height: 0.2 });
    expect(after[0]!.box).toEqual({ x: 0.5, y: 0.5, width: 0.1, height: 0.2 });
  });

  it('leaves box-less detections untouched', async () => {
    const detector = fakeDetector({
      'b.jpg': [{ label: 'apple', confidence: 0.8 }],
      'a.jpg': [{ label: 'apple', confidence: 0.8 }],
    });
    const { before } = await loadScenes(detector, fixedSizer(800, 600), 'b.jpg', 'a.jpg');
    expect(before[0]!.box).toBeUndefined();
  });

  it('names the before photo when it fails (Requirement 5.8)', async () => {
    const detector = fakeDetector({ 'after.jpg': [] });
    await expect(
      loadScenes(detector, fixedSizer(800, 600), 'missing-before.jpg', 'after.jpg'),
    ).rejects.toMatchObject({ name: 'SceneLoadError', which: 'before', path: 'missing-before.jpg' });
  });

  it('names the after photo when it fails (Requirement 5.8)', async () => {
    const detector = fakeDetector({ 'before.jpg': [] });
    await expect(
      loadScenes(detector, fixedSizer(800, 600), 'before.jpg', 'missing-after.jpg'),
    ).rejects.toBeInstanceOf(SceneLoadError);
  });

  it('runs the before photo before the after photo', async () => {
    const order: string[] = [];
    const detector: DetectorInterface = {
      async detect(image: DetectorImageInput) {
        if (image.kind === 'filePath') order.push(image.path);
        return [];
      },
    };
    await loadScenes(detector, fixedSizer(10, 10), 'first.jpg', 'second.jpg');
    expect(order).toEqual(['first.jpg', 'second.jpg']);
  });
});
