/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/notifications', () => ({ notifyContactOrganizers: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/db/outreach', () => ({ completeOutreachForContact: jest.fn(() => Promise.resolve()) }));

// A chainable fake Supabase client that records every call per table and
// resolves each query with the next queued result for that table.
type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];
const results: Record<string, Array<{ data: unknown; error: null }>> = {};

function query(table: string) {
  const chain: any = {};
  for (const method of ['select', 'insert', 'update', 'upsert', 'eq', 'in', 'order', 'limit']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return chain;
    };
  }
  const next = () => Promise.resolve(results[table]?.shift() ?? { data: null, error: null });
  chain.single = next;
  chain.maybeSingle = next;
  chain.then = (resolve: any, reject: any) => next().then(resolve, reject);
  return chain;
}

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: query }) }));

import { createCrmWriteTools } from '@/lib/mcp/crm-write-tools';
import { notifyContactOrganizers } from '@/lib/db/notifications';
import { completeOutreachForContact } from '@/lib/db/outreach';

const TEAM = 7;
const USER = 42;
const tools = createCrmWriteTools(TEAM, USER);
const tool = (name: string) => tools.find((t) => t.name === name)!;
const run = (name: string, input: unknown) => tool(name).execute(tool(name).inputSchema.parse(input));

function queue(table: string, data: unknown) {
  (results[table] ??= []).push({ data, error: null });
}
const callsFor = (table: string, method: string) => calls.filter((c) => c.table === table && c.method === method);

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(results)) delete results[k];
  jest.clearAllMocks();
});

describe('CRM write tools', () => {
  it('are all marked as not read-only', () => {
    expect(tools.map((t) => t.readOnly)).toEqual(tools.map(() => false));
  });

  it('updates only the given contact fields, scoped to the team', async () => {
    queue('contacts', { id: 5, name: 'Ana' });
    queue('contacts', { id: 5, name: 'Ana', phone: '555' });

    await run('update_contact', { id: 5, phone: '555', engagement_level: 'activist' });

    const [update] = callsFor('contacts', 'update');
    expect(update.args[0]).toEqual(expect.objectContaining({ phone: '555', engagement_level: 'activist' }));
    expect(Object.keys(update.args[0] as object).sort()).toEqual(['engagement_level', 'phone', 'updated_at']);
    expect(callsFor('contacts', 'eq').filter((c) => c.args[0] === 'team_id').every((c) => c.args[1] === TEAM)).toBe(true);
    expect(callsFor('activity_logs', 'insert')[0].args[0]).toEqual({ team_id: TEAM, user_id: USER, action: 'UPDATE_CONTACT' });
  });

  it('refuses to update a contact from another team', async () => {
    queue('contacts', null);
    await expect(run('update_contact', { id: 99, phone: '1' })).rejects.toThrow('Contact 99 not found');
    expect(callsFor('contacts', 'update')).toHaveLength(0);
  });

  it('refuses to move a contact to an organization outside the team', async () => {
    queue('contacts', { id: 5, name: 'Ana' });
    queue('organizations', null);
    await expect(run('update_contact', { id: 5, organization_id: 123 })).rejects.toThrow('Organization 123 not found');
    expect(callsFor('contacts', 'update')).toHaveLength(0);
  });

  it('creates a contact credited to the key creator and links its organization', async () => {
    queue('organizations', { id: 3 });
    queue('contacts', { id: 11, name: 'Ben' });

    await run('create_contact', { name: 'Ben', organization_id: 3 });

    expect(callsFor('contacts', 'insert')[0].args[0]).toEqual(
      expect.objectContaining({ name: 'Ben', team_id: TEAM, user_id: USER, engagement_level: 'potential', organization_id: 3 }),
    );
    expect(callsFor('contact_organizations', 'upsert')[0].args[0]).toEqual({ contact_id: 11, organization_id: 3, team_id: TEAM });
  });

  it('validates organization status', () => {
    expect(() => tool('update_organization').inputSchema.parse({ id: 1, status: 'Bogus' })).toThrow();
    expect(tool('update_organization').inputSchema.parse({ id: 1, status: 'Contact Made' })).toEqual({
      id: 1,
      status: 'Contact Made',
    });
  });

  it('logs a 1-on-1, clears outreach and notifies organizers', async () => {
    queue('contacts', { id: 5, name: 'Ana' });
    queue('one_on_ones', { id: 77 });

    await run('log_one_on_one', { contact_id: 5, date: '2026-10-20', notes: 'Coffee', meeting_form: 'in_person' });

    expect(callsFor('one_on_ones', 'insert')[0].args[0]).toEqual({
      team_id: TEAM,
      contact_id: 5,
      date: '2026-10-20',
      notes: 'Coffee',
      meeting_form: 'in_person',
      user_id: USER,
      organizer_name: null,
    });
    expect(completeOutreachForContact).toHaveBeenCalledWith(5, TEAM);
    expect(notifyContactOrganizers).toHaveBeenCalledWith(expect.objectContaining({ teamId: TEAM, contactId: 5, excludeUserId: USER }));
  });

  it('credits a named organizer instead of the key creator', async () => {
    queue('contacts', { id: 5, name: 'Ana' });
    queue('one_on_ones', { id: 78 });
    await run('log_one_on_one', { contact_id: 5, date: '2026-10-20', organizer_name: 'Maria' });
    expect(callsFor('one_on_ones', 'insert')[0].args[0]).toEqual(
      expect.objectContaining({ user_id: null, organizer_name: 'Maria', meeting_form: 'not_specified' }),
    );
  });

  it('rejects malformed dates', () => {
    expect(() => tool('log_one_on_one').inputSchema.parse({ contact_id: 5, date: 'last Tuesday' })).toThrow();
  });
});
