import 'server-only';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { defineTool, type McpTool } from './protocol';

// These tools run without a user session, so they use the admin client and
// every query MUST be scoped with .eq('team_id', teamId).

const ORG_COLUMNS =
  'id, name, status, type, description, website, size, street, city, state, zip, regions, engagement_level, priority_follow_up, created_at, updated_at';
const CONTACT_COLUMNS =
  'id, name, email, email_secondary, phone, phone_secondary, street, city, state, zip, county, regions, engagement_level, outreach_frequency, preferred_contact_method, background, action_committed, organization_id, created_at, updated_at';
const CONTACT_SUMMARY_COLUMNS = 'id, name, email, phone, city, state, engagement_level, organization_id';

const pagination = {
  limit: z.number().int().min(1).max(200).default(50).describe('Maximum records to return (1–200)'),
  offset: z.number().int().min(0).default(0).describe('Records to skip, for paging'),
};

// Strip characters that have meaning inside a PostgREST or() filter or LIKE pattern.
function toSearchTerm(query: string): string {
  return query.replace(/[%_,()*\\:"]/g, ' ').replace(/\s+/g, ' ').trim();
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function createCrmTools(teamId: number): McpTool[] {
  const supabase = createAdminClient();

  return [
    defineTool({
      name: 'search_crm',
      title: 'Search the CRM',
      description:
        'Search organizations (by name or description) and contacts (by name or email). Use this to find a specific record before fetching its details.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Text to search for'),
        type: z.enum(['organizations', 'contacts', 'both']).default('both'),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ query, type, limit }) => {
        const term = toSearchTerm(query);
        if (!term) return { organizations: [], contacts: [] };
        const pattern = `%${term}%`;
        const result: Record<string, unknown> = {};

        if (type !== 'contacts') {
          result.organizations = check(
            await supabase
              .from('organizations')
              .select('id, name, status, type, city, state, website')
              .eq('team_id', teamId)
              .or(`name.ilike.${pattern},description.ilike.${pattern}`)
              .order('name')
              .limit(limit),
          );
        }
        if (type !== 'organizations') {
          result.contacts = check(
            await supabase
              .from('contacts')
              .select(CONTACT_SUMMARY_COLUMNS)
              .eq('team_id', teamId)
              .or(`name.ilike.${pattern},email.ilike.${pattern}`)
              .order('name')
              .limit(limit),
          );
        }
        return result;
      },
    }),

    defineTool({
      name: 'list_organizations',
      title: 'List organizations',
      description: 'List the team\'s organizations, optionally filtered by pipeline status. Sorted by name.',
      inputSchema: z.object({
        status: z.string().optional().describe('Only return organizations with this status'),
        ...pagination,
      }),
      execute: async ({ status, limit, offset }) => {
        let q = supabase
          .from('organizations')
          .select(ORG_COLUMNS, { count: 'exact' })
          .eq('team_id', teamId);
        if (status) q = q.eq('status', status);
        const { data, count, error } = await q.order('name').range(offset, offset + limit - 1);
        if (error) throw new Error(error.message);
        return { organizations: data, total: count, offset, limit };
      },
    }),

    defineTool({
      name: 'get_organization',
      title: 'Get an organization',
      description: 'Get one organization by id, including the contacts linked to it.',
      inputSchema: z.object({ id: z.number().int().describe('Organization id') }),
      execute: async ({ id }) => {
        const organization = check(
          await supabase.from('organizations').select(ORG_COLUMNS).eq('team_id', teamId).eq('id', id).maybeSingle(),
        );
        if (!organization) throw new Error(`Organization ${id} not found`);

        const links = check(
          await supabase
            .from('contact_organizations')
            .select('contact_id')
            .eq('team_id', teamId)
            .eq('organization_id', id),
        );
        const linkedIds = (links ?? []).map((l) => l.contact_id);
        const filter = linkedIds.length
          ? `organization_id.eq.${id},id.in.(${linkedIds.join(',')})`
          : `organization_id.eq.${id}`;
        const contacts = check(
          await supabase
            .from('contacts')
            .select(CONTACT_SUMMARY_COLUMNS)
            .eq('team_id', teamId)
            .or(filter)
            .order('name'),
        );

        return { organization, contacts };
      },
    }),

    defineTool({
      name: 'list_contacts',
      title: 'List contacts',
      description: 'List the team\'s contacts, optionally filtered by organization or engagement level. Sorted by name.',
      inputSchema: z.object({
        organization_id: z.number().int().optional().describe('Only contacts whose primary organization is this id'),
        engagement_level: z.string().optional().describe('Only contacts with this engagement level'),
        ...pagination,
      }),
      execute: async ({ organization_id, engagement_level, limit, offset }) => {
        let q = supabase
          .from('contacts')
          .select(CONTACT_SUMMARY_COLUMNS, { count: 'exact' })
          .eq('team_id', teamId);
        if (organization_id !== undefined) q = q.eq('organization_id', organization_id);
        if (engagement_level) q = q.eq('engagement_level', engagement_level);
        const { data, count, error } = await q.order('name').range(offset, offset + limit - 1);
        if (error) throw new Error(error.message);
        return { contacts: data, total: count, offset, limit };
      },
    }),

    defineTool({
      name: 'get_contact',
      title: 'Get a contact',
      description: 'Get one contact by id, including their organizations and recent one-on-one meeting notes.',
      inputSchema: z.object({ id: z.number().int().describe('Contact id') }),
      execute: async ({ id }) => {
        const contact = check(
          await supabase.from('contacts').select(CONTACT_COLUMNS).eq('team_id', teamId).eq('id', id).maybeSingle(),
        );
        if (!contact) throw new Error(`Contact ${id} not found`);

        const links = check(
          await supabase.from('contact_organizations').select('organization_id').eq('team_id', teamId).eq('contact_id', id),
        );
        const orgIds = [...new Set([contact.organization_id, ...(links ?? []).map((l) => l.organization_id)])].filter(
          (v): v is number => v !== null,
        );
        const organizations = orgIds.length
          ? check(
              await supabase
                .from('organizations')
                .select('id, name, status, type')
                .eq('team_id', teamId)
                .in('id', orgIds),
            )
          : [];

        const oneOnOnes = check(
          await supabase
            .from('one_on_ones')
            .select('id, date, organizer_name, notes')
            .eq('team_id', teamId)
            .eq('contact_id', id)
            .order('date', { ascending: false })
            .limit(10),
        );

        return { contact, organizations, one_on_ones: oneOnOnes };
      },
    }),
  ];
}
