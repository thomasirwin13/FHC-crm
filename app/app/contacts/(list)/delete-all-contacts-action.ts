'use server';

import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { revalidatePath } from 'next/cache';

export async function deleteAllContactsAction(): Promise<
  { error: string } | { deleted: number }
> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();

  const { data: contacts, error: fetchError } = await (supabase as any)
    .from('contacts')
    .select('id')
    .eq('team_id', team.id);

  if (fetchError) return { error: fetchError.message };
  if (!contacts || contacts.length === 0) return { deleted: 0 };

  const ids = contacts.map((c: any) => c.id);

  const { error: deleteError } = await (supabase as any)
    .from('contacts')
    .delete()
    .eq('team_id', team.id)
    .in('id', ids);

  if (deleteError) return { error: deleteError.message };

  revalidatePath('/app/contacts');
  revalidatePath('/app/organizations');
  return { deleted: ids.length };
}
