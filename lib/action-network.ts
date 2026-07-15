// Action Network API wrapper (OSDI API v2).
//
// Keys are per-team (stored in team_integrations), so callers construct a
// client with an explicit API key via createActionNetworkClient(apiKey) rather
// than reading a global env var. Action Network authenticates with an
// `OSDI-API-Token` header (not a Bearer token) and returns OSDI/HAL resources
// under `_embedded` with `osdi:*` keys.
//
// Docs: https://actionnetwork.org/docs/v2/

const API_BASE = 'https://actionnetwork.org/api/v2';

// Action Network paginates 25 records per page and is rate-limited to ~4
// req/s. These caps bound a single manual sync so it stays within serverless
// time limits; when a cap is hit we surface it rather than silently truncating.
const MAX_PEOPLE_PAGES = 400;
const MAX_LIST_PAGES = 40;
const MAX_ACTION_PAGES = 40;

export interface ANPerson {
  anId: string;
  email: string;
  name: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface ANActionResource {
  id: string;
  title: string;
}

export interface ANActionMembers {
  personIds: string[];
  capped: boolean;
}

// Pull the Action Network person UUID out of a resource. Prefer the
// `action_network:<uuid>` identifier; fall back to parsing the self link.
function extractAnId(identifiers?: string[], selfHref?: string): string | null {
  if (Array.isArray(identifiers)) {
    const an = identifiers.find((i) => typeof i === 'string' && i.startsWith('action_network:'));
    if (an) return an.slice('action_network:'.length);
  }
  if (selfHref) {
    const m = selfHref.match(/\/people\/([0-9a-f-]+)/i);
    if (m) return m[1];
  }
  return null;
}

// Pull the person UUID a signature/attendance links to.
function extractLinkedPersonId(record: any): string | null {
  const href = record?._links?.['osdi:person']?.href;
  if (typeof href === 'string') {
    const m = href.match(/\/people\/([0-9a-f-]+)/i);
    if (m) return m[1];
  }
  return null;
}

function primaryOf<T extends { primary?: boolean }>(list: T[] | undefined): T | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list.find((x) => x.primary) || list[0];
}

export interface ActionNetworkClient {
  fetchAllPeople(): Promise<{ people: ANPerson[]; capped: boolean }>;
  fetchPetitions(): Promise<ANActionResource[]>;
  fetchEvents(): Promise<ANActionResource[]>;
  fetchSignaturePersonIds(petitionId: string): Promise<ANActionMembers>;
  fetchAttendancePersonIds(eventId: string): Promise<ANActionMembers>;
  upsertPerson(
    contact: {
      email: string;
      name: string | null;
      phone: string | null;
      street: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    },
    addTags?: string[]
  ): Promise<{ ok: boolean; error?: string }>;
}

