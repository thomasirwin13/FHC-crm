/** @jest-environment node */
jest.mock('server-only', () => ({}));

const maybeSingle = jest.fn();
const update = jest.fn(() => ({ eq: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      update,
    }),
  }),
}));

import { authenticateApiKey, extractApiKey, generateApiKey, hashApiKey } from '@/lib/auth/api-key';

describe('API keys', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    update.mockClear();
  });

  it('generates prefixed keys with a matching hash', () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key).toMatch(/^fhc_[A-Za-z0-9_-]{32}$/);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashApiKey(key));
    expect(generateApiKey().key).not.toBe(key);
  });

  it('reads the key from the path first, then the bearer header', () => {
    const req = new Request('http://x', { headers: { authorization: 'Bearer fhc_header' } });
    expect(extractApiKey(req, 'fhc_path')).toBe('fhc_path');
    expect(extractApiKey(req)).toBe('fhc_header');
    expect(extractApiKey(new Request('http://x'))).toBeNull();
  });

  it('rejects keys without the prefix without querying', async () => {
    expect(await authenticateApiKey('zap_123')).toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('rejects unknown and revoked keys', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null });
    expect(await authenticateApiKey('fhc_unknown')).toBeNull();
    maybeSingle.mockResolvedValueOnce({
      data: { id: 1, team_id: 2, last_used_at: null, revoked_at: '2026-01-01T00:00:00' },
    });
    expect(await authenticateApiKey('fhc_revoked')).toBeNull();
  });

  it('accepts a live key and records when it was used', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 1, team_id: 2, last_used_at: null, revoked_at: null } });
    expect(await authenticateApiKey('fhc_live')).toEqual({ teamId: 2, keyId: 1 });
    expect(update).toHaveBeenCalledTimes(1);

    maybeSingle.mockResolvedValueOnce({
      data: { id: 1, team_id: 2, last_used_at: new Date().toISOString(), revoked_at: null },
    });
    await authenticateApiKey('fhc_live');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
