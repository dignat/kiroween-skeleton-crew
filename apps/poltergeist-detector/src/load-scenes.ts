import type { Detection, DetectOptions, Detector, DetectorImageInput } from '@skeleton-crew/core';

/**
 * Scene loader (task 15.6). Runs the Detector on the before and after photos one
 * after the other, and normalizes each detection's pixel box to 0..1 so
 * compareScenes can measure centre drift independently of image resolution.
 *
 * If a photo cannot be read or detected, the error names which photo failed
 * (Requirement 5.8), so the CLI can print a clear message and exit.
 */

/** Minimal shape the loader needs to normalize boxes: the image's pixel size. */
export type ImageSizer = (input: DetectorImageInput) => Promise<{ width: number; height: number }>;

export class SceneLoadError extends Error {
  constructor(
    message: string,
    /** Which photo failed, so the caller can report it. */
    readonly which: 'before' | 'after',
    readonly path: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SceneLoadError';
  }
}

/** Divides a detection's pixel box by the image size to get 0..1 coordinates. */
function normalizeBoxes(detections: Detection[], width: number, height: number): Detection[] {
  if (width <= 0 || height <= 0) return detections;
  return detections.map((d) =>
    d.box
      ? {
          ...d,
          box: {
            x: d.box.x / width,
            y: d.box.y / height,
            width: d.box.width / width,
            height: d.box.height / height,
          },
        }
      : d,
  );
}

async function detectOne(
  detector: Detector,
  getSize: ImageSizer,
  input: DetectorImageInput,
  which: 'before' | 'after',
  path: string,
  options?: DetectOptions,
): Promise<Detection[]> {
  try {
    const { width, height } = await getSize(input);
    const detections = await detector.detect(input, options);
    return normalizeBoxes(detections, width, height);
  } catch (error) {
    throw new SceneLoadError(
      `Could not read the ${which} photo (${path}): ${(error as Error).message}`,
      which,
      path,
      error,
    );
  }
}

/**
 * Detects objects in both photos, in order (before then after), returning
 * normalized detections ready for compareScenes. Runs sequentially so the
 * single cached model is reused rather than loaded twice concurrently.
 */
export async function loadScenes(
  detector: Detector,
  getSize: ImageSizer,
  beforePath: string,
  afterPath: string,
  options?: DetectOptions,
): Promise<{ before: Detection[]; after: Detection[] }> {
  const beforeInput: DetectorImageInput = { kind: 'filePath', path: beforePath };
  const afterInput: DetectorImageInput = { kind: 'filePath', path: afterPath };

  const before = await detectOne(detector, getSize, beforeInput, 'before', beforePath, options);
  const after = await detectOne(detector, getSize, afterInput, 'after', afterPath, options);
  return { before, after };
}
