'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createActionNetworkClient } from '@/lib/action-network';
import { resolveActionNetworkKey } from '@/lib/integrations';

const BASE_CATEGORY = 'Action Network';
const SIGNED_PREFIX = 'Signed: ';
const ATTENDED_PREFIX = 'Attended: ';

// Colors for auto-created categories (must match values the UI understands).
const SIGNED_COLOR = 'purple';
const ATTENDED_COLOR = 'orange';

export interface PendingPush {
  id: number;
  name: string | null;
  email: string;
}

export interface TagBreakdown {
  label: string;
  tagged: number;
}

export interface ActionNetworkSyncResult {
  peopleCount: number;
  pulled: number;
  alreadyTagged: number;
  created: number;
  petitions: TagBreakdown[];
  events: TagBreakdown[];
  pendingPush: PendingPush[];
  capped: boolean;
}

export interface ActionNetworkPushResult {
  pushed: number;
  pushFailed: number;
}

async function ensureCategory(
  supabase: any,
  teamId: number,
  name: string,
  color: string,
): Promise<number | null> {
  const { data: existing } = await supabase
    .from('contact_categories')
    .select('id')
    .eq('team_id', teamId)
    .ilike('name', name);
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from('contact_categories')
    .insert({ team_id: teamId, name, color })
    .select('id')
    .single();
  return error ? null : created.id;
}

