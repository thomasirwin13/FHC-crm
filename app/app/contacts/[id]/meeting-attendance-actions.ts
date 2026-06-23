'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getTeamForUser, addMeetingAttendance, removeMeetingAttendance } from '@/lib/db/supabase-queries';

export async function addMeetingAttendanceAction(contactId: number, meetingId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await addMeetingAttendance(meetingId, contactId, team.id);
  if (!ok) return { error: 'Failed to add attendance' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath(`/app/meetings/${meetingId}`);
  return { success: true };
}

export async function removeMeetingAttendanceAction(contactId: number, meetingId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await removeMeetingAttendance(meetingId, contactId, team.id);
  if (!ok) return { error: 'Failed to remove attendance' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath(`/app/meetings/${meetingId}`);
  return { success: true };
}
