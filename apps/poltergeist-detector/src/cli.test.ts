import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from './cli.js';

/** Capture stdout and stderr writes during a test. */
let out: string[];
let err: string[];
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  out = [];
  err = [];
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    out.push(String(chunk));
    return true;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    err.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe('cli main', () => {
  it('prints usage to stdout and exits 0 for --help', async () => {
    const code = await main(['--help']);
    expect(code).toBe(0);
    expect(out.join('')).toContain('Usage:');
    expect(out.join('')).toContain('compare <before> <after>');
  });

  it('exits 1 and prints the error and usage to stderr for a bad argument', async () => {
    const code = await main(['compare', 'only-one.jpg']);
    expect(code).toBe(1);
    expect(err.join('')).toContain('two photos');
    expect(err.join('')).toContain('Usage:');
    expect(out.join('')).toBe('');
  });

  it('exits 1 for an unknown command', async () => {
    const code = await main(['explode']);
    expect(code).toBe(1);
    expect(err.join('')).toContain('Unknown command');
  });

  it('exits 1 and names the before photo when it is missing (Requirement 5.8)', async () => {
    const code = await main(['compare', '/no/such/before.jpg', '/no/such/after.jpg']);
    expect(code).toBe(1);
    const stderr = err.join('');
    expect(stderr).toContain('before');
    expect(stderr).toMatch(/before\.jpg/);
    // Nothing should be printed to stdout on failure.
    expect(out.join('')).toBe('');
  });

  it('exits 1 for an unsupported file type before loading the model', async () => {
    const code = await main(['compare', 'notes.txt', 'other.txt']);
    expect(code).toBe(1);
    expect(err.join('')).toMatch(/before/);
  });
});
