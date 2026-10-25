import { mcpPost, mcpMethodNotAllowed } from '@/lib/mcp/http';

export const dynamic = 'force-dynamic';

// Same MCP endpoint with the API key in the URL, for clients (like Claude's
// custom connector form) that can't send an Authorization header.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return mcpPost(request, key);
}

export const GET = mcpMethodNotAllowed;
export const DELETE = mcpMethodNotAllowed;
