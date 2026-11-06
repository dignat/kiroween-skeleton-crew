import { parseArgs } from 'node:util';

/**
 * CLI argument parsing (task 16.1), separated from I/O so it can be unit tested
 * (task 16.4). Pure: takes an argv array, returns a parsed command or throws
 * CliArgsError with a message the caller prints to stderr before exiting 1.
 */

export class CliArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgsError';
  }
}

export interface CompareCommand {
  kind: 'compare';
  beforePath: string;
  afterPath: string;
  json: boolean;
  minConfidence?: number;
  tolerance?: number;
}

export interface HelpCommand {
  kind: 'help';
}

export type Command = CompareCommand | HelpCommand;

export const USAGE = `poltergeist-detector — spot what a poltergeist moved between two photos

Usage:
  poltergeist-detector compare <before> <after> [options]

Take both photos from the same spot, with the objects large and clearly
separated. The detector only knows the 80 COCO classes (cup, bottle, apple,
book, laptop, ...), so frame-filling, straight-on subjects work best.

Options:
  --json                    Print the result as JSON instead of a report.
  --min-confidence <0..1>   Ignore detections below this confidence (default 0.5).
  --tolerance <0..1>        Max normalized centre drift still counted as
                            "unchanged" (default 0.05). Above it, an object moved.
  --help                    Show this help.

Examples:
  poltergeist-detector compare desk-before.jpg desk-after.jpg
  poltergeist-detector compare a.jpg b.jpg --json --tolerance 0.08
`;

function parseUnitInterval(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new CliArgsError(`${flag} must be a number from 0 to 1, got "${raw}".`);
  }
  return value;
}

/** Parses argv (without node and script) into a Command. */
export function parseCliArgs(argv: readonly string[]): Command {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        'min-confidence': { type: 'string' },
        tolerance: { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    throw new CliArgsError((error as Error).message);
  }

  const { values, positionals } = parsed;

  if (values.help || positionals[0] === 'help') {
    return { kind: 'help' };
  }

  const command = positionals[0];
  if (command === undefined) {
    throw new CliArgsError('No command given. Try "compare <before> <after>" or "--help".');
  }
  if (command !== 'compare') {
    throw new CliArgsError(`Unknown command "${command}". The only command is "compare".`);
  }

  const beforePath = positionals[1];
  const afterPath = positionals[2];
  if (beforePath === undefined || afterPath === undefined) {
    throw new CliArgsError('compare needs two photos: compare <before> <after>.');
  }
  if (positionals.length > 3) {
    throw new CliArgsError(`compare takes exactly two photos, got ${positionals.length - 1}.`);
  }

  const result: CompareCommand = {
    kind: 'compare',
    beforePath,
    afterPath,
    json: values.json ?? false,
  };
  if (values['min-confidence'] !== undefined) {
    result.minConfidence = parseUnitInterval(values['min-confidence'], '--min-confidence');
  }
  if (values.tolerance !== undefined) {
    result.tolerance = parseUnitInterval(values.tolerance, '--tolerance');
  }
  return result;
}
