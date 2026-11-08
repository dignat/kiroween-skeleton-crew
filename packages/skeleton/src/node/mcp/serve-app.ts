// Node-only. Helpers that turn an app's MCP surface into a server with minimal
// wiring, so an app's mcp-server.ts is a short declaration: its name, detector,
// and the list of its tools. The two apps in this repo both build on these, so
// the shared MCP machinery lives once in the skeleton — the "one skeleton, many
// apps" reuse made concrete.

import type { McpServer, StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { createSkeletonServer } from './create-server.js';
import { registerTool } from './register-tool.js';
import type { ToolDefinition } from './register-tool.js';
import { serveOverStdio } from './stdio.js';
import type { StdioServerHandle } from './stdio.js';
import type { Detector } from '../../detector/types.js';

/**
 * Preserves a single tool's own schema type while letting an app collect tools
 * of different schema types into one array. It is an identity function — it just
 * pins inference for `handler`'s input so each tool stays fully typed. Without it,
 * a mixed array of `ToolDefinition<Schema>` widens and the handlers lose their types.
 */
export function defineTool<Schema extends StandardSchemaWithJSON>(
  tool: ToolDefinition<Schema>,
): ToolDefinition<Schema> {
  return tool;
}

/** Any tool definition, regardless of its schema's concrete type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any>;

export interface AppServerOptions {
  name: string;
  version: string;
  /** The detector the built-in detect_objects / count_objects tools use. */
  detector: Detector;
  /** The app's own tools, on top of the built-ins. Build each with defineTool(). */
  tools?: readonly AnyToolDefinition[];
}

/**
 * Builds an McpServer pre-wired with the built-in tools plus the app's own tools.
 * An app's `createServer()` returns this; tests import it to drive the server
 * in-process, and the entry point serves it with serveApp().
 */
export function createAppServer(options: AppServerOptions): McpServer {
  const server = createSkeletonServer({
    name: options.name,
    version: options.version,
    detector: options.detector,
  });
  for (const tool of options.tools ?? []) {
    registerTool(server, tool);
  }
  return server;
}

/**
 * Serves an app's MCP server over stdio. Pass the app's server factory (its
 * `createServer`, usually built with createAppServer). This is the one line an
 * app's entry point runs when invoked directly. Returns the stdio handle.
 */
export function serveApp(name: string, createServer: () => McpServer): StdioServerHandle {
  return serveOverStdio(name, createServer);
}
