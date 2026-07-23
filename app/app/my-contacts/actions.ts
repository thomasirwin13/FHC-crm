'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';

export async function addContactToMyListAction(contactId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { setOrganizersForContact, getOrganizersForContact } = await import('@/lib/db/supabase-queries');
  const current = await getOrganizersForContact(contactId, team.id);
  const currentIds = current.map((o: any) => o.user_id);

  if (currentIds.includes(user.id)) {
    return { error: 'Already assigned to this contact' };
  }

  const ok = await setOrganizersForContact(contactId, team.id, [...currentIds, user.id]);
  if (!ok) return { error: 'Failed to add contact' };

  revalidatePath('/app/my-contacts');
  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/contacts');
  return { success: true };
}

export async function removeContactFromMyListAction(contactId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { setOrganizersForContact, getOrganizersForContact } = await import('@/lib/db/supabase-queries');
  const current = await getOrganizersForContact(contactId, team.id);
  const currentIds = current.map((o: any) => o.user_id);
  const next = currentIds.filter((id: number) => id !== user.id);

  const ok = await setOrganizersForContact(contactId, team.id, next);
  if (!ok) return { error: 'Failed to remove contact' };

  revalidatePath('/app/my-contacts');
  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/contacts');
  return { success: true };
}
