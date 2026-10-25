'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { generateApiKey } from '@/lib/auth/api-key';

export async function createApiKeyAction(
  name: string
): Promise<{ error: string } | { key: string }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Give the key a name' };
  if (trimmed.length > 100) return { error: 'Name must be 100 characters or fewer' };

  const { key, prefix, hash } = generateApiKey();
  const supabase = await createClient();
  const { error } = await supabase.from('api_keys').insert({
    team_id: team.id,
    created_by: user.id,
    name: trimmed,
    key_prefix: prefix,
    key_hash: hash,
  });

  if (error) return { error: error.message };
  revalidatePath('/settings/integrations');
  return { key };
}

export async function revokeApiKeyAction(
  id: number
): Promise<{ error: string } | { success: true }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', team.id)
    .is('revoked_at', null);

  if (error) return { error: error.message };
  revalidatePath('/settings/integrations');
  return { success: true };
}
