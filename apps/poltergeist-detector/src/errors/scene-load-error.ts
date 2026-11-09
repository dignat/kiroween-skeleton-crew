/** Thrown by loadScenes when a photo cannot be read or detected (Requirement 5.8). */
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
