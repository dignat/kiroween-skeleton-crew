#!/usr/bin/env -S node --import tsx
// Poltergeist Detector CLI (task 16.1). Results go to stdout, progress to stderr.
// Exit code 1 for a missing/unsupported photo or a bad argument.

import { resolve } from 'node:path';
import type { DetectOptions } from '@skeleton-crew/core';
import { parseCliArgs, USAGE, type CompareCommand } from './cli-args.js';
import { compareScenes } from './compare-scenes.js';
import { createCocoDetector, createImageSizer } from './detector.js';
import { formatHauntingReport, formatJson } from './format-report.js';
import { CliArgsError, SceneLoadError } from './errors/index.js';
import { loadScenes } from './load-scenes.js';

/** Runs the compare command end to end. Returns the text to print to stdout. */
async function runCompare(cmd: CompareCommand): Promise<string> {
  // Resolve the two photos against the current directory and allow reading each
  // from its own folder (the Detector's decoder enforces the allowed root).
  const beforePath = resolve(cmd.beforePath);
  const afterPath = resolve(cmd.afterPath);

  // Allow reading from the common root of both photos (the current directory).
  const detector = createCocoDetector(process.cwd());
  const getSize = createImageSizer();

  const options: DetectOptions =
    cmd.minConfidence === undefined ? {} : { minConfidence: cmd.minConfidence };

  process.stderr.write('Loading model and scanning photos (this can take a few seconds)…\n');
  const { before, after } = await loadScenes(detector, getSize, beforePath, afterPath, options);

  const comparison = compareScenes(before, after, { moveTolerance: cmd.tolerance });
  return cmd.json ? formatJson(comparison) : formatHauntingReport(comparison);
}

export async function main(argv: readonly string[]): Promise<number> {
  let command;
  try {
    command = parseCliArgs(argv);
  } catch (error) {
    if (error instanceof CliArgsError) {
      process.stderr.write(`${error.message}\n\n${USAGE}`);
      return 1;
    }
    throw error;
  }

  if (command.kind === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  try {
    const output = await runCompare(command);
    process.stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    if (error instanceof SceneLoadError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    process.stderr.write(`Unexpected error: ${(error as Error).message}\n`);
    return 1;
  }
}

// Only run when invoked directly, not when imported by tests.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      process.stderr.write(`Fatal: ${(error as Error).message}\n`);
      process.exit(1);
    },
  );
}
