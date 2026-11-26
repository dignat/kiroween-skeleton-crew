import type { AgentSpec } from './spec.js';

export interface AgentFile {
  /** Path relative to the project root, with forward slashes. */
  path: string;
  content: string;
}

/** Turns agent specs into the files one client reads. Add a client by writing one of these. */
export interface AgentAdapter {
  id: string;
  generate(specs: AgentSpec[]): AgentFile[];
}

const s = (v: string) => JSON.stringify(v);

function splitCommand(spec: AgentSpec): [string, string[]] {
  const [command, ...args] = spec.mcpCommand.split(/\s+/) as [string, ...string[]];
  return [command, args];
}

/** Project MCP config in the common `mcpServers` shape. */
function mcpConfig(specs: AgentSpec[]): string {
  const mcpServers: Record<string, { command: string; args: string[] }> = {};
  for (const spec of specs) {
    const [command, args] = splitCommand(spec);
    mcpServers[spec.mcpServer] = { command, args };
  }
  return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
}

/** Kiro custom agent: .kiro/agents/<name>.json. */
export const kiroAdapter: AgentAdapter = {
  id: 'kiro',
  generate: (specs) =>
    specs.map((spec) => {
      const [command, args] = splitCommand(spec);
      const rules = spec.tools
        .map((t) => `      { "capability": "mcp", "match": [${s(`${spec.mcpServer}/${t}`)}], "effect": "allow" }`)
        .join(',\n');
      const content = `{
  "name": ${s(spec.name)},
  "description": ${s(spec.description)},
  "prompt": ${s(spec.prompt)},
  "mcpServers": {
    ${s(spec.mcpServer)}: {
      "command": ${s(command)},
      "args": [${args.map(s).join(', ')}]
    }
  },
  "tools": [
${spec.tools.map((t) => `    ${s(`@${spec.mcpServer}/${t}`)}`).join(',\n')}
  ],
  "permissions": {
    "rules": [
${rules}
    ]
  },
  "includeMcpJson": false,
  "welcomeMessage": ${s(spec.welcome)}
}
`;
      return { path: `.kiro/agents/${spec.name}.json`, content };
    }),
};

/** Claude Code subagent (.claude/agents/<name>.md) plus the project .mcp.json. */
export const claudeAdapter: AgentAdapter = {
  id: 'claude',
  generate: (specs) => [
    ...specs.map((spec) => ({
      path: `.claude/agents/${spec.name}.md`,
      content: `---
name: ${spec.name}
description: ${s(spec.description)}
tools: ${spec.tools.map((t) => `mcp__${spec.mcpServer}__${t}`).join(', ')}
---
${spec.prompt}
`,
    })),
    { path: '.mcp.json', content: mcpConfig(specs) },
  ],
};

/** Cursor rule (.cursor/rules/<name>.mdc) plus .cursor/mcp.json. Cursor cannot limit a rule's tools. */
export const cursorAdapter: AgentAdapter = {
  id: 'cursor',
  generate: (specs) => [
    ...specs.map((spec) => ({
      path: `.cursor/rules/${spec.name}.mdc`,
      content: `---
description: ${s(spec.description)}
alwaysApply: false
---
${spec.prompt}
`,
    })),
    { path: '.cursor/mcp.json', content: mcpConfig(specs) },
  ],
};

/** The bare system prompt, for any chat UI or API. */
export const promptAdapter: AgentAdapter = {
  id: 'prompt',
  generate: (specs) =>
    specs.map((spec) => ({ path: `agents/generated/${spec.name}.system-prompt.md`, content: `${spec.prompt}\n` })),
};

export const builtInAdapters: AgentAdapter[] = [kiroAdapter, claudeAdapter, cursorAdapter, promptAdapter];
