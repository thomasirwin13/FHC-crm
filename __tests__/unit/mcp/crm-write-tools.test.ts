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
  for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'limit']) {
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

  it('creates a meeting with attendees from the team only', async () => {
    queue('contacts', [{ id: 5 }, { id: 6 }]);
    queue('meetings', { id: 30, name: 'October Gathering' });

    const result = await run('create_meeting', {
      name: 'October Gathering',
      date: '2026-10-24',
      attendee_contact_ids: [5, 6, 5],
    });

    expect(callsFor('meetings', 'insert')[0].args[0]).toEqual({
      team_id: TEAM,
      user_id: USER,
      name: 'October Gathering',
      date: '2026-10-24',
      location: null,
      notes: null,
    });
    expect(callsFor('meeting_attendance', 'upsert')[0].args[0]).toEqual([
      { meeting_id: 30, contact_id: 5, team_id: TEAM },
      { meeting_id: 30, contact_id: 6, team_id: TEAM },
    ]);
    expect(result).toEqual(expect.objectContaining({ attendees_added: 2 }));
  });

  it('refuses attendees that are not the team\'s contacts', async () => {
    queue('meetings', { id: 30 });
    queue('contacts', [{ id: 5 }]);
    await expect(run('add_meeting_attendees', { meeting_id: 30, contact_ids: [5, 999] })).rejects.toThrow(
      'Contacts not found: 999',
    );
    expect(callsFor('meeting_attendance', 'upsert')).toHaveLength(0);
  });

  it('refuses to touch another team\'s meeting', async () => {
    queue('meetings', null);
    await expect(run('remove_meeting_attendees', { meeting_id: 77, contact_ids: [5] })).rejects.toThrow(
      'Meeting 77 not found',
    );
    expect(callsFor('meeting_attendance', 'delete')).toHaveLength(0);
  });

  it('removes attendees scoped to the team and meeting', async () => {
    queue('meetings', { id: 30 });
    await run('remove_meeting_attendees', { meeting_id: 30, contact_ids: [5] });
    const eqs = callsFor('meeting_attendance', 'eq').map((c) => c.args);
    expect(eqs).toEqual(expect.arrayContaining([['team_id', TEAM], ['meeting_id', 30]]));
    expect(callsFor('meeting_attendance', 'in')[0].args).toEqual(['contact_id', [5]]);
  });
});
