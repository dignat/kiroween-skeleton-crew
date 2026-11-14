// Canvas overlay (task 20.3). Draws the image, then boxes for localized
// detections (those with a box, e.g. COCO-SSD) and labelled tags stacked in the
// corner for whole-image classifications (no box, e.g. MobileNet food labels).

import type { Detection } from '@skeleton-playground/core';

/** Draws the image into the canvas, sizing the canvas to the image. */
export function drawImageToCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
}

/**
 * Draws detections over whatever is already on the canvas.
 * - With a box: a rectangle plus a label chip at its top-left.
 * - Without a box (whole-image class): a stacked tag in the top-left corner.
 * Box coordinates are expected in canvas pixels.
 */
export function drawDetections(canvas: HTMLCanvasElement, detections: readonly Detection[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontSize = Math.max(14, Math.round(canvas.width / 45));
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));

  let tagRow = 0;
  for (const d of detections) {
    const text = `${d.label} ${(d.confidence * 100).toFixed(0)}%`;
    const padding = fontSize * 0.3;
    const textWidth = ctx.measureText(text).width;

    if (d.box) {
      const { x, y, width, height } = d.box;
      ctx.strokeStyle = '#8be9c0';
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = '#8be9c0';
      ctx.fillRect(x, y, textWidth + padding * 2, fontSize + padding * 2);
      ctx.fillStyle = '#0c1a14';
      ctx.fillText(text, x + padding, y + padding);
    } else {
      // Whole-image tag: stack in the top-left corner.
      const x = 10;
      const y = 10 + tagRow * (fontSize + padding * 2 + 6);
      ctx.fillStyle = 'rgba(139, 233, 192, 0.92)';
      ctx.fillRect(x, y, textWidth + padding * 2, fontSize + padding * 2);
      ctx.fillStyle = '#0c1a14';
      ctx.fillText(text, x + padding, y + padding);
      tagRow += 1;
    }
  }
}
