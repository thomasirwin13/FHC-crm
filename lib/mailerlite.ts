// MailerLite API wrapper (uses the current connect.mailerlite.com API).
//
// Requires MAILERLITE_API_KEY in the environment. Optionally set
// MAILERLITE_GROUP_ID to scope the sync to a single group; if omitted, the
// sync pulls/pushes against your whole subscriber list.

const API_BASE = 'https://connect.mailerlite.com/api';

export interface MailerLiteSubscriber {
  id: string;
  email: string;
  name: string | null;
}

function getApiKey(): string | null {
  return process.env.MAILERLITE_API_KEY || null;
}

export function getGroupId(): string | null {
  return process.env.MAILERLITE_GROUP_ID || null;
}

export function isConfigured(): boolean {
  return !!getApiKey();
}

async function mlFetch(path: string, init?: RequestInit) {
  const key = getApiKey();
  if (!key) throw new Error('MailerLite is not configured (missing MAILERLITE_API_KEY)');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  return res;
}

/**
 * Fetch every subscriber (optionally scoped to a group), following cursor
 * pagination until exhausted.
 */
export async function fetchAllSubscribers(): Promise<MailerLiteSubscriber[]> {
  const groupId = getGroupId();
  const basePath = groupId ? `/groups/${groupId}/subscribers` : '/subscribers';
  const out: MailerLiteSubscriber[] = [];
  let cursor: string | null = null;
  // Hard cap on pages to avoid a runaway loop.
  for (let page = 0; page < 1000; page++) {
    const params = new URLSearchParams({ limit: '500' });
    if (cursor) params.set('cursor', cursor);
    const res = await mlFetch(`${basePath}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MailerLite fetch failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json: any = await res.json();
    for (const row of json.data || []) {
      const email = (row.email || '').toString().trim();
      if (!email) continue;
      const fields = row.fields || {};
      const name = [fields.name, fields.last_name].filter(Boolean).join(' ').trim() || null;
      out.push({ id: row.id?.toString() ?? '', email, name });
    }
    cursor = json.meta?.next_cursor || null;
    if (!cursor) break;
  }
  return out;
}

/**
 * Create or update a subscriber by email. MailerLite upserts on email, so this
 * is safe to call for contacts that already exist. Assigns to the configured
 * group when one is set.
 */
export async function upsertSubscriber(email: string, name: string | null): Promise<{ ok: boolean; error?: string }> {
  const groupId = getGroupId();
  const nameParts = (name || '').trim().split(/\s+/);
  const fields: Record<string, string> = {};
  if (nameParts[0]) fields.name = nameParts[0];
  if (nameParts.length > 1) fields.last_name = nameParts.slice(1).join(' ');

  const body: Record<string, any> = { email };
  if (Object.keys(fields).length) body.fields = fields;
  if (groupId) body.groups = [groupId];

  const res = await mlFetch('/subscribers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}
