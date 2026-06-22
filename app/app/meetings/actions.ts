'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  getUser,
  getTeamForUser,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  setMeetingAttendance,
} from '@/lib/db/supabase-queries';

const meetingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  date: z.string().min(1, 'Date is required'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function createMeetingAction(data: z.infer<typeof meetingSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = meetingSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const meeting = await createMeeting({
      team_id: team.id,
      user_id: user.id,
      name: validated.data.name,
      date: validated.data.date,
      location: validated.data.location || null,
      notes: validated.data.notes || null,
    });
    revalidatePath('/app/meetings');
    return { success: 'Meeting created', data: meeting };
  } catch {
    return { error: 'Failed to create meeting' };
  }
}

export async function updateMeetingAction(id: number, data: z.infer<typeof meetingSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = meetingSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const meeting = await updateMeeting(id, team.id, {
      name: validated.data.name,
      date: validated.data.date,
      location: validated.data.location || null,
      notes: validated.data.notes || null,
    });
    revalidatePath('/app/meetings');
    revalidatePath(`/app/meetings/${id}`);
    return { success: 'Meeting updated', data: meeting };
  } catch {
    return { error: 'Failed to update meeting' };
  }
}

export async function deleteMeetingAction(id: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await deleteMeeting(id, team.id);
  if (!ok) return { error: 'Failed to delete meeting' };
  revalidatePath('/app/meetings');
  return { success: 'Meeting deleted' };
}

export async function setAttendanceAction(meeting_id: number, contact_ids: number[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await setMeetingAttendance(meeting_id, team.id, contact_ids);
  if (!ok) return { error: 'Failed to save attendance' };
  revalidatePath(`/app/meetings/${meeting_id}`);
  revalidatePath('/app/meetings');
  return { success: 'Attendance saved' };
}
