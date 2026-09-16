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
import { createActionNetworkClient } from '@/lib/action-network';
import { resolveActionNetworkKey } from '@/lib/integrations';
import { buildContactMatcher } from '@/lib/utils/name-matching';

export interface ANEventSummary {
  id: string;
  title: string;
  date: string | null;
}

export interface ANAttendee {
  anId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // Whether this attendee already matches a CRM contact.
  status: 'existing' | 'new';
  matchedContactId: number | null;
}

export interface ANEventAttendeesResult {
  attendees: ANAttendee[];
  capped: boolean;
}

export interface ANEventImportResult {
  meetingName: string;
  matched: number;
  created: number;
  alreadyAttended: number;
  total: number;
}

/**
 * Pull every event associated with the team's Action Network account so the
 * user can pick one to inspect / import attendance from.
 */
export async function listActionNetworkEventsAction(): Promise<
  { error: string } | { result: { events: ANEventSummary[] } }
> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const apiKey = await resolveActionNetworkKey(team.id);
  if (!apiKey) {
    return { error: 'Action Network is not configured. Add your API key in Settings → Integrations.' };
  }
  const an = createActionNetworkClient(apiKey);

  let events;
  try {
    events = await an.fetchEvents();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch Action Network events' };
  }

  const summaries: ANEventSummary[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.startDate ? e.startDate.slice(0, 10) : null,
  }));

  // Most recent first; events without a date sink to the bottom.
  summaries.sort((a, b) => {
    if (!a.date && !b.date) return a.title.localeCompare(b.title);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return { result: { events: summaries } };
}

/**
 * Fetch the people who participated in a single Action Network event and match
 * them against existing CRM contacts. Uses the bulk people list (keyed by AN
 * person id) joined with the event's attendance records.
 */
export async function getActionNetworkEventAttendeesAction(
  eventId: string
): Promise<{ error: string } | { result: ANEventAttendeesResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const apiKey = await resolveActionNetworkKey(team.id);
  if (!apiKey) {
    return { error: 'Action Network is not configured.' };
  }
  const an = createActionNetworkClient(apiKey);

  let peopleResult;
  let attendance;
  try {
    [peopleResult, attendance] = await Promise.all([
      an.fetchAllPeople(),
      an.fetchAttendancePersonIds(eventId),
    ]);
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch Action Network attendance' };
  }

  const peopleByAnId = new Map(peopleResult.people.map((p) => [p.anId, p]));

  // Load CRM contacts for matching.
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone')
    .eq('team_id', team.id);
  const matcher = buildContactMatcher(
    ((contacts || []) as { id: number; name: string | null; email: string | null; phone: string | null }[])
  );

  const seen = new Set<string>();
  const attendees: ANAttendee[] = [];
  for (const anId of attendance.personIds) {
    if (seen.has(anId)) continue;
    seen.add(anId);
    const person = peopleByAnId.get(anId);
    if (!person) continue; // person not in the (possibly capped) people list
    const match = matcher.findMatch({
      email: person.email,
      phone: person.phone,
      name: person.name,
    });
    attendees.push({
      anId: person.anId,
      name: person.name,
      email: person.email,
      phone: person.phone,
      street: person.street,
      city: person.city,
      state: person.state,
      zip: person.zip,
      status: match ? 'existing' : 'new',
      matchedContactId: match ? match.id : null,
    });
  }

  // Sort matched contacts first, then alphabetically.
  attendees.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'existing' ? -1 : 1;
    return (a.name || a.email || '').localeCompare(b.name || b.email || '');
  });

  return {
    result: {
      attendees,
      capped: peopleResult.capped || attendance.capped,
    },
  };
}

/**
 * Import a single Action Network event's attendance into the CRM: create (or
 * reuse) a meeting record and mark every attendee present, creating new contacts
 * for anyone not already in the CRM.
 */
export async function importActionNetworkEventAction(
  meetingId: number | null,
  meetingName: string,
  meetingDate: string,
  attendees: ANAttendee[],
  manualMatches?: Record<string, number>,
): Promise<{ error: string } | { result: ANEventImportResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (!meetingName.trim()) return { error: 'Meeting name is required' };
  if (!meetingDate) return { error: 'Date is required' };
  if (attendees.length === 0) return { error: 'No attendees to import' };

  const supabase = await createClient();

  // Use existing meeting or create a new one.
  let mId: number;
  if (meetingId) {
    mId = meetingId;
  } else {
    const meeting = await createMeeting({
      team_id: team.id,
      user_id: user.id,
      name: meetingName.trim(),
      date: meetingDate,
      location: null,
      notes: null,
    });
    if (!meeting) return { error: 'Failed to create meeting' };
    mId = meeting.id;
  }

  // Re-match against current contacts (guards against stale client data).
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone')
    .eq('team_id', team.id);
  const matcher = buildContactMatcher(
    ((contacts || []) as { id: number; name: string | null; email: string | null; phone: string | null }[])
  );

  const meeting = await getMeetingById(mId, team.id);
  const alreadyAttendedIds = new Set<number>(
    (meeting?.attendance || []).map((a: any) => a.contact_id as number)
  );

  let matched = 0;
  let created = 0;
  let alreadyAttended = 0;
  const newAttendeeIds: number[] = [];

  for (const a of attendees) {
    const manualId = manualMatches?.[a.anId];
    const matchResult = manualId
      ? { id: manualId }
      : matcher.findMatch({ email: a.email, phone: a.phone, name: a.name });
    let contactId: number | undefined = matchResult?.id;

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
          name: a.name || a.email || 'Unknown',
          email: a.email || null,
          phone: a.phone || null,
          street: a.street || null,
          city: a.city || null,
          state: a.state || null,
          zip: a.zip || null,
          team_id: team.id,
          user_id: user.id,
        } as any)
        .select('id')
        .single();
      if (contactErr || !newContact) continue;
      contactId = newContact.id as number;
      created++;
    }

    newAttendeeIds.push(contactId);
  }

  if (newAttendeeIds.length > 0) {
    const allIds = [...alreadyAttendedIds, ...newAttendeeIds];
    await setMeetingAttendance(mId, team.id, allIds);
  }

  revalidatePath('/app/meetings');
  revalidatePath(`/app/meetings/${mId}`);
  revalidatePath('/app/contacts');

  return {
    result: {
      meetingName: meetingName.trim(),
      matched,
      created,
      alreadyAttended,
      total: attendees.length,
    },
  };
}