// Tag a set of contacts with a category, skipping ones already tagged.
// Returns the number newly tagged.
async function tagContacts(
  supabase: any,
  teamId: number,
  categoryId: number,
  contactIds: number[],
): Promise<number> {
  if (contactIds.length === 0) return 0;
  const { data: existing } = await supabase
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', categoryId)
    .eq('team_id', teamId)
    .in('contact_id', contactIds);
  const alreadyTagged = new Set(
    ((existing || []) as { contact_id: number }[]).map((a) => a.contact_id)
  );
  const newIds = contactIds.filter((id) => !alreadyTagged.has(id));
  if (newIds.length === 0) return 0;

  const rows = newIds.map((id) => ({ contact_id: id, category_id: categoryId, team_id: teamId }));
  const { error } = await supabase
    .from('contact_category_assignments')
    .upsert(rows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
  return error ? 0 : newIds.length;
}

export async function syncActionNetworkAction(): Promise<
  { error: string } | { result: ActionNetworkSyncResult }
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

  const supabase = await createClient();
  const baseCategoryId = await ensureCategory(supabase as any, team.id, BASE_CATEGORY, 'blue');
  if (!baseCategoryId) return { error: 'Failed to create Action Network category' };

  // Fetch everyone from Action Network.
  let peopleResult;
  try {
    peopleResult = await an.fetchAllPeople();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch Action Network people' };
  }
  const { people, capped: peopleCapped } = peopleResult;
  let capped = peopleCapped;

  // Existing CRM contacts, keyed by lowercased email.
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id);
  const contactByEmail = new Map<string, { id: number; name: string | null }>();
  for (const c of (contacts || [])) {
    if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), { id: c.id, name: c.name });
  }

  // Match Action Network people to CRM contacts by email; queue unmatched.
  // anIdToContactId lets us map petition/event members (which reference the AN
  // person UUID) back to CRM contact rows without extra API calls.
  const anIdToContactId = new Map<string, number>();
  const matchedIds: number[] = [];
  const unmatched: { anId: string; email: string; name: string | null }[] = [];
  for (const p of people) {
    const match = contactByEmail.get(p.email.toLowerCase().trim());
    if (match) {
      matchedIds.push(match.id);
      anIdToContactId.set(p.anId, match.id);
    } else {
      unmatched.push({ anId: p.anId, email: p.email, name: p.name });
    }
  }

  // Tag matched contacts.
  const { data: existingBase } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', baseCategoryId)
    .eq('team_id', team.id)
    .in('contact_id', matchedIds.length ? matchedIds : [-1]);
  const alreadyTaggedIds = new Set(
    ((existingBase || []) as { contact_id: number }[]).map((a) => a.contact_id)
  );
  const alreadyTagged = matchedIds.filter((id) => alreadyTaggedIds.has(id)).length;
  const pulled = await tagContacts(
    supabase as any,
    team.id,
    baseCategoryId,
    matchedIds.filter((id) => !alreadyTaggedIds.has(id))
  );

  // Create contacts for unmatched Action Network people, then tag them.
  let created = 0;
  if (unmatched.length > 0) {
    const rows = unmatched.map((u) => ({
      name: u.name || u.email,
      email: u.email,
      team_id: team.id,
      user_id: user.id,
    }));
    const { data: inserted, error } = await supabase
      .from('contacts')
      .insert(rows as any)
      .select('id, email');
    if (!error && inserted) {
      created = inserted.length;
      const insertedByEmail = new Map<string, number>();
      for (const row of inserted as { id: number; email: string | null }[]) {
        if (row.email) insertedByEmail.set(row.email.toLowerCase().trim(), row.id);
      }
      for (const u of unmatched) {
        const id = insertedByEmail.get(u.email.toLowerCase().trim());
        if (id) anIdToContactId.set(u.anId, id);
      }
      await tagContacts(
        supabase as any,
        team.id,
        baseCategoryId,
        (inserted as { id: number }[]).map((r) => r.id)
      );
    }
  }

  // Petition signatures -> "Signed: <title>" tags.
  const petitionBreakdown: TagBreakdown[] = [];
  try {
    const petitions = await an.fetchPetitions();
    for (const petition of petitions) {
      const { personIds, capped: sigCapped } = await an.fetchSignaturePersonIds(petition.id);
      if (sigCapped) capped = true;
      const contactIds = personIds
        .map((pid) => anIdToContactId.get(pid))
        .filter((v): v is number => typeof v === 'number');
      if (contactIds.length === 0) continue;
      const catId = await ensureCategory(
        supabase as any, team.id, `${SIGNED_PREFIX}${petition.title}`.slice(0, 255), SIGNED_COLOR
      );
      if (!catId) continue;
      const tagged = await tagContacts(supabase as any, team.id, catId, contactIds);
      petitionBreakdown.push({ label: petition.title, tagged });
    }
  } catch {
    // Petitions are best-effort; a failure here shouldn't sink the people sync.
  }

  // Event attendances -> "Attended: <title>" tags.
  const eventBreakdown: TagBreakdown[] = [];
  try {
    const events = await an.fetchEvents();
    for (const event of events) {
      const { personIds, capped: attCapped } = await an.fetchAttendancePersonIds(event.id);
      if (attCapped) capped = true;
      const contactIds = personIds
        .map((pid) => anIdToContactId.get(pid))
        .filter((v): v is number => typeof v === 'number');
      if (contactIds.length === 0) continue;
      const catId = await ensureCategory(
        supabase as any, team.id, `${ATTENDED_PREFIX}${event.title}`.slice(0, 255), ATTENDED_COLOR
      );
      if (!catId) continue;
      const tagged = await tagContacts(supabase as any, team.id, catId, contactIds);
      eventBreakdown.push({ label: event.title, tagged });
    }
  } catch {
    // Events are best-effort.
  }

  // Contacts tagged "Action Network" whose email isn't in Action Network yet
  // are candidates to push up (mirrors the MailerLite flow — no auto-push).
  const { data: taggedRows } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', baseCategoryId)
    .eq('team_id', team.id);
  const taggedContactIds = new Set(
    ((taggedRows || []) as { contact_id: number }[]).map((r) => r.contact_id)
  );
  const anEmails = new Set(people.map((p) => p.email.toLowerCase().trim()));
  const pendingPush: PendingPush[] = [];
  for (const c of (contacts || [])) {
    if (!taggedContactIds.has(c.id)) continue;
    const email = c.email?.toLowerCase().trim();
    if (!email || anEmails.has(email)) continue;
    pendingPush.push({ id: c.id, name: c.name, email: c.email! });
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');

  return {
    result: {
      peopleCount: people.length,
      pulled,
      alreadyTagged,
      created,
      petitions: petitionBreakdown,
      events: eventBreakdown,
      pendingPush,
      capped,
    },
  };
}

export async function pushToActionNetworkAction(
  contactIds: number[]
): Promise<{ error: string } | { result: ActionNetworkPushResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const apiKey = await resolveActionNetworkKey(team.id);
  if (!apiKey) {
    return { error: 'Action Network is not configured.' };
  }
  const an = createActionNetworkClient(apiKey);

  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone, city, state, zip')
    .eq('team_id', team.id)
    .in('id', contactIds);

  let pushed = 0;
  let pushFailed = 0;
  for (const c of (contacts || [])) {
    if (!c.email) continue;
    const res = await an.upsertPerson(
      {
        email: c.email,
        name: c.name,
        phone: (c as any).phone ?? null,
        city: (c as any).city ?? null,
        state: (c as any).state ?? null,
        zip: (c as any).zip ?? null,
      },
      [BASE_CATEGORY]
    );
    if (res.ok) pushed++;
    else pushFailed++;
  }

  return { result: { pushed, pushFailed } };
}
