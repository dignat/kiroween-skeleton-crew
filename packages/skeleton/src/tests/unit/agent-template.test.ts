import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateAgentFiles, parseAgentSpec } from '../../agents/index.js';

const raw = readFileSync(fileURLToPath(new URL('../../../agent-template/app-agent.template.md', import.meta.url)), 'utf8');
const values: Record<string, string> = {
  APP_NAME: 'demo-app',
  APP_DESCRIPTION: 'A demo agent.',
  PERSONA: 'a friendly demo bot',
  APP_TOOL_NAME: 'demo_tool',
  MCP_LAUNCHER: 'apps/demo-app/mcp-launch.cjs',
  WELCOME_MESSAGE: 'Hello from the demo app.',
};

/** Fills every {{PLACEHOLDER}}. */
function fill(template: string): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Template uses an unknown placeholder: ${key}`);
    return value;
  });
}

/** The Kiro agent the template produces once the CLI has run. */
function kiroAgent(): Record<string, unknown> {
  const files = generateAgentFiles([parseAgentSpec(fill(raw))], { only: ['kiro'] });
  expect(files.map((f) => f.path)).toEqual(['.kiro/agents/demo-app.json']);
  return JSON.parse(files[0]!.content) as Record<string, unknown>;
}

describe('App_Agent template (Requirement 4.5)', () => {
  it('only uses placeholders that this test knows how to fill', () => {
    expect(() => fill(raw)).not.toThrow();
  });

  it('is a valid agent spec that generates the agent format confirmed in Spike A', () => {
    const agent = kiroAgent();
    expect(agent['name']).toBe('demo-app');
    expect(agent['includeMcpJson']).toBe(false);
    expect(agent['tools']).toEqual(['@demo-app/detect_objects', '@demo-app/count_objects', '@demo-app/demo_tool']);
    expect(Object.keys(agent['mcpServers'] as object)).toEqual(['demo-app']);
  });

  it('gives access only to this app tools and uses no legacy fields (Requirement 4.3)', () => {
    const agent = kiroAgent();
    expect(agent).not.toHaveProperty('allowedTools');
    expect(agent).not.toHaveProperty('toolsSettings');
    for (const tool of agent['tools'] as string[]) {
      expect(tool.startsWith('@demo-app/')).toBe(true);
    }
    expect(agent['tools']).not.toContain('*');
  });

  it('produces the same tools for Claude Code, with only this app server prefix', () => {
    const [claude] = generateAgentFiles([parseAgentSpec(fill(raw))], { only: ['claude'] });
    expect(claude!.content).toContain('tools: mcp__demo-app__detect_objects, mcp__demo-app__count_objects, mcp__demo-app__demo_tool');
  });
});

describe('app-generator template', () => {
  const generator = JSON.parse(readFileSync(fileURLToPath(new URL('../../../agent-template/app-generator.template.json', import.meta.url)), 'utf8')) as {
    name: string;
    prompt: string;
    includeMcpJson: boolean;
    permissions: { rules: { capability: string; match: string[]; effect: string }[] };
  };
  it('is a valid agent that does not load the workspace MCP servers', () => {
    expect(generator.name).toBe('app-generator');
    expect(generator.includeMcpJson).toBe(false);
  });
  it('writes only project files, never node_modules or .kiro/settings, and denies commit, push and rm -rf', () => {
    const writes = generator.permissions.rules.filter((r) => r.capability === 'fs_write').flatMap((r) => r.match);
    expect(writes.length).toBeGreaterThan(0);
    for (const glob of writes) expect(glob).not.toMatch(/node_modules|settings|^\*\*$/);
    const denied = generator.permissions.rules.filter((r) => r.effect === 'deny').flatMap((r) => r.match);
    expect(denied).toEqual(expect.arrayContaining(['git push *', 'git commit *', 'rm -rf *']));
  });
  it('writes the agent spec, runs the generator, and no longer writes .kiro/agents by hand', () => {
    const writes = generator.permissions.rules.filter((r) => r.capability === 'fs_write').flatMap((r) => r.match);
    expect(writes).toContain('agents/**');
    expect(writes).not.toContain('.kiro/agents/**');
    const shell = generator.permissions.rules.filter((r) => r.capability === 'execute_bash' && r.effect === 'allow').flatMap((r) => r.match);
    expect(shell).toContain('pnpm exec skeleton-agents generate');
    expect(generator.prompt).toContain('app-agent.template.md');
    expect(generator.prompt).toContain('skeleton-agents generate');
  });

  it('only tells the agent to copy templates that ship in the package', () => {
    for (const file of generator.prompt.match(/agent-template\/[\w-]+(?:\.[\w-]+)+/g) ?? []) {
      expect(existsSync(fileURLToPath(new URL(`../../../${file}`, import.meta.url))), file).toBe(true);
    }
  });
});
