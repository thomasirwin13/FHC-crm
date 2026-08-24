// Political-district lookup via the US Census Bureau geocoder (free, no API key).
// Given a street address it returns the Congressional district, State Senate &
// State Assembly (legislative upper/lower) districts, and county.

export interface DistrictResult {
  congressional_district: string | null;
  state_senate_district: string | null;
  state_assembly_district: string | null;
  county: string | null;
  // Normalized address components returned by the geocoder for the match.
  city: string | null;
  state: string | null;
  zip: string | null;
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

function toTitleCase(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
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
 * Call the Census geocoder with a one-line address string and return the first
 * match (or null if not found / error).
 */
async function censusGeocode(
  address: string,
  benchmark = 'Public_AR_Current'
): Promise<any | null> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', benchmark);
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('layers', 'all');
  url.searchParams.set('format', 'json');

  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.addressMatches?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Try the Census geocoder's coordinate-based geography endpoint. Used as a
 * fallback when the address geocoder doesn't match but we have coordinates
 * (e.g. from a simpler geocode-only call).
 */
async function censusGeographyByCoords(
  lng: number,
  lat: number
): Promise<Record<string, any[]> | null> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('layers', 'all');
  url.searchParams.set('format', 'json');

  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.geographies ?? null;
  } catch {
    return null;
  }
}

/**
 * Build address variations to try when the primary lookup fails. Census TIGER
 * data can be picky about street naming; retrying with slight changes (dropping
 * the city, swapping word order, using just street + ZIP) often succeeds.
 */
function buildAddressVariations(parts: AddressParts): string[] {
  const street = parts.street?.trim();
  const city = parts.city?.trim();
  const state = parts.state?.trim();
  const zip = parts.zip?.trim();
  if (!street) return [];

  const variations: string[] = [];

  // Try street + ZIP only (skips city which can confuse the geocoder in LA neighborhoods)
  if (zip) {
    variations.push(`${street}, ${zip}`);
  }
  // Try street + state + ZIP (no city)
  if (state && zip) {
    variations.push(`${street}, ${state} ${zip}`);
  }

  return variations;
}

/**
 * Look up districts for an address. Returns:
 *  - { ok: true, result } on a successful geocode
 *  - { ok: false, reason } when the address is insufficient or not found
 *
 * The lookup tries the full address first, then retries with alternative
 * formatting (street+ZIP, street+state+ZIP). If the address geocoder fails
 * entirely but a location-only geocode returns coordinates, it falls back
 * to the coordinate-based geography endpoint.
 */
export async function lookupDistricts(
  parts: AddressParts
): Promise<{ ok: true; result: DistrictResult } | { ok: false; reason: string }> {
  const oneline = buildOneLineAddress(parts);
  if (!oneline) {
    return { ok: false, reason: 'Address needs a street plus city/state or ZIP.' };
  }

  // Try the primary address first
  let match = await censusGeocode(oneline);

  // If not found, try alternative address formats
  if (!match) {
    for (const variation of buildAddressVariations(parts)) {
      match = await censusGeocode(variation);
      if (match) break;
    }
  }

  // Fallback: use the location-only geocoder to get coordinates, then look up
  // geographies by those coordinates. The simpler endpoint sometimes matches
  // addresses the full endpoint misses.
  if (!match) {
    const locUrl = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
    locUrl.searchParams.set('address', oneline);
    locUrl.searchParams.set('benchmark', 'Public_AR_Current');
    locUrl.searchParams.set('format', 'json');
    try {
      const locRes = await fetch(locUrl.toString(), { headers: { Accept: 'application/json' } });
      if (locRes.ok) {
        const locData = await locRes.json();
        const locMatch = locData?.result?.addressMatches?.[0];
        if (locMatch?.coordinates) {
          const geo = await censusGeographyByCoords(
            locMatch.coordinates.x,
            locMatch.coordinates.y
          );
          if (geo) {
            match = { geographies: geo, addressComponents: locMatch.addressComponents || {} };
          }
        }
      }
    } catch {
      // ignore — we'll return the error below
    }
  }

  if (!match) {
    return { ok: false, reason: 'Address not found. Check the street and ZIP.' };
  }

  const geo: Record<string, any[]> = match.geographies || {};
  const comp = match.addressComponents || {};

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
    // Census returns the city in ALL CAPS — title-case it to match hand-entered data.
    city: toTitleCase((comp.city as string)?.trim()) || null,
    state: (comp.state as string)?.trim()?.toUpperCase() || null,
    zip: (comp.zip as string)?.trim() || null,
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
