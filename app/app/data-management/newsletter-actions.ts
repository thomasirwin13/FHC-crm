'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createMailerLiteClient } from '@/lib/mailerlite';
import { resolveMailerLite } from '@/lib/integrations';

const NEWSLETTER_CATEGORY = 'Newsletter subscriber';

export interface UnsyncedContact {
  id: number;
  name: string | null;
  email: string;
}

export interface FindUnsyncedResult {
  contacts: UnsyncedContact[];
  subscriberCount: number;
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

/**
 * Find CRM contacts that have an email address but are NOT yet on the MailerLite
 * mailing list. These are candidates to be pushed to the newsletter.
 */
export async function findUnsyncedNewsletterContactsAction(): Promise<
  { error: string } | { result: FindUnsyncedResult }
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

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id)
    .order('name');

  let subscribers;
  try {
    subscribers = await ml.fetchAllSubscribers();
  } catch (e: any) {
    return { error: e?.message || 'Failed to fetch MailerLite subscribers' };
  }

  const subscriberEmails = new Set(
    subscribers.map((s) => s.email.toLowerCase().trim())
  );

  const unsynced: UnsyncedContact[] = [];
  for (const c of (contacts || []) as any[]) {
    const email = c.email?.toLowerCase().trim();
    if (!email) continue; // must have an email
    if (subscriberEmails.has(email)) continue; // already on the list
    unsynced.push({ id: c.id, name: c.name, email: c.email });
  }

  return {
    result: {
      contacts: unsynced,
      subscriberCount: subscribers.length,
    },
  };
}

export interface PushNewsletterResult {
  pushed: number;
  failed: number;
  failedIds: number[];
}

/**
 * Push one or more CRM contacts to the MailerLite mailing list and tag each of
 * them with the "Newsletter subscriber" category. Used for the person-by-person
 * (or bulk) newsletter push workflow.
 */
export async function pushContactsToNewsletterAction(
  contactIds: number[]
): Promise<{ error: string } | { result: PushNewsletterResult }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (contactIds.length === 0) return { error: 'No contacts selected' };

  const { apiKey, groupId } = await resolveMailerLite(team.id);
  if (!apiKey) {
    return { error: 'MailerLite is not configured.' };
  }
  const ml = createMailerLiteClient(apiKey, groupId);

  const supabase = await createClient();
  const categoryId = await ensureCategory(supabase as any, team.id);
  if (!categoryId) return { error: 'Failed to resolve Newsletter subscriber category' };

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('team_id', team.id)
    .in('id', contactIds);

  let pushed = 0;
  let failed = 0;
  const failedIds: number[] = [];
  const pushedIds: number[] = [];

  for (const c of (contacts || []) as any[]) {
    if (!c.email) {
      failed++;
      failedIds.push(c.id);
      continue;
    }
    const res = await ml.upsertSubscriber(c.email, c.name);
    if (res.ok) {
      pushed++;
      pushedIds.push(c.id);
    } else {
      failed++;
      failedIds.push(c.id);
    }
  }

  // Tag every successfully pushed contact as "Newsletter subscriber"
  if (pushedIds.length > 0) {
    const tagRows = pushedIds.map((id) => ({
      contact_id: id,
      category_id: categoryId,
      team_id: team.id,
    }));
    await (supabase as any)
      .from('contact_category_assignments')
      .upsert(tagRows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');
  revalidatePath('/app/data-management');

  return { result: { pushed, failed, failedIds } };
}
