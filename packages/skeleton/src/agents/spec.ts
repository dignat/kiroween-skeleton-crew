// Neutral agent spec: one AGENT.md per agent, turned into client-specific files by adapters.
// The Markdown body is a plain system prompt that works with any LLM. The front matter is a
// small fixed block, parsed by hand so the package needs no YAML dependency.

export interface AgentSpec {
  name: string;
  description: string;
  /** Message shown when the agent starts, in clients that support one. */
  welcome: string;
  /** Name of the MCP server the agent uses. */
  mcpServer: string;
  /** Launcher command; the first word is the command, the rest are its args. */
  mcpCommand: string;
  /** Bare tool names exactly as the MCP server defines them (no client prefix). */
  tools: string[];
  /** The system prompt. */
  prompt: string;
}

const SCALAR_KEYS = ['name', 'description', 'welcome', 'mcp_server', 'mcp_command'] as const;
const NAME = /^[a-z][a-z0-9-]*$/;
const TOOL = /^[a-z][a-z0-9_]*$/;

export function parseAgentSpec(source: string): AgentSpec {
  const text = source.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error('AGENT.md must start with a --- front matter block');
  const front = match[1] as string;
  const body = match[2] as string;

  const scalars: Record<string, string> = {};
  const tools: string[] = [];
  let inTools = false;
  for (const line of front.split('\n')) {
    const item = /^\s+-\s+(\S+)\s*$/.exec(line);
    if (inTools && item) {
      tools.push(item[1] as string);
      continue;
    }
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`Unreadable front matter line: ${line}`);
    const key = kv[1] as string;
    inTools = key === 'tools';
    if (inTools) continue;
    if (!(SCALAR_KEYS as readonly string[]).includes(key)) throw new Error(`Unknown front matter key: ${key}`);
    scalars[key] = (kv[2] as string).trim();
  }
  for (const key of SCALAR_KEYS) if (!scalars[key]) throw new Error(`Front matter is missing "${key}"`);
  if (tools.length === 0) throw new Error('Front matter needs at least one tool');
  for (const t of tools) if (!TOOL.test(t)) throw new Error(`Tool names must be snake_case, without a prefix: ${t}`);
  const name = scalars.name as string;
  if (!NAME.test(name)) throw new Error(`Agent name must be kebab-case: ${name}`);

  return {
    name,
    description: scalars.description as string,
    welcome: scalars.welcome as string,
    mcpServer: scalars.mcp_server as string,
    mcpCommand: scalars.mcp_command as string,
    tools,
    prompt: body.replace(/\n$/, ''),
  };
}

/** The inverse of parseAgentSpec. */
export function formatAgentSpec(spec: AgentSpec): string {
  return `---
name: ${spec.name}
description: ${spec.description}
welcome: ${spec.welcome}
mcp_server: ${spec.mcpServer}
mcp_command: ${spec.mcpCommand}
tools:
${spec.tools.map((t) => `  - ${t}`).join('\n')}
---
${spec.prompt}
`;
}
