/** Thrown by parseCliArgs. The caller prints the message to stderr and exits 1. */
export class CliArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgsError';
  }
}
