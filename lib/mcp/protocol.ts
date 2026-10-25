// Minimal, stateless Model Context Protocol server over Streamable HTTP.
//
// Every POST carries one JSON-RPC message (or a batch) and gets a plain JSON
// response — no sessions and no server-sent event stream, which the spec
// allows and which suits serverless route handlers. Only the `tools`
// capability is implemented.

import { z } from 'zod';
import { zodSchema } from 'ai';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export interface McpTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  execute: (input: z.infer<S>) => Promise<unknown>;
}

export interface McpServerInfo {
  name: string;
  version: string;
  instructions?: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

export function defineTool<S extends z.ZodTypeAny>(tool: McpTool<S>): McpTool {
  return tool as unknown as McpTool;
}

function error(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function describeTool(tool: McpTool) {
  const { $schema, ...inputSchema } = zodSchema(tool.inputSchema).jsonSchema as Record<string, any>;
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  };
}

async function callTool(tools: McpTool[], params: Record<string, any> | undefined) {
  const tool = tools.find((t) => t.name === params?.name);
  if (!tool) return { error: `Unknown tool: ${params?.name}` };

  const parsed = tool.inputSchema.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      result: {
        content: [{ type: 'text', text: `Invalid arguments: ${issue.path.join('.') || 'input'} ${issue.message}` }],
        isError: true,
      },
    };
  }

  try {
    const output = await tool.execute(parsed.data);
    return { result: { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] } };
  } catch (e) {
    console.error(`[mcp] tool ${tool.name} failed:`, e);
    return {
      result: {
        content: [{ type: 'text', text: e instanceof Error ? e.message : 'Tool failed' }],
        isError: true,
      },
    };
  }
}

async function handleMessage(
  message: unknown,
  tools: McpTool[],
  server: McpServerInfo,
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || (message as any).jsonrpc !== '2.0') {
    return error(null, INVALID_REQUEST, 'Invalid JSON-RPC message');
  }
  const req = message as JsonRpcRequest;

  // Notifications (no id) and responses never get a reply.
  if (req.id === undefined || typeof req.method !== 'string') return null;

  switch (req.method) {
    case 'initialize': {
      const requested = req.params?.protocolVersion;
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: server.name, version: server.version },
          ...(server.instructions ? { instructions: server.instructions } : {}),
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id: req.id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id: req.id, result: { tools: tools.map(describeTool) } };
    case 'tools/call': {
      const outcome = await callTool(tools, req.params);
      if ('error' in outcome) return error(req.id, INVALID_PARAMS, outcome.error!);
      return { jsonrpc: '2.0', id: req.id, result: outcome.result };
    }
    default:
      return error(req.id, METHOD_NOT_FOUND, `Method not found: ${req.method}`);
  }
}

/** Handle one Streamable HTTP POST body and build the HTTP response. */
export async function handleMcpPost(
  request: Request,
  tools: McpTool[],
  server: McpServerInfo,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(error(null, PARSE_ERROR, 'Parse error'), { status: 400 });
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleMessage(m, tools, server)))).filter(
      (r): r is JsonRpcResponse => r !== null,
    );
    return responses.length ? Response.json(responses) : new Response(null, { status: 202 });
  }

  const response = await handleMessage(body, tools, server);
  return response ? Response.json(response) : new Response(null, { status: 202 });
}
