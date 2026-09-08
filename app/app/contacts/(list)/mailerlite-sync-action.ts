'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createMailerLiteClient } from '@/lib/mailerlite';
import { resolveMailerLite } from '@/lib/integrations';
import { namesMatch } from '@/lib/utils/name-matching';

const NEWSLETTER_CATEGORY = 'Newsletter subscriber';

export interface PendingPush {
  id: number;
  name: string | null;
  email: string;
}

export interface MailerLiteSyncResult {
  pulled: number;
  alreadyTagged: number;
  created: number;
  pendingPush: PendingPush[];
  subscriberCount: number;
}

export interface MailerLitePushResult {
  pushed: number;
  pushFailed: number;
}

export interface PreviewSubscriber {
  email: string;
  name: string | null;
  status: 'new' | 'existing' | 'already_synced';
}

export interface MailerLitePreviewResult {
  subscribers: PreviewSubscriber[];
}

async function ensureCategory(supabase: any, teamId: number): Promise<number | null> {
  const { data: existingCats } = await supabase
    .from('contact_categories')
    .select('id')
    .eq('team_id', teamId)
    .ilike('name', NEWSLETTER_CATEGORY);

  if (existingCats && existingCats.length > 0) return existingCats[0].id;

  const { data: newCat, error } = await supabase
    .from('contact_categories')
    .insert({ team_id: teamId, name: NEWSLETTER_CATEGORY, color: 'green' })
    .select('id')
    .single();
  return error ? null : newCat.id;
}

export async function previewMailerLiteAction(): Promise<
  { error: string } | { result: MailerLitePreviewResult }
> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { apiKey, groupId } = await resolveMailerLite(team.id);
  if (!apiKey) {
    return { error: 'MailerLite is not configured. Add your API key in Settings → Integrations.' };
  }
  const ml = createMailerLiteClient(apiKey, groupId);

  const supabase = await createClient();
  const categoryId = await ensureCategory(supabase as any, team.id);
  if (!categoryId) return { error: 'Failed to resolve Newsletter subscriber category' };

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id);

  const contactByEmail = new Map<string, number>();
  const contactsList = (contacts || []) as any[];
  for (const c of contactsList) {
    if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
  }

  let subscribers;
  try {
    subscribers = await ml.fetchAllSubscribers();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch MailerLite subscribers' };
  }

  const matchedIds = subscribers
    .map((s) => {
      const byEmail = contactByEmail.get(s.email.toLowerCase().trim());
      if (byEmail !== undefined) return byEmail;
      // Fall back to nickname-aware name matching
      if (s.name) {
        const byName = contactsList.find((c: any) => c.name && namesMatch(c.name, s.name!));
        if (byName) return byName.id as number;
      }
      return undefined;
    })
    .filter((id): id is number => id !== undefined);

  let alreadyTaggedIds = new Set<number>();
  if (matchedIds.length > 0) {
    const { data: existingAssignments } = await (supabase as any)
      .from('contact_category_assignments')
      .select('contact_id')
      .eq('category_id', categoryId)
      .eq('team_id', team.id)
      .in('contact_id', matchedIds);
    alreadyTaggedIds = new Set(
      ((existingAssignments || []) as { contact_id: number }[]).map((a) => a.contact_id)
    );
  }

  const previewSubs: PreviewSubscriber[] = subscribers.map((s) => {
    let contactId = contactByEmail.get(s.email.toLowerCase().trim());
    if (contactId === undefined && s.name) {
      const byName = contactsList.find((c: any) => c.name && namesMatch(c.name, s.name!));
      if (byName) contactId = byName.id;
    }
    let status: PreviewSubscriber['status'];
    if (contactId === undefined) {
      status = 'new';
    } else if (alreadyTaggedIds.has(contactId)) {
      status = 'already_synced';
    } else {
      status = 'existing';
    }
    return { email: s.email, name: s.name, status };
  });

  return { result: { subscribers: previewSubs } };
}

