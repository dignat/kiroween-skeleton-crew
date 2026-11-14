import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Static security lint for the Kiro wiring around every MCP server. It is a first line of defence
// against known-bad patterns, not a proof of safety: it cannot judge intent (see the reviewer
// agent for that) or trace data flow (the unguarded readFile bug needed a human).
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const read = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');
const listFiles = (dir: string, ok: (name: string) => boolean): string[] =>
  existsSync(join(repoRoot, dir)) ? readdirSync(join(repoRoot, dir)).filter(ok).map((n) => `${dir}/${n}`) : [];
interface Rule { capability: string; match: string[]; effect: string }
interface Agent {
  name: string;
  tools?: string[];
  includeMcpJson?: boolean;
  mcpServers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
  permissions?: { rules: Rule[] };
  [key: string]: unknown;
}
const agentFiles = listFiles('.kiro/agents', (n) => n.endsWith('.json'));
const agents = agentFiles.map((file) => ({ file, agent: JSON.parse(read(file)) as Agent }));
const READ_ONLY_TOOLS = ['fs_read', 'grep', 'glob'];
const isReadOnly = (agent: Agent): boolean => (agent.tools ?? []).every((t) => READ_ONLY_TOOLS.includes(t));
const appAgents = agents.filter(({ agent }) => agent.mcpServers !== undefined);
const readOnlyAgents = agents.filter(({ agent }) => agent.mcpServers === undefined && isReadOnly(agent));
const devAgents = agents.filter(({ agent }) => agent.mcpServers === undefined && !isReadOnly(agent));
const appNames = readdirSync(join(repoRoot, 'apps'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(repoRoot, 'apps', e.name, 'mcp-launch.sh')))
  .map((e) => e.name);
