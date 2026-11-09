// Node-only. Do not import this file from the browser-safe entry point.

/** Thrown when a file path is outside the allowed folder, missing, or too large. */
export class ImageAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageAccessError';
  }
}
