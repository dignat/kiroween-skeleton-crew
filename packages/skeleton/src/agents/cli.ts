import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { builtInAdapters } from './adapters.js';
import { generateAgentFiles } from './generate.js';
import { type AgentSpec, formatAgentSpec, parseAgentSpec } from './spec.js';

export interface CliIo {
  /** Project root: where agents/ is read and the client files are written. */
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

const SPECS_DIR = 'agents';

const HELP = `skeleton-agents: write one AGENT.md, generate agent files for any client.

Usage:
  skeleton-agents init <name> [--server <mcp-server>] [--command "<launcher command>"]
  skeleton-agents generate [--only ${builtInAdapters.map((a) => a.id).join(',')}]
  skeleton-agents check    [--only ...]   exit 1 if a generated file is out of date

Specs live in ${SPECS_DIR}/<name>/AGENT.md. Run from the project root.`;

function loadSpecs(cwd: string): AgentSpec[] {
  const root = join(cwd, SPECS_DIR);
  if (!existsSync(root)) throw new Error(`No ${SPECS_DIR}/ folder here. Run "skeleton-agents init <name>" first.`);
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'AGENT.md')))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => {
      let spec: AgentSpec;
      try {
        spec = parseAgentSpec(readFileSync(join(root, d.name, 'AGENT.md'), 'utf8'));
      } catch (error) {
        throw new Error(`${SPECS_DIR}/${d.name}/AGENT.md: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (spec.name !== d.name) throw new Error(`${SPECS_DIR}/${d.name}/AGENT.md: name must match the folder`);
      return spec;
    });
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        only: { type: 'string' },
        server: { type: 'string' },
        command: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
    const [command, name] = positionals;
    if (values.help || !command) {
      io.out(HELP);
      return command || values.help ? 0 : 1;
    }

    if (command === 'init') {
      if (!name) throw new Error('init needs an agent name: skeleton-agents init <name>');
      const server = values.server ?? name;
      const spec: AgentSpec = {
        name,
        description: 'One sentence that says what this agent does.',
        welcome: 'Ready. What would you like to do?',
        mcpServer: server,
        mcpCommand: values.command ?? `node ${server}/mcp-launch.cjs`,
        tools: ['detect_objects'],
        prompt: `You are ... Describe the persona and how to work here.\n\nYou can only use these tools: detect_objects.\n\nRules:\n- Always call a tool before describing anything.\n- If a tool returns an error, say what it says and suggest a fix.`,
      };
      parseAgentSpec(formatAgentSpec(spec)); // validates the name before writing
      const target = join(io.cwd, SPECS_DIR, name, 'AGENT.md');
      if (existsSync(target)) throw new Error(`${SPECS_DIR}/${name}/AGENT.md already exists`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, formatAgentSpec(spec));
      io.err(`wrote ${SPECS_DIR}/${name}/AGENT.md`);
      return 0;
    }

    if (command === 'generate' || command === 'check') {
      const only = values.only?.split(',').map((x) => x.trim()).filter(Boolean);
      const files = generateAgentFiles(loadSpecs(io.cwd), only ? { only } : {});
      let stale = 0;
      for (const file of files) {
        const target = join(io.cwd, file.path);
        if (existsSync(target) && readFileSync(target, 'utf8') === file.content) continue;
        if (command === 'check') {
          io.err(`out of date: ${file.path}`);
          stale++;
        } else {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, file.content);
          io.err(`wrote ${file.path}`);
        }
      }
      return stale > 0 ? 1 : 0;
    }

    throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