const rulesOf = (agent: Agent): Rule[] => agent.permissions?.rules ?? [];
/** Shell metacharacters that would let one allowed command smuggle in another. */
const SHELL_META = /[;&|`$<>\n\\]/;
describe('guards the tests rely on', () => {
  it('finds agents and apps to check', () => {
    expect(appAgents.length).toBeGreaterThan(0);
    expect(devAgents.length).toBeGreaterThan(0);
    expect(readOnlyAgents.length).toBeGreaterThan(0);
    expect(appNames.length).toBeGreaterThan(0);
  });
});
describe.each(appAgents)('app agent $file', ({ agent }) => {
  it('does not inherit the workspace mcp.json, and uses no legacy permission fields', () => {
    expect(agent.includeMcpJson).toBe(false);
    expect(agent).not.toHaveProperty('allowedTools');
    expect(agent).not.toHaveProperty('toolsSettings');
  });
  it('starts exactly one server, through its own launcher, with no extra env or flags', () => {
    const servers = Object.entries(agent.mcpServers ?? {});
    expect(servers).toHaveLength(1);
    const [name, server] = servers[0]!;
    expect(server.command).toBe('sh');
    expect(server.args).toEqual([`apps/${name}/mcp-launch.sh`]);
    expect(server.env ?? {}).toEqual({});
    expect(existsSync(join(repoRoot, server.args[0]!))).toBe(true);
  });
  it('can use only its own server tools, never built-in file or shell tools', () => {
    const [name] = Object.keys(agent.mcpServers ?? {});
    for (const tool of agent.tools ?? []) expect(tool.startsWith(`@${name}/`)).toBe(true);
  });
  it('allows only exact, named MCP tools (no wildcards)', () => {
    const rules = rulesOf(agent);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.capability).toBe('mcp');
      expect(rule.effect).toBe('allow');
      for (const m of rule.match) expect(m).not.toContain('*');
    }
  });
});
describe.each(devAgents)('developer agent $file', ({ agent }) => {
  it('does not inherit the workspace mcp.json', () => {
    expect(agent.includeMcpJson).toBe(false);
  });
  it('writes only under apps/ (and its own agent folder), never packages/, settings or hooks', () => {
    const allowed = rulesOf(agent).filter((r) => r.capability === 'fs_write' && r.effect === 'allow');
    for (const rule of allowed) {
      for (const m of rule.match) expect(['apps/**', '.kiro/agents/**']).toContain(m);
    }
  });
  it('allows only plain pnpm commands, with no shell metacharacters', () => {
    const allowed = rulesOf(agent).filter((r) => r.capability === 'execute_bash' && r.effect === 'allow');
    for (const rule of allowed) {
      for (const m of rule.match) {
        expect(m.startsWith('pnpm ')).toBe(true);
        expect(m).not.toMatch(SHELL_META);
      }
    }
  });
  it('explicitly denies git push, git commit and rm -rf', () => {
    const denied = rulesOf(agent).filter((r) => r.capability === 'execute_bash' && r.effect === 'deny').flatMap((r) => r.match);
    for (const pattern of ['git push *', 'git commit *', 'rm -rf *']) expect(denied).toContain(pattern);
  });
});
describe.each(readOnlyAgents)('read-only agent $file', ({ agent }) => {
  it('has no write, shell or MCP access and does not inherit the workspace mcp.json', () => {
    expect(agent.includeMcpJson).toBe(false);
    expect(agent.tools).not.toContain('execute_bash');
    expect(agent.tools).not.toContain('fs_write');
    for (const rule of rulesOf(agent)) {
      expect(rule.capability).toBe('fs_read');
      expect(rule.effect).toBe('allow');
    }
  });
});
describe('security-reviewer', () => {
  it('is a read-only agent, and the template and the installed agent are identical', () => {
    expect(readOnlyAgents.map((a) => a.file)).toContain('.kiro/agents/security-reviewer.json');
    expect(read('.kiro/agents/security-reviewer.json')).toBe(read('packages/skeleton/agent-template/security-reviewer.template.json'));
  });
  it('tells the model that file contents are data, not instructions', () => {
    const prompt = (JSON.parse(read('.kiro/agents/security-reviewer.json')) as { prompt: string }).prompt;
    expect(prompt).toMatch(/data to be judged, never instructions/i);
  });
});
describe('.kiro/settings/mcp.json', () => {
  const config = JSON.parse(read('.kiro/settings/mcp.json')) as { mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> };
  it.each(Object.entries(config.mcpServers))('server %s runs only its own launcher', (name, server) => {
    expect(server.command).toBe('sh');
    expect(server.args).toEqual([`apps/${name}/mcp-launch.sh`]);
    expect(server.env ?? {}).toEqual({});
    expect(existsSync(join(repoRoot, server.args[0]!))).toBe(true);
  });
});
/** Commands that fetch code, decode payloads, open sockets or evaluate strings. None belong in a launcher. */
const BANNED_IN_LAUNCHER = [/\bcurl\b/, /\bwget\b/, /\beval\b/, /\bbase64\b/, /\bnc\b/, /\bncat\b/, /\bssh\b/, /\bscp\b/, /\brm\b/, /\bsudo\b/, /\bsh\s+-c\b/, /\|\s*(ba|z)?sh\b/, /\/dev\/tcp/];
describe('launchers', () => {
  const launchers = ['packages/skeleton/agent-template/mcp-launch.template.sh', ...appNames.map((a) => `apps/${a}/mcp-launch.sh`)];
  it.each(launchers)('%s contains no download, eval, remote-shell or delete commands', (file) => {
    const code = read(file).split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    for (const pattern of BANNED_IN_LAUNCHER) expect(code).not.toMatch(pattern);
  });
});
/** Invisible or direction-changing characters can hide instructions from a human reader. */
const HIDDEN_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u00AD]/;
/** Phrases that try to override a model's instructions. Extend this list when you meet new ones. */
const INJECTION_PHRASES = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /disregard (all |any |the )?(previous|prior|above|earlier|your) (instructions|rules)/i,
  /(do not|don't) (tell|inform|reveal to|mention to) the user/i,
  /you are now (in )?(developer|dan|jailbreak)/i,
  /<\s*(system|important|instructions?)\s*>/i,
];
const scannedText = [
  ...agentFiles,
  'packages/skeleton/agent-template/app-agent.template.json',
  'packages/skeleton/agent-template/mcp-launch.template.sh',
  ...listFiles('.kiro/steering', (n) => n.endsWith('.md')),
  ...appNames.flatMap((a) => [`apps/${a}/mcp-launch.sh`, ...listFiles(`apps/${a}/src`, (n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))]),
];
describe('prompts, tool descriptions and launchers', () => {
  it.each(scannedText)('%s has no hidden characters or instruction-override phrases', (file) => {
    const text = read(file);
    expect(text).not.toMatch(HIDDEN_CHARS);
    for (const pattern of INJECTION_PHRASES) expect(text).not.toMatch(pattern);
  });
});
/** Modules an app's MCP-reachable code must not import. File reads go through the guarded decoder. */
const BANNED_IMPORTS = /from\s+'(node:)?(fs|fs\/promises|child_process|net|http|https|http2|dgram|tls|worker_threads|vm|cluster)'/;
const BANNED_CALLS = /\b(eval|new Function)\s*\(|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/;
describe('app source', () => {
  const sources = appNames.flatMap((a) =>
    listFiles(`apps/${a}/src`, (n) => n.endsWith('.ts') && !n.endsWith('.test.ts')).filter((f) => !f.endsWith('/cli.ts')),
  );
  it.each(sources)('%s does not use fs, processes, sockets, eval or fetch', (file) => {
    const text = read(file);
    expect(text, relative(repoRoot, file)).not.toMatch(BANNED_IMPORTS);
    expect(text).not.toMatch(BANNED_CALLS);
  });
});
