'use server';

import { getUser, getTeamForUser, deleteContact, logActivity } from '@/lib/db/supabase-queries';
import { ActivityType } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

export async function deleteContactFromDetailAction(contactId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  try {
    const deleted = await deleteContact(contactId, team.id);
    if (!deleted) return { error: 'Contact not found' };

    await logActivity(team.id, user.id, ActivityType.DELETE_CONTACT);
    revalidatePath('/app/contacts');

    return { success: 'Contact deleted' };
  } catch {
    return { error: 'Failed to delete contact' };
  }
}
