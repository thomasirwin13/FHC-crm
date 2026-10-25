import 'server-only';

import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const API_KEY_PREFIX = 'fhc_';

export interface ApiKeyContext {
  teamId: number;
  keyId: number;
  /** The team member who created the key; changes made with it are credited to them. */
  userId: number | null;
  /** True only for keys allowed to change data whose creator is still on the team. */
  canWrite: boolean;
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Pull a key from `Authorization: Bearer <key>`, or use the one given (from the URL). */
export function extractApiKey(request: Request, keyFromPath?: string): string | null {
  const fromPath = keyFromPath?.trim();
  if (fromPath) return fromPath;
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

// Only bump last_used_at when it's stale, so busy sessions don't write on every call.
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

/** Resolve an API key to its team, or null if it's unknown or revoked. */
export async function authenticateApiKey(key: string): Promise<ApiKeyContext | null> {
  if (!key.startsWith(API_KEY_PREFIX)) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('api_keys')
    .select('id, team_id, created_by, can_write, last_used_at, revoked_at')
    .eq('key_hash', hashApiKey(key))
    .maybeSingle();

  if (!data || data.revoked_at) return null;

  const lastUsed = data.last_used_at ? new Date(data.last_used_at).getTime() : 0;
  if (Date.now() - lastUsed > LAST_USED_RESOLUTION_MS) {
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);
  }

  // Writes are credited to the key's creator, so they must still be on the team.
  let canWrite = false;
  if (data.can_write && data.created_by !== null) {
    const { data: member } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', data.team_id)
      .eq('user_id', data.created_by)
      .maybeSingle();
    canWrite = !!member;
  }

  return { teamId: data.team_id, keyId: data.id, userId: data.created_by, canWrite };
}
