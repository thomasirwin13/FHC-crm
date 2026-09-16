'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createActionNetworkClient, type ANActionResource, type ANActionMembers, type ANPerson } from '@/lib/action-network';
import { resolveActionNetworkKey } from '@/lib/integrations';
import { buildContactMatcher } from '@/lib/utils/name-matching';

// Cap how many actions per type we resolve members for, so a single pull stays
// within serverless time limits. Surfaced via `capped` when exceeded.
const MAX_ACTIONS_PER_TYPE = 30;
// Cap detailed participant rows returned per action (count stays exact).
const MAX_PARTICIPANTS_DETAIL = 500;
// How many member-collection fetches to run at once (AN is ~4 req/s).
const CONCURRENCY = 3;

// Events are intentionally excluded here — they sync through the Meetings tab.
export type ANActionType = 'petition' | 'form' | 'advocacy_campaign';

export interface ANParticipant {
  anId: string;
  name: string | null;
  email: string | null;
  contactId: number | null;
}

export interface ANActionParticipation {
  type: ANActionType;
  typeLabel: string;
  id: string;
  title: string;
  date: string | null;
  total: number; // unique participants (exact, even if detail is capped)
  matched: number; // how many resolved participants are existing CRM contacts
  resolved: number; // how many participants we could resolve to a person
  participants: ANParticipant[]; // capped to MAX_PARTICIPANTS_DETAIL
}

export interface DismissedAction {
  id: string;
  type: ANActionType;
  title: string;
}

export interface ANParticipationTotals {
  actions: number;
  participations: number; // sum of participants across actions
  uniquePeople: number; // distinct people across all actions
  matched: number; // distinct people matched to CRM contacts
}

export interface ANParticipationResult {
  actions: ANActionParticipation[];
  totals: ANParticipationTotals;
  dismissed: DismissedAction[];
  capped: boolean;
  syncedAt: string | null; // ISO timestamp of the last sync, if any
}

// What we persist between visits (kept small-ish; participant detail is capped).
interface SavedSnapshot {
  actions: ANActionParticipation[];
  totals: ANParticipationTotals;
  capped: boolean;
}

export interface ANImportResult {
  contactsCreated: number;
  participantsTagged: number;
  actions: { title: string; created: number; tagged: number; error?: boolean }[];
}

const TYPE_LABELS: Record<ANActionType, string> = {
  petition: 'Petition',
  form: 'Form / letter',
  advocacy_campaign: 'Letter / email',
};

// Category naming used when importing an action's participants into the CRM.
// Petitions reuse the "Signed: " convention from the contact sync so tags merge.
const IMPORT_CATEGORY: Record<ANActionType, { prefix: string; color: string }> = {
  petition: { prefix: 'Signed: ', color: 'purple' },
  form: { prefix: 'Submitted: ', color: 'blue' },
  advocacy_campaign: { prefix: 'Contacted official: ', color: 'orange' },
};

// Run async tasks with a bounded concurrency pool.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---- Dismissed-action persistence (stored on team_integrations.config) ----

async function readDismissed(supabase: any, teamId: number): Promise<DismissedAction[]> {
  const { data } = await supabase
    .from('team_integrations')
    .select('config')
    .eq('team_id', teamId)
    .eq('provider', 'action_network')
    .maybeSingle();
  const list = data?.config?.dismissed_actions;
  return Array.isArray(list) ? (list as DismissedAction[]) : [];
}

