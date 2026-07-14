'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { getTeamIntegration, type IntegrationProvider } from '@/lib/integrations';

const PROVIDERS: IntegrationProvider[] = ['action_network', 'mailerlite'];

export async function saveIntegrationAction(input: {
  provider: IntegrationProvider;
  apiKey?: string;
  groupId?: string;
}): Promise<{ error: string } | { success: true }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };
  if (!PROVIDERS.includes(input.provider)) return { error: 'Unknown integration' };

  const existing = await getTeamIntegration(team.id, input.provider);

  // A blank key means "leave the stored key unchanged" so users don't have to
  // re-enter the secret just to tweak other settings.
  const trimmedKey = (input.apiKey || '').trim();
  const apiKey = trimmedKey || existing?.apiKey || null;
  if (!apiKey) return { error: 'Enter an API key to connect this integration' };

  const config: Record<string, any> = { ...(existing?.config || {}) };
  if (input.provider === 'mailerlite') {
    const groupId = (input.groupId || '').trim();
    if (groupId) config.group_id = groupId;
    else delete config.group_id;
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('team_integrations')
    .upsert(
      {
        team_id: team.id,
        provider: input.provider,
        api_key: apiKey,
        config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,provider' }
    );

  if (error) return { error: error.message };
  revalidatePath('/settings/integrations');
  revalidatePath('/app/contacts');
  return { success: true };
}

export async function disconnectIntegrationAction(
  provider: IntegrationProvider
): Promise<{ error: string } | { success: true }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };
  if (!PROVIDERS.includes(provider)) return { error: 'Unknown integration' };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('team_integrations')
    .delete()
    .eq('team_id', team.id)
    .eq('provider', provider);

  if (error) return { error: error.message };
  revalidatePath('/settings/integrations');
  revalidatePath('/app/contacts');
  return { success: true };
}
