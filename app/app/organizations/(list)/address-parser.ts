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

  // Try: "Street, City, ST ZIP" or "Street, City, State ZIP"
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

  // Try: just a zip code tacked onto the end
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
