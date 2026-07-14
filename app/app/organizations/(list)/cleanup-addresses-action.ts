'use server';

import { createClient } from '@/lib/supabase/server';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { revalidatePath } from 'next/cache';

const US_STATES: Record<string, string> = {
  AL: 'AL', AK: 'AK', AZ: 'AZ', AR: 'AR', CA: 'CA', CO: 'CO', CT: 'CT',
  DE: 'DE', FL: 'FL', GA: 'GA', HI: 'HI', ID: 'ID', IL: 'IL', IN: 'IN',
  IA: 'IA', KS: 'KS', KY: 'KY', LA: 'LA', ME: 'ME', MD: 'MD', MA: 'MA',
  MI: 'MI', MN: 'MN', MS: 'MS', MO: 'MO', MT: 'MT', NE: 'NE', NV: 'NV',
  NH: 'NH', NJ: 'NJ', NM: 'NM', NY: 'NY', NC: 'NC', ND: 'ND', OH: 'OH',
  OK: 'OK', OR: 'OR', PA: 'PA', RI: 'RI', SC: 'SC', SD: 'SD', TN: 'TN',
  TX: 'TX', UT: 'UT', VT: 'VT', VA: 'VA', WA: 'WA', WV: 'WV', WI: 'WI',
  WY: 'WY', DC: 'DC',
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR',
  CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
  FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL',
  INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
  MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI',
  MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT',
  NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR',
  PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT',
  VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC',
};

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface AddressCleanupRow {
  id: number;
  name: string;
  original: string;
  parsed: ParsedAddress;
  existingCity: string | null;
  existingState: string | null;
  existingZip: string | null;
}

export interface AddressCleanupResult {
  rows: AddressCleanupRow[];
}

export function parseAddress(raw: string): ParsedAddress | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try: "Street, City, ST ZIP" or "Street, City, ST"
  // Also handles: "Street, City, State ZIP" with full state names
  const match = trimmed.match(
    /^(.+?),\s*(.+?),\s*([A-Za-z. ]+?)\s+(\d{5}(?:-\d{4})?)$/
  );
  if (match) {
    const stateKey = match[3].trim().toUpperCase().replace(/\./g, '');
    const stateAbbr = US_STATES[stateKey];
    if (stateAbbr) {
      return {
        street: match[1].trim(),
        city: match[2].trim(),
        state: stateAbbr,
        zip: match[4].trim(),
      };
    }
  }

  // Try: "Street, City, ST" (no zip)
  const matchNoZip = trimmed.match(
    /^(.+?),\s*(.+?),\s*([A-Za-z. ]+?)$/
  );
  if (matchNoZip) {
    const stateKey = matchNoZip[3].trim().toUpperCase().replace(/\./g, '');
    const stateAbbr = US_STATES[stateKey];
    if (stateAbbr) {
      return {
        street: matchNoZip[1].trim(),
        city: matchNoZip[2].trim(),
        state: stateAbbr,
        zip: '',
      };
    }
  }

  // Try: "Street, City ZIP" (no state)
  const matchCityZip = trimmed.match(
    /^(.+?),\s*(.+?)\s+(\d{5}(?:-\d{4})?)$/
  );
  if (matchCityZip) {
    return {
      street: matchCityZip[1].trim(),
      city: matchCityZip[2].trim(),
      state: '',
      zip: matchCityZip[3].trim(),
    };
  }

  // Try: just a zip code tacked onto the end of street
  const matchTrailingZip = trimmed.match(
    /^(.+?)\s+(\d{5}(?:-\d{4})?)$/
  );
  if (matchTrailingZip) {
    return {
      street: matchTrailingZip[1].trim(),
      city: '',
      state: '',
      zip: matchTrailingZip[2].trim(),
    };
  }

  return null;
}

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
    // Only flag if something was actually extracted beyond the street
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

  // Re-fetch and re-parse to ensure consistency
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
    // Only overwrite city/state/zip if the parsed value is non-empty
    // and the existing field is empty (don't clobber manually entered data)
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
