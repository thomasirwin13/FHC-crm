import 'server-only';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { ORGANIZATION_STATUSES, DEFAULT_ORGANIZATION_STATUS } from '@/lib/constants/organization';
import { ActivityType } from '@/lib/db/schema';
import { notifyContactOrganizers } from '@/lib/db/notifications';
import { completeOutreachForContact } from '@/lib/db/outreach';
import { defineTool, type McpTool } from './protocol';

// Write tools for API keys with write access. Like the read tools they use the
// admin client, so every query MUST be scoped with .eq('team_id', teamId).
// Changes are credited to the team member who created the key.

const ENGAGEMENT_LEVELS = [
  'leader',
  'leader_non_aligned',
  'activist',
  'attender',
  'participator',
  'learner',
  'potential',
  'unlikely',
  'out_of_scope',
] as const;

const engagementLevel = z
  .enum(ENGAGEMENT_LEVELS)
  .describe(
    'leader = lead at aligned partner org (5), leader_non_aligned = leader of non-aligned org (1a), activist (4), attender (3), participator (2), learner (1), potential (0), unlikely (A), out_of_scope (B)',
  );

const MEETING_FORMS = ['not_specified', 'text_check_in', 'phone_call', 'zoom_meeting', 'in_person'] as const;

const optionalText = z.string().nullable().optional();

const contactFields = {
  name: z.string().min(1).optional(),
  email: optionalText,
  email_secondary: optionalText,
  phone: optionalText,
  phone_secondary: optionalText,
  street: optionalText,
  city: optionalText,
  state: optionalText,
  zip: optionalText,
  background: optionalText.describe('Background notes about the contact'),
  engagement_level: engagementLevel.optional(),
  outreach_frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).nullable().optional(),
  preferred_contact_method: optionalText,
  action_committed: z.boolean().optional(),
  organization_id: z.number().int().nullable().optional().describe('Primary organization id (null to clear)'),
};

const organizationFields = {
  name: z.string().min(1).optional(),
  status: z.enum(ORGANIZATION_STATUSES).optional().describe('Pipeline status'),
  type: optionalText,
  description: optionalText,
  website: optionalText,
  street: optionalText,
  city: optionalText,
  state: optionalText,
  zip: optionalText,
  engagement_level: engagementLevel.optional(),
  priority_follow_up: z.boolean().optional(),
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-10-25');

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function checkRow<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error('Record not found');
  return result.data;
}

