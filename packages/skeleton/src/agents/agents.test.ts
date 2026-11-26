import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generateAgentFiles, formatAgentSpec, mergeMcpConfig, parseAgentSpec, type AgentSpec } from './index.js';
import { runCli } from './cli.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8');

const word = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 .,'!?-]{0,30}[A-Za-z0-9]$/);
const specArb: fc.Arbitrary<AgentSpec> = fc.record({
  name: fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
  description: word,
  welcome: word,
  mcpServer: fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
  mcpCommand: fc.stringMatching(/^[a-z]+ [a-z./-]+$/),
  tools: fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9_]{0,15}$/), { minLength: 1, maxLength: 6 }),
  prompt: fc.string({ minLength: 1 }).filter((s) => !s.includes('\r') && !s.endsWith('\n')),
});

describe('agent spec', () => {
  it('format then parse returns the same spec', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        expect(parseAgentSpec(formatAgentSpec(spec))).toEqual(spec);
      }),
    );
  });

  it('rejects a prefixed tool name, a missing front matter and a bad agent name', () => {
    const base = '---\nname: a\ndescription: d\nwelcome: w\nmcp_server: a\nmcp_command: node x.cjs\ntools:\n  - detect_objects\n---\nhi\n';
    expect(() => parseAgentSpec(base.replace('detect_objects', '@a/detect_objects'))).toThrow(/snake_case/);
    expect(() => parseAgentSpec(base.replace('name: a', 'name: Bad_Name'))).toThrow(/kebab-case/);
    expect(() => parseAgentSpec('just a prompt')).toThrow(/front matter/);
  });
});

describe('adapters', () => {
  const spec = parseAgentSpec(formatAgentSpec({
    name: 'demo', description: 'Demo agent', welcome: 'Hi', mcpServer: 'demo-server',
    mcpCommand: 'node demo/launch.cjs', tools: ['detect_objects', 'count_objects'], prompt: 'You are a demo.',
  }));
  const files = Object.fromEntries(generateAgentFiles([spec]).map((f) => [f.path, f.content]));

  it('writes one file per client format', () => {
    expect(Object.keys(files).sort()).toEqual([
      '.claude/agents/demo.md', '.cursor/mcp.json', '.cursor/rules/demo.mdc', '.kiro/agents/demo.json',
      '.mcp.json', 'agents/generated/demo.system-prompt.md',
    ]);
  });

  it('prefixes tool names the way each client expects', () => {
    expect(files['.claude/agents/demo.md']).toContain('tools: mcp__demo-server__detect_objects, mcp__demo-server__count_objects');
    expect(JSON.parse(files['.kiro/agents/demo.json']!).tools).toEqual(['@demo-server/detect_objects', '@demo-server/count_objects']);
  });

  it('puts the same launcher in every MCP config', () => {
    const expected = { mcpServers: { 'demo-server': { command: 'node', args: ['demo/launch.cjs'] } } };
    expect(JSON.parse(files['.mcp.json']!)).toEqual(expected);
    expect(JSON.parse(files['.cursor/mcp.json']!)).toEqual(expected);
  });

  it('filters by client and rejects an unknown one', () => {
    expect(generateAgentFiles([spec], { only: ['prompt'] }).map((f) => f.path)).toEqual(['agents/generated/demo.system-prompt.md']);
    expect(() => generateAgentFiles([spec], { only: ['nope'] })).toThrow(/Unknown client: nope/);
  });
});

describe('skeleton-agents CLI', () => {
  const run = async (cwd: string, ...argv: string[]) => {
    const err: string[] = [];
    const code = await runCli(argv, { cwd, out: (l) => err.push(l), err: (l) => err.push(l) });
    return { code, text: err.join('\n') };
  };

  it('init, generate and check work together in an empty folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'skeleton-agents-'));
    expect((await run(dir, 'init', 'helper', '--server', 'my-server')).code).toBe(0);
    expect((await run(dir, 'init', 'helper')).text).toMatch(/already exists/);
    expect((await run(dir, 'check')).code).toBe(1);
    expect((await run(dir, 'generate')).code).toBe(0);
    expect((await run(dir, 'check')).code).toBe(0);
    expect(readFileSync(join(dir, '.mcp.json'), 'utf8')).toContain('my-server');
    writeFileSync(join(dir, '.mcp.json'), '{}');
    expect((await run(dir, 'check')).text).toMatch(/out of date: \.mcp\.json/);
  });

  it('merges into an existing .mcp.json and keeps servers you added', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'skeleton-agents-'));
    await run(dir, 'init', 'helper', '--server', 'mine');
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ other: 1, mcpServers: { theirs: { command: 'x', args: [] } } }));
    expect((await run(dir, 'generate')).code).toBe(0);
    const merged = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(Object.keys(merged.mcpServers).sort()).toEqual(['mine', 'theirs']);
    expect(merged.other).toBe(1);
    expect((await run(dir, 'check')).code).toBe(0);
    writeFileSync(join(dir, '.mcp.json'), 'not json');
    expect((await run(dir, 'generate')).text).toMatch(/not valid JSON/);
  });

  it('fails clearly without an agents folder or with a mismatched name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'skeleton-agents-'));
    expect((await run(dir, 'generate')).text).toMatch(/skeleton-agents init/);
    await run(dir, 'init', 'one');
    mkdirSync(join(dir, 'agents', 'two'));
    writeFileSync(join(dir, 'agents', 'two', 'AGENT.md'), readFileSync(join(dir, 'agents', 'one', 'AGENT.md'), 'utf8'));
    expect((await run(dir, 'generate')).text).toMatch(/name must match the folder/);
  });
});

describe('this repo', () => {
  it('committed agent files are what the specs generate', () => {
    // Every spec under agents/, so adding an app does not break this test.
    const specs = readdirSync(join(repoRoot, 'agents'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(repoRoot, 'agents', d.name, 'AGENT.md')))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => parseAgentSpec(read(`agents/${d.name}/AGENT.md`)));
    expect(specs.length).toBeGreaterThan(0);
    for (const file of generateAgentFiles(specs)) {
      const committed = read(file.path);
      // MCP configs are merged (the CLI keeps servers in place), so compare what `generate` would write.
      const expected = file.path.endsWith('mcp.json') ? mergeMcpConfig(committed, file.content) : file.content;
      expect(committed, file.path).toBe(expected);
    }
  });
});
