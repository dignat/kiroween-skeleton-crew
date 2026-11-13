import type { Detection, PixelImage } from '@skeleton-crew/core';
import { PNG } from 'pngjs';
import type { SceneComparison } from './compare-scenes.js';

/**
 * Annotated "haunting report" image. Draws colour-coded boxes on the before and
 * after photos and puts them side by side in one PNG. Pure pixel work, no file
 * I/O, so it can be unit tested. Boxes are NORMALIZED (0..1), as produced by the
 * scene loader.
 */

export type Rgb = readonly [number, number, number];

/** Box colours, also described in the CLI legend. */
export const COLORS = {
  appeared: [57, 255, 20], // green, only in the after photo
  vanished: [255, 59, 48], // red, only in the before photo
  moved: [255, 176, 0], // amber, drawn in both photos
  unchanged: [120, 140, 255], // soft blue, drawn in both photos
} as const satisfies Record<string, Rgb>;

export const LEGEND = [
  'green = appeared (after photo)',
  'red = vanished (before photo)',
  'amber = moved (both photos)',
  'blue = unchanged (both photos)',
].join(', ');

/** Gap between the two photos, in pixels, and its colour. */
const GAP = 12;
const GAP_COLOR: Rgb = [20, 20, 28];

function setPixel(img: PixelImage, x: number, y: number, color: Rgb): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = color[0];
  img.data[i + 1] = color[1];
  img.data[i + 2] = color[2];
  img.data[i + 3] = 255;
}

function fillRect(img: PixelImage, x0: number, y0: number, x1: number, y1: number, color: Rgb): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPixel(img, x, y, color);
}

/** Draws a rectangle outline from normalized coordinates. Clipped to the image. */
export function drawBox(img: PixelImage, box: NonNullable<Detection['box']>, color: Rgb): void {
  const thickness = Math.max(2, Math.round(Math.max(img.width, img.height) / 300));
  const x0 = Math.round(box.x * img.width);
  const y0 = Math.round(box.y * img.height);
  const x1 = Math.round((box.x + box.width) * img.width);
  const y1 = Math.round((box.y + box.height) * img.height);
  fillRect(img, x0, y0, x1, y0 + thickness, color); // top
  fillRect(img, x0, y1 - thickness, x1, y1, color); // bottom
  fillRect(img, x0, y0, x0 + thickness, y1, color); // left
  fillRect(img, x1 - thickness, y0, x1, y1, color); // right
}

function copyImage(img: PixelImage): PixelImage {
  return { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
}

/**
 * Returns new before/after images with the comparison drawn on them. The input
 * images are left untouched. Detections without a box (whole-image labels) are skipped.
 */
export function annotateScenes(
  before: PixelImage,
  after: PixelImage,
  comparison: SceneComparison,
): { before: PixelImage; after: PixelImage } {
  const b = copyImage(before);
  const a = copyImage(after);

  for (const d of comparison.vanished) if (d.box) drawBox(b, d.box, COLORS.vanished);
  for (const d of comparison.appeared) if (d.box) drawBox(a, d.box, COLORS.appeared);
  for (const m of comparison.moved) {
    if (m.before.box) drawBox(b, m.before.box, COLORS.moved);
    if (m.after.box) drawBox(a, m.after.box, COLORS.moved);
  }
  for (const m of comparison.unchanged) {
    if (m.before.box) drawBox(b, m.before.box, COLORS.unchanged);
    if (m.after.box) drawBox(a, m.after.box, COLORS.unchanged);
  }
  return { before: b, after: a };
}

/** Puts two images side by side (top-aligned) with a dark gap between them. */
export function sideBySide(left: PixelImage, right: PixelImage): PixelImage {
  const width = left.width + GAP + right.width;
  const height = Math.max(left.height, right.height);
  const out: PixelImage = { width, height, data: new Uint8Array(width * height * 4) };
  fillRect(out, 0, 0, width, height, GAP_COLOR);

  const blit = (src: PixelImage, offsetX: number): void => {
    for (let y = 0; y < src.height; y++) {
      const from = y * src.width * 4;
      out.data.set(src.data.subarray(from, from + src.width * 4), (y * width + offsetX) * 4);
    }
  };
  blit(left, 0);
  blit(right, left.width + GAP);
  return out;
}

/** Each photo is shrunk to at most this width in the report image, to keep the PNG small. */
export const MAX_PHOTO_WIDTH = 720;

/** Nearest-neighbour shrink to `maxWidth`. Returns the input as is when already small enough. */
export function downscale(img: PixelImage, maxWidth: number): PixelImage {
  if (img.width <= maxWidth) return img;
  const width = maxWidth;
  const height = Math.max(1, Math.round((img.height * maxWidth) / img.width));
  const out: PixelImage = { width, height, data: new Uint8Array(width * height * 4) };
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / width));
      const from = (sy * img.width + sx) * 4;
      out.data.set(img.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return out;
}

/** Renders the annotated before | after comparison as PNG bytes. */
export function renderComparisonPng(
  before: PixelImage,
  after: PixelImage,
  comparison: SceneComparison,
): Buffer {
  const annotated = annotateScenes(downscale(before, MAX_PHOTO_WIDTH), downscale(after, MAX_PHOTO_WIDTH), comparison);
  const combined = sideBySide(annotated.before, annotated.after);
  const png = new PNG({ width: combined.width, height: combined.height });
  png.data = Buffer.from(combined.data.buffer, combined.data.byteOffset, combined.data.byteLength);
  return PNG.sync.write(png);
}
