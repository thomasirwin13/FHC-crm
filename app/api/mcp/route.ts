import { mcpPost, mcpMethodNotAllowed } from '@/lib/mcp/http';

export const dynamic = 'force-dynamic';

// MCP endpoint authenticated with `Authorization: Bearer <api key>`.
export async function POST(request: Request) {
  return mcpPost(request);
}

export const GET = mcpMethodNotAllowed;
export const DELETE = mcpMethodNotAllowed;
