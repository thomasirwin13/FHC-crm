import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export interface WebhookContext {
  teamId: number;
  userId: number;
}

export async function authenticateWebhook(
  request: Request,
): Promise<WebhookContext | Response> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' },
      { status: 401 },
    );
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    return Response.json({ error: 'Empty API key' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: integration } = await supabase
    .from('team_integrations')
    .select('team_id')
    .eq('provider', 'zapier')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (!integration) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { data: owner } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', integration.team_id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (!owner) {
    return Response.json({ error: 'Team has no owner' }, { status: 500 });
  }

  return { teamId: integration.team_id, userId: owner.user_id };
}
