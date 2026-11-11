import { describe, expect, it } from 'vitest';
import * as z from 'zod/v4';
import type { Detector } from '../../detector/types.js';
import { SkeletonMcpError } from '../errors/index.js';
import { textResult } from './results.js';
import { createAppServer, defineTool } from './serve-app.js';
import { connectClient, textOf } from './test-helpers.js';

const detector: Detector = { async detect() { return []; } };

describe('createAppServer', () => {
  it('serves the built-in tools when the app adds none', async () => {
    const client = await connectClient(createAppServer({ name: 'app', version: '1.0.0', detector }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['count_objects', 'detect_objects']);
  });

  it('adds the app tools next to the built-ins, and they can be called', async () => {
    const echo = defineTool({
      name: 'echo_text',
      description: 'Echoes text',
      inputSchema: z.object({ text: z.string() }),
      handler: async ({ text }) => textResult(text),
    });
    const client = await connectClient(createAppServer({ name: 'app', version: '1.0.0', detector, tools: [echo] }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('echo_text');
    const result = await client.callTool({ name: 'echo_text', arguments: { text: 'boo' } });
    expect(textOf(result as { content: unknown[] })).toBe('boo');
  });

  it('rejects an app tool that reuses a built-in name', () => {
    const clash = defineTool({
      name: 'detect_objects',
      description: 'd',
      inputSchema: z.object({}),
      handler: async () => textResult('x'),
    });
    expect(() => createAppServer({ name: 'app', version: '1.0.0', detector, tools: [clash] })).toThrow(SkeletonMcpError);
  });
});

describe('defineTool', () => {
  it('returns the same definition it was given', () => {
    const tool = { name: 'noop', description: 'd', inputSchema: z.object({}), handler: async () => textResult('x') };
    expect(defineTool(tool)).toBe(tool);
  });
});
