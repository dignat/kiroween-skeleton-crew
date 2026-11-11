import { describe, expect, it } from 'vitest';
import { createCocoSsdAdapter } from './coco-ssd-adapter.js';
import { createMobileNetFoodAdapter } from './mobilenet-food-adapter.js';
import type { ImageDecoder } from './pixel-image.js';

// Never reached: infer() must fail before it decodes anything.
const decodeImage: ImageDecoder = async () => {
  throw new Error('decoder should not be called');
};

describe('model adapters before load()', () => {
  it('coco-ssd refuses infer() until load() has run', async () => {
    const adapter = createCocoSsdAdapter({ decodeImage });
    await expect(adapter.infer({ kind: 'filePath', path: 'x.png' })).rejects.toThrow(/before load\(\)/);
  });

  it('mobilenet-food refuses infer() until load() has run', async () => {
    const adapter = createMobileNetFoodAdapter({ decodeImage, allowedLabels: ['banana'] });
    await expect(adapter.infer({ kind: 'filePath', path: 'x.png' })).rejects.toThrow(/before load\(\)/);
  });

  it('reports the documented default thresholds', () => {
    expect(createCocoSsdAdapter({ decodeImage }).defaultMinConfidence).toBe(0.5);
    expect(createMobileNetFoodAdapter({ decodeImage, allowedLabels: [] }).defaultMinConfidence).toBe(0.1);
  });
});
