'use server';

import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createActionNetworkClient, type ANActionResource, type ANActionMembers } from '@/lib/action-network';
import { resolveActionNetworkKey } from '@/lib/integrations';
import { buildContactMatcher } from '@/lib/utils/name-matching';

// Cap how many actions per type we resolve members for, so a single pull stays
// within serverless time limits. Surfaced via `capped` when exceeded.
const MAX_ACTIONS_PER_TYPE = 30;
// Cap detailed participant rows returned per action (count stays exact).
const MAX_PARTICIPANTS_DETAIL = 500;
// How many member-collection fetches to run at once (AN is ~4 req/s).
const CONCURRENCY = 3;

export type ANActionType = 'petition' | 'form' | 'advocacy_campaign' | 'event';

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

export interface ANParticipationResult {
  actions: ANActionParticipation[];
  totals: {
    actions: number;
    participations: number; // sum of participants across actions
    uniquePeople: number; // distinct people across all actions
    matched: number; // distinct people matched to CRM contacts
  };
  capped: boolean;
}

const TYPE_LABELS: Record<ANActionType, string> = {
  petition: 'Petition',
  form: 'Form / letter',
  advocacy_campaign: 'Letter / email',
  event: 'Event',
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

/**
 * Pull participation across Action Network action types (petitions, forms,
 * advocacy campaigns for letters/emails, and events) and report how many people
 * — and exactly who — participated in each, matched against CRM contacts.
 */
export async function getActionNetworkParticipationAction(): Promise<
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

  // Bulk people list (keyed by AN person id) + action lists, in parallel.
  let peopleResult;
  let petitions: ANActionResource[] = [];
  let forms: ANActionResource[] = [];
  let campaigns: ANActionResource[] = [];
  let events: ANActionResource[] = [];
  try {
    [peopleResult, petitions, forms, campaigns, events] = await Promise.all([
      an.fetchAllPeople(),
      an.fetchPetitions().catch(() => []),
      an.fetchForms().catch(() => []),
      an.fetchAdvocacyCampaigns().catch(() => []),
      an.fetchEvents().catch(() => []),
    ]);
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch from Action Network' };
  }

  const peopleByAnId = new Map(peopleResult.people.map((p) => [p.anId, p]));
  let capped = peopleResult.capped;

  // Load CRM contacts for matching.
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, phone')
    .eq('team_id', team.id);
  const matcher = buildContactMatcher(
    ((contacts || []) as { id: number; name: string | null; email: string | null; phone: string | null }[])
  );

  // Build the work list: each action + how to fetch its members.
  type Job = { type: ANActionType; resource: ANActionResource; fetchMembers: () => Promise<ANActionMembers> };
  const jobs: Job[] = [];

  const addJobs = (
    type: ANActionType,
    list: ANActionResource[],
    fetchMembers: (id: string) => Promise<ANActionMembers>
  ) => {
    if (list.length > MAX_ACTIONS_PER_TYPE) capped = true;
    for (const resource of list.slice(0, MAX_ACTIONS_PER_TYPE)) {
      jobs.push({ type, resource, fetchMembers: () => fetchMembers(resource.id) });
    }
  };

  addJobs('petition', petitions, (id) => an.fetchSignaturePersonIds(id));
  addJobs('form', forms, (id) => an.fetchSubmissionPersonIds(id));
  addJobs('advocacy_campaign', campaigns, (id) => an.fetchOutreachPersonIds(id));
  addJobs('event', events, (id) => an.fetchAttendancePersonIds(id));

  const uniquePeople = new Set<string>();
  const matchedPeople = new Set<string>();

  const actions = await pool(jobs, CONCURRENCY, async (job): Promise<ANActionParticipation | null> => {
    let members: ANActionMembers;
    try {
      members = await job.fetchMembers();
    } catch {
      // A single action failing shouldn't sink the whole pull.
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
      if (!person) continue; // person not in the (possibly capped) people list
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

    // Matched first, then alphabetical.
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
    // Drop empty actions (no participants) to keep the tracker focused.
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  const participations = cleanActions.reduce((sum, a) => sum + a.total, 0);

  return {
    result: {
      actions: cleanActions,
      totals: {
        actions: cleanActions.length,
        participations,
        uniquePeople: uniquePeople.size,
        matched: matchedPeople.size,
      },
      capped,
    },
  };
}