// Drop keys the caller didn't send so a partial update leaves other fields alone.
function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function createCrmWriteTools(teamId: number, userId: number): McpTool[] {
  const supabase = createAdminClient();

  const logActivity = async (action: ActivityType) => {
    await supabase.from('activity_logs').insert({ team_id: teamId, user_id: userId, action });
  };

  const assertOrganization = async (id: number) => {
    const org = check(
      await supabase.from('organizations').select('id').eq('team_id', teamId).eq('id', id).maybeSingle(),
    );
    if (!org) throw new Error(`Organization ${id} not found`);
  };

  const assertContact = async (id: number): Promise<{ id: number; name: string }> => {
    const contact = check(
      await supabase.from('contacts').select('id, name').eq('team_id', teamId).eq('id', id).maybeSingle(),
    );
    if (!contact) throw new Error(`Contact ${id} not found`);
    return contact;
  };

  // Keep the many-to-many link table in step with a contact's primary organization.
  const linkContactToOrganization = async (contactId: number, organizationId: number) => {
    check(
      await supabase
        .from('contact_organizations')
        .upsert(
          { contact_id: contactId, organization_id: organizationId, team_id: teamId },
          { onConflict: 'contact_id,organization_id', ignoreDuplicates: true },
        ),
    );
  };

  return [
    defineTool({
      name: 'update_contact',
      title: 'Update a contact',
      description:
        'Change fields on an existing contact, such as phone, email, engagement level or primary organization. Only the fields you pass are changed.',
      readOnly: false,
      inputSchema: z.object({ id: z.number().int().describe('Contact id'), ...contactFields }),
      execute: async ({ id, ...fields }) => {
        await assertContact(id);
        const updates = defined(fields);
        if (Object.keys(updates).length === 0) throw new Error('No fields to update');
        if (updates.organization_id) await assertOrganization(updates.organization_id);

        const contact = checkRow(
          await supabase
            .from('contacts')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('team_id', teamId)
            .eq('id', id)
            .select('id, name, email, phone, engagement_level, organization_id, updated_at')
            .single(),
        );
        if (updates.organization_id) await linkContactToOrganization(id, updates.organization_id);
        await logActivity(ActivityType.UPDATE_CONTACT);
        return { updated: contact };
      },
    }),

    defineTool({
      name: 'create_contact',
      title: 'Create a contact',
      description:
        'Add a new contact. Search first with search_crm to avoid creating a duplicate of someone already in the CRM.',
      readOnly: false,
      inputSchema: z.object({ ...contactFields, name: z.string().min(1).describe('Full name') }),
      execute: async (fields) => {
        const values = defined(fields);
        if (values.organization_id) await assertOrganization(values.organization_id);

        const contact = checkRow(
          await supabase
            .from('contacts')
            .insert({
              ...values,
              name: fields.name,
              engagement_level: values.engagement_level ?? 'potential',
              team_id: teamId,
              user_id: userId,
            })
            .select('id, name, email, phone, engagement_level, organization_id')
            .single(),
        );
        if (values.organization_id) await linkContactToOrganization(contact.id, values.organization_id);
        await logActivity(ActivityType.CREATE_CONTACT);
        return { created: contact };
      },
    }),

    defineTool({
      name: 'update_organization',
      title: 'Update an organization',
      description:
        `Change fields on an existing organization, including its pipeline status (${ORGANIZATION_STATUSES.join(', ')}). Only the fields you pass are changed.`,
      readOnly: false,
      inputSchema: z.object({ id: z.number().int().describe('Organization id'), ...organizationFields }),
      execute: async ({ id, ...fields }) => {
        await assertOrganization(id);
        const updates = defined(fields);
        if (Object.keys(updates).length === 0) throw new Error('No fields to update');

        const organization = checkRow(
          await supabase
            .from('organizations')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('team_id', teamId)
            .eq('id', id)
            .select('id, name, status, engagement_level, priority_follow_up, updated_at')
            .single(),
        );
        await logActivity(ActivityType.UPDATE_ORGANIZATION);
        return { updated: organization };
      },
    }),

    defineTool({
      name: 'create_organization',
      title: 'Create an organization',
      description:
        'Add a new organization. Search first with search_crm to avoid creating a duplicate.',
      readOnly: false,
      inputSchema: z.object({ ...organizationFields, name: z.string().min(1).describe('Organization name') }),
      execute: async (fields) => {
        const values = defined(fields);
        const organization = checkRow(
          await supabase
            .from('organizations')
            .insert({
              ...values,
              name: fields.name,
              status: values.status ?? DEFAULT_ORGANIZATION_STATUS,
              team_id: teamId,
              user_id: userId,
            })
            .select('id, name, status, engagement_level')
            .single(),
        );
        await logActivity(ActivityType.CREATE_ORGANIZATION);
        return { created: organization };
      },
    }),

    defineTool({
      name: 'log_one_on_one',
      title: 'Log a 1-on-1 meeting',
      description:
        'Record a 1-on-1 meeting (or check-in) with a contact. This also clears the contact from the outreach queue and notifies their organizers, as logging one in the app does.',
      readOnly: false,
      inputSchema: z.object({
        contact_id: z.number().int().describe('Contact id'),
        date: isoDate.describe('Meeting date, YYYY-MM-DD'),
        notes: z.string().optional().describe('What was discussed'),
        meeting_form: z.enum(MEETING_FORMS).default('not_specified'),
        organizer_name: z
          .string()
          .optional()
          .describe('Who held the meeting, if not the person who created this API key'),
      }),
      execute: async ({ contact_id, date, notes, meeting_form, organizer_name }) => {
        const contact = await assertContact(contact_id);
        const record = checkRow(
          await supabase
            .from('one_on_ones')
            .insert({
              team_id: teamId,
              contact_id,
              date,
              notes: notes || null,
              meeting_form,
              user_id: organizer_name ? null : userId,
              organizer_name: organizer_name || null,
            })
            .select('id, contact_id, date, meeting_form, organizer_name, notes')
            .single(),
        );

        await completeOutreachForContact(contact_id, teamId).catch(() => {});
        await notifyContactOrganizers({
          teamId,
          contactId: contact_id,
          excludeUserId: userId,
          type: 'one_on_one_logged',
          title: `A 1-on-1 with ${contact.name} was logged via Claude`,
          link: `/app/contacts/${contact_id}`,
        }).catch(() => {});

        return { logged: record };
      },
    }),

    defineTool({
      name: 'update_one_on_one',
      title: 'Update a 1-on-1 meeting',
      description: 'Correct the date, notes or format of a 1-on-1 already logged. Get ids from get_contact.',
      readOnly: false,
      inputSchema: z.object({
        id: z.number().int().describe('1-on-1 id'),
        date: isoDate.optional(),
        notes: z.string().nullable().optional(),
        meeting_form: z.enum(MEETING_FORMS).optional(),
      }),
      execute: async ({ id, ...fields }) => {
        const updates = defined(fields);
        if (Object.keys(updates).length === 0) throw new Error('No fields to update');
        const record = check(
          await supabase
            .from('one_on_ones')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('team_id', teamId)
            .eq('id', id)
            .select('id, contact_id, date, meeting_form, notes')
            .maybeSingle(),
        );
        if (!record) throw new Error(`1-on-1 ${id} not found`);
        return { updated: record };
      },
    }),
  ];
}
