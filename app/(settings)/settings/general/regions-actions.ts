'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';

export async function saveRegionsAction(
  regions: string[]
): Promise<{ error: string } | { success: true }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const cleaned = regions.map((r) => r.trim()).filter(Boolean);
  if (cleaned.length === 0) return { error: 'Add at least one region' };

  const supabase = await createClient();

  const { data: existing } = await (supabase as any)
    .from('team_integrations')
    .select('config')
    .eq('team_id', team.id)
    .eq('provider', 'settings')
    .maybeSingle();

  const config = { ...(existing?.config || {}), regions: cleaned };

  const { error } = await (supabase as any)
    .from('team_integrations')
    .upsert(
      {
        team_id: team.id,
        provider: 'settings',
        api_key: null,
        config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,provider' }
    );

  if (error) return { error: error.message };
  revalidatePath('/settings/general');
  revalidatePath('/app/organizations');
  revalidatePath('/app/contacts');
  return { success: true };
}