export async function syncMailerLiteAction(
  selectedEmails?: string[],
  manualMatches?: Record<string, number>,
): Promise<{ error: string } | { result: MailerLiteSyncResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { apiKey, groupId } = await resolveMailerLite(team.id);
  if (!apiKey) {
    return { error: 'MailerLite is not configured. Add your API key in Settings → Integrations.' };
  }
  const ml = createMailerLiteClient(apiKey, groupId);

  const supabase = await createClient();
  const categoryId = await ensureCategory(supabase as any, team.id);
  if (!categoryId) return { error: 'Failed to create Newsletter subscriber category' };

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id);

  const syncContactByEmail = new Map<string, { id: number; name: string | null }>();
  const syncContactsList = (contacts || []) as any[];
  for (const c of syncContactsList) {
    if (c.email) syncContactByEmail.set(c.email.toLowerCase().trim(), { id: c.id, name: c.name });
  }

  let subscribers;
  try {
    subscribers = await ml.fetchAllSubscribers();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch MailerLite subscribers' };
  }

  // Filter to selected contacts if provided
  if (selectedEmails) {
    const selectedSet = new Set(selectedEmails.map((e) => e.toLowerCase().trim()));
    subscribers = subscribers.filter((s) => selectedSet.has(s.email.toLowerCase().trim()));
  }

  const matchedIds: number[] = [];
  const unmatchedSubs: { email: string; name: string | null }[] = [];
  for (const sub of subscribers) {
    const match = syncContactByEmail.get(sub.email.toLowerCase().trim());
    if (match) {
      matchedIds.push(match.id);
    } else if (sub.name) {
      // Fall back to nickname-aware name matching
      const byName = syncContactsList.find((c: any) => c.name && namesMatch(c.name, sub.name!));
      if (byName) matchedIds.push(byName.id);
      else {
        // Check manual matches
        const manualId = manualMatches?.[sub.email.toLowerCase().trim()];
        if (manualId) matchedIds.push(manualId);
        else unmatchedSubs.push({ email: sub.email, name: sub.name });
      }
    } else {
      // Check manual matches
      const manualId = manualMatches?.[sub.email.toLowerCase().trim()];
      if (manualId) matchedIds.push(manualId);
      else unmatchedSubs.push({ email: sub.email, name: sub.name });
    }
  }

  let pulled = 0;
  let alreadyTagged = 0;
  if (matchedIds.length > 0) {
    const { data: existingAssignments } = await (supabase as any)
      .from('contact_category_assignments')
      .select('contact_id')
      .eq('category_id', categoryId)
      .eq('team_id', team.id)
      .in('contact_id', matchedIds);

    const alreadyTaggedIds = new Set(
      ((existingAssignments || []) as { contact_id: number }[]).map((a) => a.contact_id)
    );
    alreadyTagged = alreadyTaggedIds.size;
    const newIds = matchedIds.filter((id) => !alreadyTaggedIds.has(id));

    if (newIds.length > 0) {
      const rows = newIds.map((id) => ({ contact_id: id, category_id: categoryId, team_id: team.id }));
      const { error: insertErr } = await (supabase as any)
        .from('contact_category_assignments')
        .upsert(rows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
      if (insertErr) return { error: insertErr.message };
      pulled = newIds.length;
    }
  }

  let created = 0;
  if (unmatchedSubs.length > 0) {
    const rows = unmatchedSubs.map((s) => ({
      name: s.name || s.email,
      email: s.email,
      team_id: team.id,
      user_id: user.id,
    }));
    const { data: inserted, error: insertContactErr } = await supabase
      .from('contacts')
      .insert(rows as any)
      .select('id');
    if (!insertContactErr && inserted) {
      created = inserted.length;
      const tagRows = inserted.map((c: any) => ({
        contact_id: c.id,
        category_id: categoryId,
        team_id: team.id,
      }));
      await (supabase as any)
        .from('contact_category_assignments')
        .upsert(tagRows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
    }
  }

  // Identify contacts that would need to be pushed (don't push yet)
  const { data: taggedRows } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', categoryId)
    .eq('team_id', team.id);

  const taggedContactIds = new Set(((taggedRows || []) as { contact_id: number }[]).map((r) => r.contact_id));
  const subscriberEmails = new Set(subscribers.map((s) => s.email.toLowerCase().trim()));

  const pendingPush: PendingPush[] = [];
  for (const c of (contacts || [])) {
    if (!taggedContactIds.has(c.id)) continue;
    const email = c.email?.toLowerCase().trim();
    if (!email) continue;
    if (subscriberEmails.has(email)) continue;
    pendingPush.push({ id: c.id, name: c.name, email: c.email! });
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');

  return {
    result: {
      pulled,
      alreadyTagged,
      created,
      pendingPush,
      subscriberCount: subscribers.length,
    },
  };
}

export async function pushToMailerLiteAction(
  contactIds: number[]
): Promise<{ error: string } | { result: MailerLitePushResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { apiKey, groupId } = await resolveMailerLite(team.id);
  if (!apiKey) {
    return { error: 'MailerLite is not configured.' };
  }
  const ml = createMailerLiteClient(apiKey, groupId);

  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id)
    .in('id', contactIds);

  let pushed = 0;
  let pushFailed = 0;
  for (const c of (contacts || [])) {
    if (!c.email) continue;
    const res = await ml.upsertSubscriber(c.email, c.name);
    if (res.ok) pushed++;
    else pushFailed++;
  }

  return { result: { pushed, pushFailed } };
}
