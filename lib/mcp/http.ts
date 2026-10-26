import 'server-only';

import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { createCrmTools } from './crm-tools';
import { createCrmWriteTools } from './crm-write-tools';
import { handleMcpPost } from './protocol';

const READ_INSTRUCTIONS =
  'Access to one team\'s CRM: organizations, contacts, one-on-one meeting notes, meetings with their attendees, and events. ' +
  'Use search_crm to find records by name, then get_organization or get_contact for details; list_meetings and get_meeting for meetings.';

const WRITE_INSTRUCTIONS =
  ' This key can also change data: update or create contacts and organizations, log 1-on-1 meetings, and create meetings and record who attended. ' +
  'Always look a record up first and confirm you have the right one before changing it, and search before creating to avoid duplicates.';

function serverInfo(canWrite: boolean) {
  return {
    name: 'fhc-crm',
    version: '1.1.0',
    instructions: canWrite ? READ_INSTRUCTIONS + WRITE_INSTRUCTIONS : READ_INSTRUCTIONS + ' This key is read only.',
  };
}

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

  const canWrite = auth.canWrite && auth.userId !== null;
  const tools = canWrite
    ? [...createCrmTools(auth.teamId), ...createCrmWriteTools(auth.teamId, auth.userId!)]
    : createCrmTools(auth.teamId);

  return handleMcpPost(request, tools, serverInfo(canWrite));
}

// This server is stateless and never opens a server-to-client event stream.
export function mcpMethodNotAllowed(): Response {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
