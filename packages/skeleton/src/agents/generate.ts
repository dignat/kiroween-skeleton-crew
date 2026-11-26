import { type AgentAdapter, type AgentFile, builtInAdapters } from './adapters.js';
import type { AgentSpec } from './spec.js';

export interface GenerateOptions {
  /** Adapter ids to run. Default: all of them. */
  only?: string[];
  /** Adapters to use instead of the built-in ones. */
  adapters?: AgentAdapter[];
}

/** Runs the adapters over the specs. Throws on an unknown adapter id or two files with the same path. */
export function generateAgentFiles(specs: AgentSpec[], options: GenerateOptions = {}): AgentFile[] {
  const adapters = options.adapters ?? builtInAdapters;
  const wanted = options.only;
  if (wanted) {
    const unknown = wanted.filter((id) => !adapters.some((a) => a.id === id));
    if (unknown.length > 0) {
      throw new Error(`Unknown client: ${unknown.join(', ')}. Available: ${adapters.map((a) => a.id).join(', ')}`);
    }
  }
  const files = new Map<string, string>();
  for (const adapter of adapters) {
    if (wanted && !wanted.includes(adapter.id)) continue;
    for (const file of adapter.generate(specs)) {
      if (files.has(file.path)) throw new Error(`Two adapters write ${file.path}`);
      files.set(file.path, file.content);
    }
  }
  return [...files].map(([path, content]) => ({ path, content }));
}

/**
 * Merges generated MCP servers into an existing MCP config (.mcp.json, .cursor/mcp.json), so
 * servers you added yourself are kept. Returns `generated` when there is no existing file.
 */
export function mergeMcpConfig(existing: string | undefined, generated: string): string {
  if (existing === undefined) return generated;
  let current: unknown;
  try {
    current = JSON.parse(existing);
  } catch {
    throw new Error('An existing MCP config is not valid JSON. Fix or move it, then run again.');
  }
  if (typeof current !== 'object' || current === null || Array.isArray(current)) {
    throw new Error('An existing MCP config is not a JSON object. Fix or move it, then run again.');
  }
  const next = JSON.parse(generated) as { mcpServers: Record<string, unknown> };
  const currentServers = (current as { mcpServers?: Record<string, unknown> }).mcpServers ?? {};
  return `${JSON.stringify({ ...current, mcpServers: { ...currentServers, ...next.mcpServers } }, null, 2)}\n`;
}
