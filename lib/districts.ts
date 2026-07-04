// Political-district lookup via the US Census Bureau geocoder (free, no API key).
// Given a street address it returns the Congressional district, State Senate &
// State Assembly (legislative upper/lower) districts, and county.

export interface DistrictResult {
  congressional_district: string | null;
  state_senate_district: string | null;
  state_assembly_district: string | null;
  county: string | null;
}

export interface AddressParts {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/**
 * Builds a one-line address string. Returns null when there isn't enough to
 * geocode meaningfully (we require a street plus either city+state or a ZIP).
 */
export function buildOneLineAddress(parts: AddressParts): string | null {
  const street = parts.street?.trim();
  const city = parts.city?.trim();
  const state = parts.state?.trim();
  const zip = parts.zip?.trim();

  if (!street) return null;
  if (!((city && state) || zip)) return null;

  const tail = [city, state].filter(Boolean).join(', ');
  return [street, tail, zip].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function pickGeography(
  geographies: Record<string, any[]>,
  matcher: (key: string) => boolean
): string | null {
  const key = Object.keys(geographies).find((k) => matcher(k.toLowerCase()));
  if (!key) return null;
  const entry = geographies[key]?.[0];
  if (!entry) return null;
  // NAME is human-readable (e.g. "Congressional District 34"); fall back to BASENAME.
  return (entry.NAME as string) || (entry.BASENAME as string) || null;
}

/**
 * Look up districts for an address. Returns:
 *  - { ok: true, result } on a successful geocode
 *  - { ok: false, reason } when the address is insufficient or not found
 */
export async function lookupDistricts(
  parts: AddressParts
): Promise<{ ok: true; result: DistrictResult } | { ok: false; reason: string }> {
  const oneline = buildOneLineAddress(parts);
  if (!oneline) {
    return { ok: false, reason: 'Address needs a street plus city/state or ZIP.' };
  }

  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
  url.searchParams.set('address', oneline);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('layers', 'all');
  url.searchParams.set('format', 'json');

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  } catch {
    return { ok: false, reason: 'Could not reach the Census geocoder. Try again.' };
  }
  if (!res.ok) {
    return { ok: false, reason: `Geocoder error (${res.status}).` };
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: 'Unexpected response from the geocoder.' };
  }

  const match = data?.result?.addressMatches?.[0];
  if (!match) {
    return { ok: false, reason: 'Address not found. Check the street and ZIP.' };
  }

  const geo: Record<string, any[]> = match.geographies || {};

  const result: DistrictResult = {
    congressional_district: pickGeography(geo, (k) => k.includes('congressional district')),
    state_senate_district: pickGeography(
      geo,
      (k) => k.includes('state legislative district') && k.includes('upper')
    ),
    state_assembly_district: pickGeography(
      geo,
      (k) => k.includes('state legislative district') && k.includes('lower')
    ),
    county: pickGeography(geo, (k) => k === 'counties' || k.includes('counties')),
  };

  if (
    !result.congressional_district &&
    !result.state_senate_district &&
    !result.state_assembly_district &&
    !result.county
  ) {
    return { ok: false, reason: 'No districts found for that address.' };
  }

  return { ok: true, result };
}
