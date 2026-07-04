/**
 * Playwright Organization Fixtures
 *
 * Provides database manipulation utilities for E2E organization management tests.
 * Uses admin Supabase client to bypass RLS for test isolation.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/organization-fixtures';
 *
 *   test('my test', async ({ page, createTestOrganization, deleteAllTeamOrganizations }) => {
 *     await deleteAllTeamOrganizations();
 *     const organizationId = await createTestOrganization({ name: 'Acme Corp' });
 *     // ... test code
 *   });
 */

import { test as base, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/db/database.types';

type OrganizationFixtures = {
  createTestOrganization: (data: {
    name: string;
    status?: string;
    contactEmail?: string;
    website?: string;
    type?: string;
  }) => Promise<number>;

  deleteAllTeamOrganizations: () => Promise<void>;

  getOrganizationCount: () => Promise<number>;

  teamId: number;
  userId: number;
};

function createAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getTestUserInfo(supabase: SupabaseClient<Database>): Promise<{
  userId: number;
  teamId: number;
}> {
  const testEmail = process.env.TEST_USER_EMAIL;
  if (!testEmail) {
    throw new Error('TEST_USER_EMAIL environment variable not set');
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', testEmail)
    .single();

  if (userError || !user) {
    throw new Error(`Test user not found: ${testEmail}. Run 'pnpm db:seed' first.`);
  }

  const { data: teamMember, error: teamError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .single();

  if (teamError || !teamMember) {
    throw new Error(`Team membership not found for user ${testEmail}`);
  }

  return {
    userId: user.id,
    teamId: teamMember.team_id,
  };
}

export const test = base.extend<OrganizationFixtures>({
  teamId: async ({}, use) => {
    const supabase = createAdminClient();
    const { teamId } = await getTestUserInfo(supabase);
    await use(teamId);
  },

  userId: async ({}, use) => {
    const supabase = createAdminClient();
    const { userId } = await getTestUserInfo(supabase);
    await use(userId);
  },

  createTestOrganization: async ({}, use) => {
    const fixture = async (data: {
      name: string;
      status?: string;
      contactEmail?: string;
      website?: string;
      type?: string;
    }) => {
      const supabase = createAdminClient();
      const { teamId, userId } = await getTestUserInfo(supabase);

      const { data: organization, error } = await supabase
        .from('organizations')
        .insert({
          team_id: teamId,
          user_id: userId,
          name: data.name,
          status: data.status || 'Lead',
          contact_email: data.contactEmail || null,
          website: data.website || null,
          type: data.type || null,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create test organization: ${error.message}`);
      }

      return organization.id;
    };
    await use(fixture);
  },

  deleteAllTeamOrganizations: async ({}, use) => {
    const fixture = async () => {
      const supabase = createAdminClient();
      const { teamId } = await getTestUserInfo(supabase);

      // Delete contacts referencing organizations first (foreign key)
      await supabase.from('contacts').delete().eq('team_id', teamId);
      await supabase.from('organizations').delete().eq('team_id', teamId);
    };
    await use(fixture);
  },

  getOrganizationCount: async ({}, use) => {
    const fixture = async (): Promise<number> => {
      const supabase = createAdminClient();
      const { teamId } = await getTestUserInfo(supabase);

      const { count, error } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if (error) {
        throw new Error(`Failed to get organization count: ${error.message}`);
      }

      return count || 0;
    };
    await use(fixture);
  },
});

export { expect };
