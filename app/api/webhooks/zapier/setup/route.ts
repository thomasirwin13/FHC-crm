import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';

export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json({ error: 'No team found' }, { status: 404 });
  }

  const supabase = createAdminClient();
  const apiKey = `zap_${randomBytes(32).toString('hex')}`;

  const { data: existing } = await supabase
    .from('team_integrations')
    .select('id')
    .eq('team_id', team.id)
    .eq('provider', 'zapier')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('team_integrations')
      .update({ api_key: apiKey })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('team_integrations')
      .insert({ team_id: team.id, provider: 'zapier', api_key: apiKey, config: {} });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    apiKey,
    endpoints: {
      contacts: '/api/webhooks/zapier/contacts',
      organizations: '/api/webhooks/zapier/organizations',
    },
    usage: `Authorization: Bearer ${apiKey}`,
  });
}
