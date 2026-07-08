'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';

const NEWSLETTER_CATEGORY = 'Newsletter subscriber';

export interface PartifulGuest {
  name: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: string | null;
}

export interface PartifulImportResult {
  eventName: string;
  matched: number;
  created: number;
  alreadyAttended: number;
  taggedNewsletter: number;
  total: number;
}

export async function importPartifulEventAction(
  eventName: string,
  eventDate: string | null,
  guests: PartifulGuest[]
): Promise<{ error: string } | { result: PartifulImportResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (!eventName.trim()) return { error: 'Event name is required' };
  if (guests.length === 0) return { error: 'No guests to import' };

  const supabase = await createClient();

  // Find or create event
  const { data: existingEvent } = await (supabase as any)
    .from('events')
    .select('id')
    .eq('team_id', team.id)
    .eq('name', eventName.trim())
    .maybeSingle();

  let eventId: number;
  if (existingEvent) {
    eventId = existingEvent.id;
  } else {
    const insertData: any = { team_id: team.id, name: eventName.trim(), source: 'partiful' };
    if (eventDate) insertData.event_date = eventDate;
    const { data: newEvent, error: eventErr } = await (supabase as any)
      .from('events')
      .insert(insertData)
      .select('id')
      .single();
    if (eventErr || !newEvent) return { error: eventErr?.message || 'Failed to create event' };
    eventId = newEvent.id;
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

  // Check existing attendance for this event
  const { data: existingAttendance } = await (supabase as any)
    .from('contact_event_attendance')
    .select('contact_id')
    .eq('event_id', eventId)
    .eq('team_id', team.id);
  const alreadyAttendedIds = new Set(
    ((existingAttendance || []) as { contact_id: number }[]).map((a) => a.contact_id)
  );

  let matched = 0;
  let created = 0;
  let alreadyAttended = 0;
  const attendanceRows: { contact_id: number; event_id: number; team_id: number; rsvp_status: string | null }[] = [];
  const newContactIdsForNewsletter: number[] = [];

  for (const guest of guests) {
    // Try to match existing contact: email > phone > name
    let contactId: number | undefined;
    if (guest.email) {
      contactId = contactByEmail.get(guest.email.toLowerCase().trim());
    }
    if (!contactId && guest.phone) {
      contactId = contactByPhone.get(guest.phone.replace(/\D/g, ''));
    }
    if (!contactId && guest.name) {
      contactId = contactByName.get(guest.name.toLowerCase().trim());
    }

    if (contactId) {
      matched++;
      if (alreadyAttendedIds.has(contactId)) {
        alreadyAttended++;
        continue;
      }
    } else {
      // Create new contact
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
      contactId = newContact.id;
      created++;
      newContactIdsForNewsletter.push(contactId);
      // Add to lookup maps so duplicates within the same CSV don't create duplicates
      if (guest.email) contactByEmail.set(guest.email.toLowerCase().trim(), contactId);
      if (guest.phone) contactByPhone.set(guest.phone.replace(/\D/g, ''), contactId);
      if (guest.name) contactByName.set(guest.name.toLowerCase().trim(), contactId);
    }

    attendanceRows.push({
      contact_id: contactId,
      event_id: eventId,
      team_id: team.id,
      rsvp_status: guest.rsvpStatus,
    });
  }

  // Insert attendance records
  if (attendanceRows.length > 0) {
    await (supabase as any)
      .from('contact_event_attendance')
      .upsert(attendanceRows, { onConflict: 'contact_id,event_id', ignoreDuplicates: true });
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

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');

  return {
    result: {
      eventName: eventName.trim(),
      matched,
      created,
      alreadyAttended,
      taggedNewsletter,
      total: guests.length,
    },
  };
}

export async function getEventsAction(): Promise<{ id: number; name: string }[]> {
  const team = await getTeamForUser();
  if (!team) return [];
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('events')
    .select('id, name')
    .eq('team_id', team.id)
    .order('created_at', { ascending: false });
  return (data || []) as { id: number; name: string }[];
}
