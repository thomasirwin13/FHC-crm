/** @jest-environment node */
import { z } from 'zod';
import { defineTool, handleMcpPost } from '@/lib/mcp/protocol';

const server = { name: 'test', version: '1.0.0', instructions: 'Test server' };

const tools = [
  defineTool({
    name: 'echo',
    title: 'Echo',
    description: 'Echo the input back',
    inputSchema: z.object({ text: z.string(), times: z.number().int().default(1) }),
    execute: async ({ text, times }) => ({ echoed: text.repeat(times) }),
  }),
  defineTool({
    name: 'save',
    title: 'Save',
    description: 'Writes something',
    readOnly: false,
    inputSchema: z.object({}),
    execute: async () => ({ saved: true }),
  }),
  defineTool({
    name: 'boom',
    title: 'Boom',
    description: 'Always fails',
    inputSchema: z.object({}),
    execute: async () => {
      throw new Error('kaboom');
    },
  }),
];

function post(body: unknown) {
  return handleMcpPost(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    tools,
    server,
  );
}

describe('MCP protocol handler', () => {
  it('negotiates a supported protocol version on initialize', async () => {
    const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    const json = await res.json();
    expect(json.result.protocolVersion).toBe('2025-03-26');
    expect(json.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(json.result.serverInfo).toEqual({ name: 'test', version: '1.0.0' });
    expect(json.result.instructions).toBe('Test server');
  });

  it('falls back to the latest version for an unknown one', async () => {
    const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    expect((await res.json()).result.protocolVersion).toBe('2025-06-18');
  });

  it('accepts notifications with 202 and no body', async () => {
    const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it('lists tools with JSON schemas', async () => {
    const res = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const { result } = await res.json();
    expect(result.tools.map((t: any) => t.name)).toEqual(['echo', 'save', 'boom']);
    expect(result.tools[0].inputSchema.type).toBe('object');
    expect(result.tools[0].inputSchema.properties.text).toEqual({ type: 'string' });
    expect(result.tools[0].inputSchema.$schema).toBeUndefined();
    expect(result.tools[0].annotations.readOnlyHint).toBe(true);
    expect(result.tools[1].annotations.readOnlyHint).toBe(false);
  });

  it('calls a tool, applying schema defaults', async () => {
    const res = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { text: 'hi' } } });
    const { result } = await res.json();
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ echoed: 'hi' });
  });

  it('reports invalid arguments as a tool error', async () => {
    const res = await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'echo', arguments: { text: 5 } } });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^Invalid arguments: text/);
  });

  it('reports a thrown error as a tool error', async () => {
    const res = await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'boom' } });
    const { result } = await res.json();
    expect(result).toEqual({ content: [{ type: 'text', text: 'kaboom' }], isError: true });
  });

  it('rejects an unknown tool and an unknown method', async () => {
    const tool = await (await post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope' } })).json();
    expect(tool.error.code).toBe(-32602);
    const method = await (await post({ jsonrpc: '2.0', id: 7, method: 'resources/list' })).json();
    expect(method.error.code).toBe(-32601);
  });

  it('handles batches and malformed JSON', async () => {
    const batch = await (
      await post([
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
      ])
    ).json();
    expect(batch).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }]);

    const bad = await post('{not json');
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe(-32700);
  });
});
