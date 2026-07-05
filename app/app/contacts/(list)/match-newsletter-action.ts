'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';

export async function matchNewsletterSubscribersAction(emails: string[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();

  // 1. Find or create the "Newsletter subscriber" category
  const { data: existingCats } = await (supabase as any)
    .from('contact_categories')
    .select('id, name')
    .eq('team_id', team.id)
    .ilike('name', 'Newsletter subscriber');

  let categoryId: number;
  if (existingCats && existingCats.length > 0) {
    categoryId = existingCats[0].id;
  } else {
    const { data: newCat, error: catErr } = await (supabase as any)
      .from('contact_categories')
      .insert({ team_id: team.id, name: 'Newsletter subscriber', color: 'green' })
      .select('id')
      .single();
    if (catErr || !newCat) return { error: 'Failed to create category' };
    categoryId = newCat.id;
  }

  // 2. Find contacts matching the provided emails
  const normalizedEmails = emails.map((e) => e.toLowerCase().trim()).filter(Boolean);
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('team_id', team.id);

  const matchedIds: number[] = [];
  const unmatchedEmails: string[] = [];
  const emailSet = new Set(normalizedEmails);

  const contactByEmail = new Map<string, number>();
  for (const c of (contacts || [])) {
    if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
  }

  for (const email of normalizedEmails) {
    const contactId = contactByEmail.get(email);
    if (contactId) {
      matchedIds.push(contactId);
    } else {
      unmatchedEmails.push(email);
    }
  }

  if (matchedIds.length === 0) {
    return { matched: 0, alreadyTagged: 0, unmatched: unmatchedEmails };
  }

  // 3. Check which are already tagged
  const { data: existingAssignments } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', categoryId)
    .eq('team_id', team.id)
    .in('contact_id', matchedIds);

  const alreadyTaggedIds = new Set(
    ((existingAssignments || []) as { contact_id: number }[]).map((a) => a.contact_id)
  );
  const newIds = matchedIds.filter((id) => !alreadyTaggedIds.has(id));

  // 4. Tag the new ones
  if (newIds.length > 0) {
    const rows = newIds.map((id) => ({
      contact_id: id,
      category_id: categoryId,
      team_id: team.id,
    }));
    const { error: insertErr } = await (supabase as any)
      .from('contact_category_assignments')
      .upsert(rows, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
    if (insertErr) return { error: insertErr.message };
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');

  return {
    matched: newIds.length,
    alreadyTagged: alreadyTaggedIds.size,
    unmatched: unmatchedEmails,
  };
}
