import { afterEach, describe, expect, it, vi } from 'vitest';
import { importOptionalPeer } from './optional-peer.js';
import type { ImageDecoder } from './pixel-image.js';
const decodeImage: ImageDecoder = async () => ({ data: new Uint8Array(4), width: 1, height: 1 });
afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@tensorflow/tfjs');
  vi.doUnmock('@tensorflow-models/coco-ssd');
  vi.doUnmock('@tensorflow-models/mobilenet');
});
/** Fake TensorFlow.js, so these tests need no model download. */
const fakeTf = { ready: async () => {}, zeros: () => ({ dispose() {} }), browser: { fromPixels: () => ({ dispose() {} }) } };
describe('modelUrl option', () => {
  it('coco-ssd passes modelUrl to the model loader, and passes nothing when it is not set', async () => {
    const load = vi.fn(async () => ({ detect: async () => [] }));
    vi.doMock('@tensorflow/tfjs', () => fakeTf);
    vi.doMock('@tensorflow-models/coco-ssd', () => ({ load }));
    const { createCocoSsdAdapter } = await import('./coco-ssd-adapter.js');
    await createCocoSsdAdapter({ decodeImage, modelUrl: 'https://models.example/coco/model.json' }).load();
    expect(load).toHaveBeenLastCalledWith({ modelUrl: 'https://models.example/coco/model.json' });
    await createCocoSsdAdapter({ decodeImage }).load();
    expect(load).toHaveBeenLastCalledWith({});
  });
  it('mobilenet-food passes modelUrl to the model loader, and keeps the default version when it is not set', async () => {
    const load = vi.fn(async () => ({ classify: async () => [] }));
    vi.doMock('@tensorflow/tfjs', () => fakeTf);
    vi.doMock('@tensorflow-models/mobilenet', () => ({ load }));
    const { createMobileNetFoodAdapter } = await import('./mobilenet-food-adapter.js');
    await createMobileNetFoodAdapter({ decodeImage, allowedLabels: [], modelUrl: 'https://models.example/mn/model.json' }).load();
    expect(load).toHaveBeenLastCalledWith({ version: 2, alpha: 1.0, modelUrl: 'https://models.example/mn/model.json' });
    await createMobileNetFoodAdapter({ decodeImage, allowedLabels: [] }).load();
    expect(load).toHaveBeenLastCalledWith({ version: 2, alpha: 1.0 });
  });
});
describe('importOptionalPeer', () => {
  const notFound = (name: string) => async () => {
    throw Object.assign(new Error(`Cannot find package '${name}' imported from somewhere`), { code: 'ERR_MODULE_NOT_FOUND' });
  };
  it('returns the module when it loads', async () => {
    await expect(importOptionalPeer('pkg', 'demo', async () => ({ ok: true }))).resolves.toEqual({ ok: true });
  });
  it('names the missing package and how to install it', async () => {
    await expect(importOptionalPeer('@tensorflow/tfjs', 'coco-ssd', notFound('@tensorflow/tfjs'), '@tensorflow-models/coco-ssd')).rejects.toThrow(
      /coco-ssd adapter needs the optional package "@tensorflow\/tfjs".*pnpm add --save-exact @tensorflow\/tfjs @tensorflow-models\/coco-ssd/,
    );
  });
  it('also recognises a bundler "failed to resolve" message', async () => {
    const load = async () => {
      throw new Error('Failed to resolve import "@tensorflow/tfjs" from "src/x.ts"');
    };
    await expect(importOptionalPeer('@tensorflow/tfjs', 'coco-ssd', load)).rejects.toThrow(/needs the optional package/);
  });
  it('rethrows an unrelated error, and a not-found error about a different package, unchanged', async () => {
    await expect(importOptionalPeer('@tensorflow/tfjs', 'coco-ssd', async () => { throw new Error('backend exploded'); })).rejects.toThrow('backend exploded');
    await expect(importOptionalPeer('@tensorflow/tfjs', 'coco-ssd', notFound('some-other-pkg'))).rejects.toThrow(/Cannot find package 'some-other-pkg'/);
  });
});
