#!/usr/bin/env node
// The `skeleton-agents` command. Kept separate from cli.ts so the CLI can be imported in tests.
import { runCli } from './cli.js';

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
