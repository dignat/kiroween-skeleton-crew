import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './cli-args.js';
import { CliArgsError } from './errors/index.js';

describe('parseCliArgs', () => {
  it('parses a basic compare command', () => {
    const cmd = parseCliArgs(['compare', 'a.jpg', 'b.jpg']);
    expect(cmd).toEqual({ kind: 'compare', beforePath: 'a.jpg', afterPath: 'b.jpg', json: false });
  });

  it('parses --json, --min-confidence and --tolerance', () => {
    const cmd = parseCliArgs(['compare', 'a.jpg', 'b.jpg', '--json', '--min-confidence', '0.3', '--tolerance', '0.08']);
    expect(cmd).toEqual({
      kind: 'compare',
      beforePath: 'a.jpg',
      afterPath: 'b.jpg',
      json: true,
      minConfidence: 0.3,
      tolerance: 0.08,
    });
  });

  it('parses --out and requires a .png file', () => {
    const cmd = parseCliArgs(['compare', 'a.jpg', 'b.jpg', '--out', 'report.png']);
    expect(cmd).toMatchObject({ kind: 'compare', outPath: 'report.png' });
    expect(() => parseCliArgs(['compare', 'a.jpg', 'b.jpg', '--out', 'report.txt'])).toThrow(CliArgsError);
  });

  it('returns a help command for --help', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
  });

  it('returns a help command for the "help" positional', () => {
    expect(parseCliArgs(['help'])).toEqual({ kind: 'help' });
  });

  it('rejects a missing command', () => {
    expect(() => parseCliArgs([])).toThrow(CliArgsError);
  });

  it('rejects an unknown command', () => {
    expect(() => parseCliArgs(['scan', 'a.jpg'])).toThrow(/Unknown command/);
  });

  it('rejects too few photos', () => {
    expect(() => parseCliArgs(['compare', 'a.jpg'])).toThrow(/two photos/);
  });

  it('rejects too many photos', () => {
    expect(() => parseCliArgs(['compare', 'a.jpg', 'b.jpg', 'c.jpg'])).toThrow(/exactly two/);
  });

  it('rejects an out-of-range --min-confidence', () => {
    expect(() => parseCliArgs(['compare', 'a.jpg', 'b.jpg', '--min-confidence', '5'])).toThrow(
      /--min-confidence must be a number from 0 to 1/,
    );
  });

  it('rejects a non-numeric --tolerance', () => {
    expect(() => parseCliArgs(['compare', 'a.jpg', 'b.jpg', '--tolerance', 'loose'])).toThrow(
      /--tolerance must be a number from 0 to 1/,
    );
  });

  it('rejects an unknown flag', () => {
    expect(() => parseCliArgs(['compare', 'a.jpg', 'b.jpg', '--spooky'])).toThrow(CliArgsError);
  });
});
