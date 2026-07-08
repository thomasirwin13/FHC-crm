'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { isConfigured, fetchAllSubscribers, upsertSubscriber } from '@/lib/mailerlite';

const NEWSLETTER_CATEGORY = 'Newsletter subscriber';

export interface MailerLiteSyncResult {
  pulled: number;
  alreadyTagged: number;
  created: number;
  pushed: number;
  pushFailed: number;
  subscriberCount: number;
}

export async function syncMailerLiteAction(): Promise<{ error: string } | { result: MailerLiteSyncResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (!isConfigured()) {
    return { error: 'MailerLite is not configured. Add MAILERLITE_API_KEY to the environment.' };
  }

  const supabase = await createClient();

  // Find or create the "Newsletter subscriber" category.
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

  // Load all CRM contacts (id + email) for this team.
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id);

  const contactByEmail = new Map<string, { id: number; name: string | null }>();
  for (const c of (contacts || [])) {
    if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), { id: c.id, name: c.name });
  }

  // ---- PULL: MailerLite -> CRM ----
  let subscribers;
  try {
    subscribers = await fetchAllSubscribers();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch MailerLite subscribers' };
  }

  const matchedIds: number[] = [];
  const unmatchedSubs: { email: string; name: string | null }[] = [];
  for (const sub of subscribers) {
    const match = contactByEmail.get(sub.email.toLowerCase().trim());
    if (match) matchedIds.push(match.id);
    else unmatchedSubs.push({ email: sub.email, name: sub.name });
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

  // ---- CREATE: add unmatched subscribers as new CRM contacts ----
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

  // ---- PUSH: CRM -> MailerLite ----
  // Everyone tagged "Newsletter subscriber" in the CRM should exist in MailerLite.
  const { data: taggedRows } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', categoryId)
    .eq('team_id', team.id);

  const taggedContactIds = new Set(((taggedRows || []) as { contact_id: number }[]).map((r) => r.contact_id));
  const subscriberEmails = new Set(subscribers.map((s) => s.email.toLowerCase().trim()));

  let pushed = 0;
  let pushFailed = 0;
  for (const c of (contacts || [])) {
    if (!taggedContactIds.has(c.id)) continue;
    const email = c.email?.toLowerCase().trim();
    if (!email) continue;
    // Skip if already in MailerLite.
    if (subscriberEmails.has(email)) continue;
    const res = await upsertSubscriber(c.email!, c.name);
    if (res.ok) pushed++;
    else pushFailed++;
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');

  return {
    result: {
      pulled,
      alreadyTagged,
      created,
      pushed,
      pushFailed,
      subscriberCount: subscribers.length,
    },
  };
}
