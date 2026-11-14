// Browser ImageDecoder for the skeleton's Detector. Draws the image to a canvas
// and reads back RGBA pixels, the browser counterpart to the Node jpeg/png decoder.
// This is the only environment-specific piece the food adapter needs.

import type { DetectorImageInput, PixelImage } from '@skeleton-playground/core';
import { UnsupportedImageError } from '@skeleton-playground/core';

/** Largest side we feed the model. Big phone photos are downscaled for speed. */
const MAX_SIDE = 1024;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UnsupportedImageError('The browser could not decode this image.'));
    img.src = src;
  });
}

/** Scales (w, h) so the longest side is at most MAX_SIDE, keeping aspect ratio. */
function fitWithin(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_SIDE) return { width, height };
  const scale = MAX_SIDE / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Creates a canvas-based ImageDecoder. It accepts the base64 input the Detector
 * passes (a data URL body plus a MIME type) and returns RGBA pixels.
 */
export function createBrowserImageDecoder() {
  return async (input: DetectorImageInput): Promise<PixelImage> => {
    if (input.kind !== 'base64') {
      throw new UnsupportedImageError('The browser decoder only accepts base64 image input.');
    }
    const img = await loadImageElement(`data:${input.mimeType};base64,${input.data}`);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UnsupportedImageError('Canvas 2D context is not available.');
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return { data: new Uint8Array(data.buffer), width, height };
  };
}

/** Reads a File into the base64 DetectorImageInput the Detector expects. */
export function fileToDetectorInput(file: File): Promise<DetectorImageInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<data>"
      const comma = result.indexOf(',');
      const header = result.slice(0, comma);
      const data = result.slice(comma + 1);
      const mimeMatch = header.match(/data:([^;]+);base64/);
      const mimeType = mimeMatch ? mimeMatch[1]! : file.type;
      resolve({ kind: 'base64', data, mimeType });
    };
    reader.onerror = () => reject(new UnsupportedImageError('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}
