import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOutreachQueueForTeam } from '@/lib/db/outreach';
import { resolveMonday } from '@/lib/integrations';
import { createMondayClient } from '@/lib/monday';

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find all teams with Monday.com integration
  const { data: integrations } = await (supabase as any)
    .from('team_integrations')
    .select('team_id, api_key, config')
    .eq('provider', 'monday')
    .not('api_key', 'is', null);

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ message: 'No teams with Monday.com connected', synced: 0 });
  }

  let synced = 0;
  const errors: string[] = [];

  for (const integration of integrations) {
    const teamId = integration.team_id;

    try {
      const items = await getOutreachQueueForTeam(teamId);
      if (items.length === 0) continue;

      // Get contact names
      const contactIds = items.map((i: any) => i.contact_id);
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', contactIds);

      const nameMap: Record<number, string> = {};
      for (const c of (contacts || []) as any[]) {
        nameMap[c.id] = c.name;
      }

      // Get user names for grouping
      const userIds = [...new Set(items.map((i: any) => i.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      const userMap: Record<number, string> = {};
      for (const u of (users || []) as any[]) {
        userMap[u.id] = u.name || u.email;
      }

      // Group items by user
      const byUser: Record<number, typeof items> = {};
      for (const item of items) {
        if (!byUser[item.user_id]) byUser[item.user_id] = [];
        byUser[item.user_id].push(item);
      }

      const monday = await resolveMonday(teamId);
      if (!monday.apiToken) continue;

      const client = createMondayClient(monday.apiToken, monday.boardId);

      const weekStart = getWeekStart();
      const totalContacts = items.length;
      const title = `Week of ${weekStart} — Outreach (${totalContacts} contact${totalContacts !== 1 ? 's' : ''})`;

      const bodyParts: string[] = [];
      for (const userId of userIds) {
        const userItems = byUser[userId] || [];
        if (userItems.length === 0) continue;
        bodyParts.push(`**${userMap[userId] || 'Unknown'}:**`);
        for (const item of userItems) {
          const status = item.status === 'need_outreach' ? '🔴' : item.status === 'scheduling' ? '🟡' : '🟢';
          bodyParts.push(`${status} ${nameMap[item.contact_id] || `Contact #${item.contact_id}`}`);
        }
        bodyParts.push('');
      }

      await client.createOutreachTask({
        title,
        body: bodyParts.join('\n'),
        contactCount: totalContacts,
      });

      synced++;
    } catch (err: any) {
      errors.push(`Team ${teamId}: ${err.message}`);
    }
  }

  return NextResponse.json({
    message: `Synced ${synced} team(s) to Monday.com`,
    synced,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