async function writeDismissed(supabase: any, teamId: number, list: DismissedAction[]): Promise<void> {
  const { data: existing } = await supabase
    .from('team_integrations')
    .select('id, config')
    .eq('team_id', teamId)
    .eq('provider', 'action_network')
    .maybeSingle();
  if (existing) {
    const config = { ...(existing.config || {}), dismissed_actions: list };
    await supabase
      .from('team_integrations')
      .update({ config, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('team_integrations')
      .insert({ team_id: teamId, provider: 'action_network', config: { dismissed_actions: list } });
  }
}

// ---- Snapshot persistence (stored on a dedicated team_integrations row) ----
// Kept under its own provider so credential resolvers (which query by a specific
// provider) never pull this larger blob.
const PARTICIPATION_PROVIDER = 'action_network_participation';

async function readSnapshot(
  supabase: any,
  teamId: number,
): Promise<{ snapshot: SavedSnapshot | null; syncedAt: string | null }> {
  const { data } = await supabase
    .from('team_integrations')
    .select('config')
    .eq('team_id', teamId)
    .eq('provider', PARTICIPATION_PROVIDER)
    .maybeSingle();
  const snapshot = (data?.config?.snapshot ?? null) as SavedSnapshot | null;
  const syncedAt = (data?.config?.synced_at ?? null) as string | null;
  return { snapshot, syncedAt };
}

async function writeSnapshot(supabase: any, teamId: number, snapshot: SavedSnapshot): Promise<string> {
  const syncedAt = new Date().toISOString();
  const config = { snapshot, synced_at: syncedAt };
  const { data: existing } = await supabase
    .from('team_integrations')
    .select('id')
    .eq('team_id', teamId)
    .eq('provider', PARTICIPATION_PROVIDER)
    .maybeSingle();
  if (existing) {
    await supabase
      .from('team_integrations')
      .update({ config, updated_at: syncedAt })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('team_integrations')
      .insert({ team_id: teamId, provider: PARTICIPATION_PROVIDER, config });
  }
  return syncedAt;
}

// ---- Category helpers (mirror the contact Action Network sync) ----

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

async function tagContacts(
  supabase: any,
  teamId: number,
  categoryId: number,
  contactIds: number[],
): Promise<number> {
  if (contactIds.length === 0) return 0;
  const rows = contactIds.map((id) => ({ contact_id: id, category_id: categoryId, team_id: teamId }));
  const { error } = await supabase
    .from('contact_category_assignments')
    .upsert(rows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
  return error ? 0 : contactIds.length;
}

function membersFetcher(an: ReturnType<typeof createActionNetworkClient>, type: ANActionType) {
  return (id: string): Promise<ANActionMembers> => {
    if (type === 'petition') return an.fetchSignaturePersonIds(id);
    if (type === 'form') return an.fetchSubmissionPersonIds(id);
    return an.fetchOutreachPersonIds(id);
  };
}

/**
 * Read the last saved participation snapshot for the team (fast, no external
 * calls). Returns null if nothing has been synced yet. Dismissed actions are
 * filtered out so hiding takes effect without a re-sync.
 */
export async function getSavedParticipationAction(): Promise<
  { error: string } | { result: ANParticipationResult | null }
> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const [{ snapshot, syncedAt }, dismissed] = await Promise.all([
    readSnapshot(supabase as any, team.id),
    readDismissed(supabase as any, team.id),
  ]);
  if (!snapshot) return { result: null };

  const dismissedIds = new Set(dismissed.map((d) => d.id));
  const actions = (snapshot.actions || []).filter((a) => !dismissedIds.has(a.id));
  const participations = actions.reduce((sum, a) => sum + a.total, 0);

  return {
    result: {
      actions,
      totals: {
        actions: actions.length,
        participations,
        // Distinct-people figures reflect the last full sync.
        uniquePeople: snapshot.totals?.uniquePeople ?? 0,
        matched: snapshot.totals?.matched ?? 0,
      },
      dismissed,
      capped: snapshot.capped ?? false,
      syncedAt,
    },
  };
}

/**
 * Pull participation across Action Network action types (petitions, forms, and
 * letter/email advocacy campaigns) and report how many people — and exactly who
 * — participated in each, matched against CRM contacts. Dismissed actions are
 * skipped. Events are excluded (they sync through the Meetings tab). The result
 * is saved so it persists across page loads and updates over time on each sync.
 */
export async function syncActionNetworkParticipationAction(): Promise<
  { error: string } | { result: ANParticipationResult }
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
  const dismissed = await readDismissed(supabase as any, team.id);
  const dismissedIds = new Set(dismissed.map((d) => d.id));

  // Bulk people list (keyed by AN person id) + action lists, in parallel.
  let peopleResult;
  let petitions: ANActionResource[] = [];
  let forms: ANActionResource[] = [];
  let campaigns: ANActionResource[] = [];
  try {
    [peopleResult, petitions, forms, campaigns] = await Promise.all([
      an.fetchAllPeople(),
      an.fetchPetitions().catch(() => []),
      an.fetchForms().catch(() => []),
      an.fetchAdvocacyCampaigns().catch(() => []),
    ]);
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch from Action Network' };
  }

  const peopleByAnId = new Map(peopleResult.people.map((p) => [p.anId, p]));
  let capped = peopleResult.capped;

  // Load CRM contacts for matching.
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone')
    .eq('team_id', team.id);
  const matcher = buildContactMatcher(
    ((contacts || []) as { id: number; name: string | null; email: string | null; phone: string | null }[])
  );

  // Build the work list: each (non-dismissed) action + how to fetch its members.
  type Job = { type: ANActionType; resource: ANActionResource; fetchMembers: () => Promise<ANActionMembers> };
  const jobs: Job[] = [];

  const addJobs = (type: ANActionType, list: ANActionResource[]) => {
    const kept = list.filter((r) => !dismissedIds.has(r.id));
    if (kept.length > MAX_ACTIONS_PER_TYPE) capped = true;
    const fetchMembers = membersFetcher(an, type);
    for (const resource of kept.slice(0, MAX_ACTIONS_PER_TYPE)) {
      jobs.push({ type, resource, fetchMembers: () => fetchMembers(resource.id) });
    }
  };

  addJobs('petition', petitions);
  addJobs('form', forms);
  addJobs('advocacy_campaign', campaigns);

  const uniquePeople = new Set<string>();
  const matchedPeople = new Set<string>();

  const actions = await pool(jobs, CONCURRENCY, async (job): Promise<ANActionParticipation | null> => {
    let members: ANActionMembers;
    try {
      members = await job.fetchMembers();
    } catch {
      return {
        type: job.type,
        typeLabel: TYPE_LABELS[job.type],
        id: job.resource.id,
        title: job.resource.title,
        date: job.resource.startDate ? job.resource.startDate.slice(0, 10) : null,
        total: 0,
        matched: 0,
        resolved: 0,
        participants: [],
      };
    }
    if (members.capped) capped = true;

    const uniqueIds = Array.from(new Set(members.personIds));
    const participants: ANParticipant[] = [];
    let matched = 0;
    let resolved = 0;

    for (const anId of uniqueIds) {
      uniquePeople.add(anId);
      const person = peopleByAnId.get(anId);
      if (!person) continue;
      resolved++;
      const match = matcher.findMatch({ email: person.email, phone: person.phone, name: person.name });
      if (match) {
        matched++;
        matchedPeople.add(anId);
      }
      if (participants.length < MAX_PARTICIPANTS_DETAIL) {
        participants.push({
          anId: person.anId,
          name: person.name,
          email: person.email,
          contactId: match ? match.id : null,
        });
      }
    }

    participants.sort((a, b) => {
      const am = a.contactId ? 0 : 1;
      const bm = b.contactId ? 0 : 1;
      if (am !== bm) return am - bm;
      return (a.name || a.email || '').localeCompare(b.name || b.email || '');
    });

    return {
      type: job.type,
      typeLabel: TYPE_LABELS[job.type],
      id: job.resource.id,
      title: job.resource.title,
      date: job.resource.startDate ? job.resource.startDate.slice(0, 10) : null,
      total: uniqueIds.length,
      matched,
      resolved,
      participants,
    };
  });

  const cleanActions = (actions.filter(Boolean) as ANActionParticipation[])
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  const participations = cleanActions.reduce((sum, a) => sum + a.total, 0);

  const totals: ANParticipationTotals = {
    actions: cleanActions.length,
    participations,
    uniquePeople: uniquePeople.size,
    matched: matchedPeople.size,
  };

  // Persist so the tracker survives refreshes and updates over time.
  const syncedAt = await writeSnapshot(supabase as any, team.id, {
    actions: cleanActions,
    totals,
    capped,
  });

  revalidatePath('/app/legislative');

  return {
    result: {
      actions: cleanActions,
      totals,
      dismissed,
      capped,
      syncedAt,
    },
  };
}

/** Hide an action from the participation tracker (persisted per team). */
export async function dismissActionNetworkActionAction(
  action: DismissedAction
): Promise<{ error: string } | { success: true }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const current = await readDismissed(supabase as any, team.id);
  if (!current.some((d) => d.id === action.id)) {
    current.push({ id: action.id, type: action.type, title: action.title });
    await writeDismissed(supabase as any, team.id, current);
  }
  revalidatePath('/app/legislative');
  return { success: true };
}

