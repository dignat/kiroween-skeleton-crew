// Browser-safe. Do not import Node modules from this folder.

/** Thrown when an image's format is not supported, or input is otherwise unusable. */
export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}
