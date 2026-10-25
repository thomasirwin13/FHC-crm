import 'server-only';

import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { createCrmTools } from './crm-tools';
import { handleMcpPost } from './protocol';

const SERVER_INFO = {
  name: 'fhc-crm',
  version: '1.0.0',
  instructions:
    'Read-only access to one team\'s CRM: organizations, contacts and one-on-one meeting notes. ' +
    'Use search_crm to find records by name, then get_organization or get_contact for details.',
};

function unauthorized(message: string) {
  return Response.json(
    { jsonrpc: '2.0', id: null, error: { code: -32001, message } },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}

export async function mcpPost(request: Request, keyFromPath?: string): Promise<Response> {
  const key = extractApiKey(request, keyFromPath);
  if (!key) return unauthorized('Missing API key. Use Authorization: Bearer <key>, or /api/mcp/<key>.');

  const auth = await authenticateApiKey(key);
  if (!auth) return unauthorized('Invalid or revoked API key');

  return handleMcpPost(request, createCrmTools(auth.teamId), SERVER_INFO);
}

// This server is stateless and never opens a server-to-client event stream.
export function mcpMethodNotAllowed(): Response {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
