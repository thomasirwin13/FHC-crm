'use server';

import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { revalidatePath } from 'next/cache';
import { parseAddress, type AddressCleanupRow, type AddressCleanupResult } from './address-parser';

export async function scanAddressesAction(): Promise<
  { error: string } | { result: AddressCleanupResult }
> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();
  const { data: orgs, error } = await (supabase as any)
    .from('organizations')
    .select('id, name, street, city, state, zip')
    .eq('team_id', team.id)
    .not('street', 'is', null);

  if (error) return { error: error.message };

  const rows: AddressCleanupRow[] = [];

  for (const org of orgs || []) {
    if (!org.street) continue;
    const parsed = parseAddress(org.street);
    if (!parsed) continue;
    if (!parsed.city && !parsed.state && !parsed.zip) continue;

    rows.push({
      id: org.id,
      name: org.name,
      original: org.street,
      parsed,
      existingCity: org.city || null,
      existingState: org.state || null,
      existingZip: org.zip || null,
    });
  }

  return { result: { rows } };
}

export async function applyAddressCleanupAction(
  ids: number[]
): Promise<{ error: string } | { updated: number }> {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  if (ids.length === 0) return { error: 'No organizations selected' };

  const supabase = await createClient();

  const { data: orgs, error } = await (supabase as any)
    .from('organizations')
    .select('id, street, city, state, zip')
    .eq('team_id', team.id)
    .in('id', ids);

  if (error) return { error: error.message };

  let updated = 0;
  for (const org of orgs || []) {
    if (!org.street) continue;
    const parsed = parseAddress(org.street);
    if (!parsed) continue;

    const updates: Record<string, any> = {
      street: parsed.street,
      updated_at: new Date().toISOString(),
    };
    if (parsed.city && !org.city) updates.city = parsed.city;
    if (parsed.state && !org.state) updates.state = parsed.state;
    if (parsed.zip && !org.zip) updates.zip = parsed.zip;

    const { error: updateErr } = await (supabase as any)
      .from('organizations')
      .update(updates)
      .eq('id', org.id)
      .eq('team_id', team.id);

    if (!updateErr) updated++;
  }

  revalidatePath('/app/organizations');
  return { updated };
}
