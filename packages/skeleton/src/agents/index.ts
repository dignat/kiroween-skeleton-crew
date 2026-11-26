// Agent specs entry point (`@skeleton-playground/core/agents`).
// Pure functions only: no fs, no Node modules. The CLI (`skeleton-agents`) does the file work.
export { formatAgentSpec, parseAgentSpec } from './spec.js';
export type { AgentSpec } from './spec.js';
export { builtInAdapters, claudeAdapter, cursorAdapter, kiroAdapter, promptAdapter } from './adapters.js';
export type { AgentAdapter, AgentFile } from './adapters.js';
export { generateAgentFiles, mergeMcpConfig } from './generate.js';
export type { GenerateOptions } from './generate.js';
