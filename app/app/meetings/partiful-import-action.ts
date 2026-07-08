'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getUser,
  getTeamForUser,
  createMeeting,
  setMeetingAttendance,
  getMeetingById,
} from '@/lib/db/supabase-queries';

const NEWSLETTER_CATEGORY = 'Newsletter subscriber';

export interface PartifulGuest {
  name: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: string | null;
}

export interface PartifulImportResult {
  meetingName: string;
  matched: number;
  created: number;
  alreadyAttended: number;
  taggedNewsletter: number;
  total: number;
}

export async function importPartifulAction(
  meetingId: number | null,
  meetingName: string,
  meetingDate: string,
  meetingLocation: string | null,
  guests: PartifulGuest[]
): Promise<{ error: string } | { result: PartifulImportResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (!meetingName.trim()) return { error: 'Meeting name is required' };
  if (!meetingDate) return { error: 'Date is required' };
  if (guests.length === 0) return { error: 'No guests to import' };

  const supabase = await createClient();

  // Use existing meeting or create new one
  let mId: number;
  if (meetingId) {
    mId = meetingId;
  } else {
    const meeting = await createMeeting({
      team_id: team.id,
      user_id: user.id,
      name: meetingName.trim(),
      date: meetingDate,
      location: meetingLocation || null,
      notes: null,
    });
    if (!meeting) return { error: 'Failed to create meeting' };
    mId = meeting.id;
  }

  // Find or create "Newsletter subscriber" category
  const { data: existingCats } = await (supabase as any)
    .from('contact_categories')
    .select('id')
    .eq('team_id', team.id)
    .ilike('name', NEWSLETTER_CATEGORY);

  let categoryId: number;
  if (existingCats && existingCats.length > 0) {
    categoryId = existingCats[0].id;
  } else {
    const { data: newCat, error: catErr } = await (supabase as any)
      .from('contact_categories')
      .insert({ team_id: team.id, name: NEWSLETTER_CATEGORY, color: 'green' })
      .select('id')
      .single();
    if (catErr || !newCat) return { error: 'Failed to create Newsletter subscriber category' };
    categoryId = newCat.id;
  }

  // Load existing contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone')
    .eq('team_id', team.id);

  const contactByEmail = new Map<string, number>();
  const contactByPhone = new Map<string, number>();
  const contactByName = new Map<string, number>();
  for (const c of (contacts || [])) {
    if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
    if (c.phone) contactByPhone.set(c.phone.replace(/\D/g, ''), c.id);
    if (c.name) contactByName.set(c.name.toLowerCase().trim(), c.id);
  }

  // Get existing attendance
  const meeting = await getMeetingById(mId, team.id);
  const alreadyAttendedIds = new Set<number>(
    (meeting?.attendance || []).map((a: any) => a.contact_id as number)
  );

  let matched = 0;
  let created = 0;
  let alreadyAttended = 0;
  const newAttendeeIds: number[] = [];
  const newContactIdsForNewsletter: number[] = [];

  for (const guest of guests) {
    let contactId: number | undefined;
    if (guest.email) contactId = contactByEmail.get(guest.email.toLowerCase().trim());
    if (!contactId && guest.phone) contactId = contactByPhone.get(guest.phone.replace(/\D/g, ''));
    if (!contactId && guest.name) contactId = contactByName.get(guest.name.toLowerCase().trim());

    if (contactId) {
      matched++;
      if (alreadyAttendedIds.has(contactId)) {
        alreadyAttended++;
        continue;
      }
    } else {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          name: guest.name || guest.email || 'Unknown',
          email: guest.email || null,
          phone: guest.phone || null,
          team_id: team.id,
          user_id: user.id,
        } as any)
        .select('id')
        .single();
      if (contactErr || !newContact) continue;
      contactId = newContact.id as number;
      created++;
      newContactIdsForNewsletter.push(contactId);
      if (guest.email) contactByEmail.set(guest.email.toLowerCase().trim(), contactId);
      if (guest.phone) contactByPhone.set(guest.phone.replace(/\D/g, ''), contactId);
      if (guest.name) contactByName.set(guest.name.toLowerCase().trim(), contactId);
    }

    newAttendeeIds.push(contactId);
  }

  // Merge new attendees with existing
  if (newAttendeeIds.length > 0) {
    const allIds = [...alreadyAttendedIds, ...newAttendeeIds];
    await setMeetingAttendance(mId, team.id, allIds);
  }

  // Tag new contacts as "Newsletter subscriber"
  let taggedNewsletter = 0;
  if (newContactIdsForNewsletter.length > 0) {
    const tagRows = newContactIdsForNewsletter.map((id) => ({
      contact_id: id,
      category_id: categoryId,
      team_id: team.id,
    }));
    const { error: tagErr } = await (supabase as any)
      .from('contact_category_assignments')
      .upsert(tagRows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
    if (!tagErr) taggedNewsletter = newContactIdsForNewsletter.length;
  }

  revalidatePath('/app/meetings');
  revalidatePath(`/app/meetings/${mId}`);
  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');

  return {
    result: {
      meetingName: meetingName.trim(),
      matched,
      created,
      alreadyAttended,
      taggedNewsletter,
      total: guests.length,
    },
  };
}