/** Build an Action Network client bound to a specific team's API key. */
export function createActionNetworkClient(apiKey: string): ActionNetworkClient {
  if (!apiKey) throw new Error('Action Network API key is required');

  async function anFetch(urlOrPath: string, init?: RequestInit) {
    const url = urlOrPath.startsWith('http') ? urlOrPath : `${API_BASE}${urlOrPath}`;
    return fetch(url, {
      ...init,
      headers: {
        'OSDI-API-Token': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });
  }

  async function fetchAllPeople(): Promise<{ people: ANPerson[]; capped: boolean }> {
    const out: ANPerson[] = [];
    let next: string | null = '/people';
    let pages = 0;
    let capped = false;

    while (next) {
      if (pages >= MAX_PEOPLE_PAGES) { capped = true; break; }
      const res = await anFetch(next);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Action Network people fetch failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const json: any = await res.json();
      const people: any[] = json?._embedded?.['osdi:people'] || [];
      for (const p of people) {
        const emailRec = primaryOf<any>(p.email_addresses);
        const email = (emailRec?.address || '').toString().trim();
        if (!email) continue;
        const anId = extractAnId(p.identifiers, p?._links?.self?.href);
        if (!anId) continue;
        const phoneRec = primaryOf<any>(p.phone_numbers);
        const addrRec = primaryOf<any>(p.postal_addresses);
        const name = [p.given_name, p.family_name].filter(Boolean).join(' ').trim() || null;
        const addressLines = Array.isArray(addrRec?.address_lines) ? addrRec.address_lines : [];
        const street = addressLines.filter(Boolean).join(', ').trim() || null;
        out.push({
          anId,
          email,
          name,
          phone: phoneRec?.number ? String(phoneRec.number) : null,
          street,
          city: addrRec?.locality || null,
          state: addrRec?.region || null,
          zip: addrRec?.postal_code || null,
        });
      }
      next = json?._links?.next?.href || null;
      pages++;
    }
    return { people: out, capped };
  }

  async function fetchActionList(
    collectionPath: string,
    embedKey: string,
  ): Promise<ANActionResource[]> {
    const out: ANActionResource[] = [];
    let next: string | null = collectionPath;
    let pages = 0;
    while (next && pages < MAX_LIST_PAGES) {
      const res = await anFetch(next);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Action Network ${embedKey} fetch failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const json: any = await res.json();
      const items: any[] = json?._embedded?.[embedKey] || [];
      for (const item of items) {
        const id = extractAnId(item.identifiers, item?._links?.self?.href)
          || (item?._links?.self?.href || '').split('/').pop() || '';
        const title = (item.title || item.name || 'Untitled').toString().trim();
        if (id) out.push({ id, title });
      }
      next = json?._links?.next?.href || null;
      pages++;
    }
    return out;
  }

  function fetchPetitions(): Promise<ANActionResource[]> {
    return fetchActionList('/petitions', 'osdi:petitions');
  }

  function fetchEvents(): Promise<ANActionResource[]> {
    return fetchActionList('/events', 'osdi:events');
  }

  async function fetchActionMembers(
    collectionUrl: string,
    embedKey: string,
  ): Promise<ANActionMembers> {
    const personIds: string[] = [];
    let next: string | null = collectionUrl;
    let pages = 0;
    let capped = false;
    while (next) {
      if (pages >= MAX_ACTION_PAGES) { capped = true; break; }
      const res = await anFetch(next);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Action Network ${embedKey} fetch failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const json: any = await res.json();
      const records: any[] = json?._embedded?.[embedKey] || [];
      for (const rec of records) {
        const pid = extractLinkedPersonId(rec);
        if (pid) personIds.push(pid);
      }
      next = json?._links?.next?.href || null;
      pages++;
    }
    return { personIds, capped };
  }

  function fetchSignaturePersonIds(petitionId: string): Promise<ANActionMembers> {
    return fetchActionMembers(`/petitions/${petitionId}/signatures`, 'osdi:signatures');
  }

  function fetchAttendancePersonIds(eventId: string): Promise<ANActionMembers> {
    return fetchActionMembers(`/events/${eventId}/attendances`, 'osdi:attendances');
  }

  async function upsertPerson(
    contact: {
      email: string;
      name: string | null;
      phone: string | null;
      street: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    },
    addTags: string[] = []
  ): Promise<{ ok: boolean; error?: string }> {
    const nameParts = (contact.name || '').trim().split(/\s+/).filter(Boolean);
    const person: Record<string, any> = {
      email_addresses: [{ address: contact.email }],
    };
    if (nameParts[0]) person.given_name = nameParts[0];
    if (nameParts.length > 1) person.family_name = nameParts.slice(1).join(' ');
    if (contact.phone) person.phone_numbers = [{ number: contact.phone }];
    const postal: Record<string, any> = {};
    if (contact.street) postal.address_lines = [contact.street];
    if (contact.city) postal.locality = contact.city;
    if (contact.state) postal.region = contact.state;
    if (contact.zip) postal.postal_code = contact.zip;
    if (Object.keys(postal).length) person.postal_addresses = [postal];

    const body: Record<string, any> = { person };
    if (addTags.length) body.add_tags = addTags;

    const res = await anFetch('/people', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  }

  return {
    fetchAllPeople,
    fetchPetitions,
    fetchEvents,
    fetchSignaturePersonIds,
    fetchAttendancePersonIds,
    upsertPerson,
  };
}
