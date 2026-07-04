'use server';

import { getUser, getTeamForUser, getContactById, updateContact } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { lookupDistricts } from '@/lib/districts';

export async function lookupContactDistrictsAction(contactId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const contact = await getContactById(contactId, team.id);
  if (!contact) return { error: 'Contact not found' };

  const r = await lookupDistricts({
    street: (contact as any).street,
    city: (contact as any).city,
    state: (contact as any).state,
    zip: (contact as any).zip,
  });
  if (!r.ok) return { error: r.reason };

  const districts_updated_at = new Date().toISOString();
  const updated = await updateContact(contactId, team.id, {
    congressional_district: r.result.congressional_district,
    state_senate_district: r.result.state_senate_district,
    state_assembly_district: r.result.state_assembly_district,
    county: r.result.county,
    districts_updated_at,
  } as any);
  if (!updated) return { error: 'Failed to save districts' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/contacts');
  return { success: true, districts: { ...r.result, districts_updated_at } };
}

export async function bulkLookupDistrictsAction() {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data: contacts } = await (supabase as any)
    .from('contacts')
    .select('id, street, city, state, zip, congressional_district')
    .eq('team_id', team.id)
    .not('street', 'is', null);

  // Only contacts that have a street and haven't been resolved yet.
  const candidates = ((contacts || []) as any[]).filter(
    (c) => c.street?.trim() && !c.congressional_district
  );

  let updated = 0;
  let failed = 0;

  // Process in small concurrent batches to keep wall-clock reasonable without
  // hammering the Census geocoder.
  const BATCH = 5;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (c) => {
        const r = await lookupDistricts(c);
        if (!r.ok) return { id: c.id, ok: false as const };
        const { error } = await (supabase as any)
          .from('contacts')
          .update({
            congressional_district: r.result.congressional_district,
            state_senate_district: r.result.state_senate_district,
            state_assembly_district: r.result.state_assembly_district,
            county: r.result.county,
            districts_updated_at: new Date().toISOString(),
          })
          .eq('id', c.id)
          .eq('team_id', team.id);
        return { id: c.id, ok: !error };
      })
    );
    for (const res of results) res.ok ? updated++ : failed++;
  }

  revalidatePath('/app/contacts');
  revalidatePath('/app/reports');
  return { success: true, updated, failed, total: candidates.length };
}
