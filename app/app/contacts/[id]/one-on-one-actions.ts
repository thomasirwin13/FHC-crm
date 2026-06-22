'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  getUser,
  getTeamForUser,
  createOneOnOne,
  updateOneOnOne,
  deleteOneOnOne,
  updateContact,
} from '@/lib/db/supabase-queries';

const oneOnOneSchema = z.object({
  contact_id: z.number(),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  user_id: z.number().nullable().optional(),
  organizer_name: z.string().optional(),
});

export async function createOneOnOneAction(data: z.infer<typeof oneOnOneSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = oneOnOneSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const record = await createOneOnOne({
      team_id: team.id,
      contact_id: validated.data.contact_id,
      date: validated.data.date,
      notes: validated.data.notes || null,
      user_id: validated.data.user_id ?? null,
      organizer_name: validated.data.organizer_name || null,
    });
    revalidatePath(`/app/contacts/${validated.data.contact_id}`);
    return { success: '1-on-1 logged', data: record };
  } catch {
    return { error: 'Failed to log 1-on-1' };
  }
}

export async function updateOneOnOneAction(id: number, contact_id: number, data: z.infer<typeof oneOnOneSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  try {
    await updateOneOnOne(id, team.id, {
      date: data.date,
      notes: data.notes || null,
      user_id: data.user_id ?? null,
      organizer_name: data.organizer_name || null,
    });
    revalidatePath(`/app/contacts/${contact_id}`);
    return { success: '1-on-1 updated' };
  } catch {
    return { error: 'Failed to update 1-on-1' };
  }
}

export async function deleteOneOnOneAction(id: number, contact_id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await deleteOneOnOne(id, team.id);
  if (!ok) return { error: 'Failed to delete 1-on-1' };
  revalidatePath(`/app/contacts/${contact_id}`);
  return { success: '1-on-1 deleted' };
}

export async function toggleActionCommittedAction(contact_id: number, value: boolean) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const updated = await updateContact(contact_id, team.id, { action_committed: value });
  if (!updated) return { error: 'Failed to update contact' };
  revalidatePath(`/app/contacts/${contact_id}`);
  return { success: 'Updated' };
}