/** Restore a previously dismissed action. */
export async function restoreActionNetworkActionAction(
  id: string
): Promise<{ error: string } | { success: true }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const current = await readDismissed(supabase as any, team.id);
  const next = current.filter((d) => d.id !== id);
  if (next.length !== current.length) {
    await writeDismissed(supabase as any, team.id, next);
  }
  revalidatePath('/app/legislative');
  return { success: true };
}

/**
 * Import the participants of the selected actions into the CRM: create contacts
 * for anyone not already present, and tag every participant with a per-action
 * category so you can find who took each action later.
 */
export async function importActionNetworkActionsAction(
  selected: { id: string; type: ANActionType; title: string }[]
): Promise<{ error: string } | { result: ANImportResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (!selected || selected.length === 0) return { error: 'No actions selected' };

  const apiKey = await resolveActionNetworkKey(team.id);
  if (!apiKey) return { error: 'Action Network is not configured.' };
  const an = createActionNetworkClient(apiKey);

  let peopleResult;
  try {
    peopleResult = await an.fetchAllPeople();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch Action Network people' };
  }
  const peopleByAnId = new Map(peopleResult.people.map((p) => [p.anId, p]));

  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone')
    .eq('team_id', team.id);
  const matcher = buildContactMatcher(
    ((contacts || []) as { id: number; name: string | null; email: string | null; phone: string | null }[])
  );

  // Track contacts created this run so the same person across multiple actions
  // is only created once.
  const createdByEmail = new Map<string, number>();
  let contactsCreated = 0;
  let participantsTagged = 0;
  const perAction: ANImportResult['actions'] = [];

  for (const sel of selected) {
    let members: ANActionMembers;
    try {
      members = await membersFetcher(an, sel.type)(sel.id);
    } catch {
      perAction.push({ title: sel.title, created: 0, tagged: 0, error: true });
      continue;
    }

    const uniqueIds = Array.from(new Set(members.personIds));
    const contactIdsForAction: number[] = [];
    const toCreate: ANPerson[] = [];

    for (const anId of uniqueIds) {
      const person = peopleByAnId.get(anId);
      if (!person) continue;
      const match = matcher.findMatch({ email: person.email, phone: person.phone, name: person.name });
      if (match) {
        contactIdsForAction.push(match.id);
        continue;
      }
      const emailKey = (person.email || '').toLowerCase().trim();
      if (emailKey && createdByEmail.has(emailKey)) {
        contactIdsForAction.push(createdByEmail.get(emailKey)!);
        continue;
      }
      toCreate.push(person);
    }

    if (toCreate.length > 0) {
      const rows = toCreate.map((p) => ({
        name: p.name || p.email || 'Unknown',
        email: p.email || null,
        phone: p.phone || null,
        street: p.street || null,
        city: p.city || null,
        state: p.state || null,
        zip: p.zip || null,
        team_id: team.id,
        user_id: user.id,
      }));
      const { data: inserted } = await supabase
        .from('contacts')
        .insert(rows as any)
        .select('id, email');
      if (inserted) {
        contactsCreated += inserted.length;
        for (const r of inserted as { id: number; email: string | null }[]) {
          if (r.email) createdByEmail.set(r.email.toLowerCase().trim(), r.id);
          contactIdsForAction.push(r.id);
        }
      }
    }

    const catName = `${IMPORT_CATEGORY[sel.type].prefix}${sel.title}`.slice(0, 255);
    const catId = await ensureCategory(supabase as any, team.id, catName, IMPORT_CATEGORY[sel.type].color);
    let tagged = 0;
    if (catId && contactIdsForAction.length > 0) {
      tagged = await tagContacts(supabase as any, team.id, catId, contactIdsForAction);
    }
    participantsTagged += tagged;
    perAction.push({ title: sel.title, created: toCreate.length, tagged });
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');
  revalidatePath('/app/legislative');

  return { result: { contactsCreated, participantsTagged, actions: perAction } };
}
