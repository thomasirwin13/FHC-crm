/**
 * E2E Tests: Chat Organization CRUD Tools
 *
 * Tests the organization management tools in the chat interface (sidebar and full page).
 * Verifies tool calls render confirmation cards, and confirm/cancel actions work.
 * Does NOT test AI streaming content -- tests the tool UI and DB side effects.
 * Run with: pnpm exec playwright test __tests__/e2e/chat/chat-organization-tools.spec.ts
 */

import { test as base, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/db/database.types';

// Combined fixtures: chat + organization helpers
type ChatOrganizationFixtures = {
  createTestOrganization: (data: { name: string; status?: string }) => Promise<number>;
  deleteAllTeamOrganizations: () => Promise<void>;
  deleteAllTeamChats: () => Promise<void>;
  getOrganizationByName: (name: string) => Promise<any | null>;
  getOrganizationCount: () => Promise<number>;
  teamId: number;
  userId: number;
};

function createAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials.');
  }
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getTestUserInfo(supabase: SupabaseClient<Database>) {
  const testEmail = process.env.TEST_USER_EMAIL;
  if (!testEmail) throw new Error('TEST_USER_EMAIL not set');

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', testEmail)
    .single();
  if (!user) throw new Error(`Test user not found: ${testEmail}`);

  const { data: teamMember } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .single();
  if (!teamMember) throw new Error('Team not found');

  return { userId: user.id, teamId: teamMember.team_id };
}

const test = base.extend<ChatOrganizationFixtures>({
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
    const fixture = async (data: { name: string; status?: string }) => {
      const supabase = createAdminClient();
      const { teamId, userId } = await getTestUserInfo(supabase);
      const { data: organization, error } = await supabase
        .from('organizations')
        .insert({
          team_id: teamId,
          user_id: userId,
          name: data.name,
          status: data.status || 'Prospect',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Failed to create test organization: ${error.message}`);
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
  deleteAllTeamChats: async ({}, use) => {
    const fixture = async () => {
      const supabase = createAdminClient();
      const { teamId } = await getTestUserInfo(supabase);
      await supabase.from('messages').delete().eq('team_id', teamId);
      await supabase.from('chats').delete().eq('team_id', teamId);
    };
    await use(fixture);
  },
  getOrganizationByName: async ({}, use) => {
    const fixture = async (name: string) => {
      const supabase = createAdminClient();
      const { teamId } = await getTestUserInfo(supabase);
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('team_id', teamId)
        .eq('name', name)
        .single();
      return data;
    };
    await use(fixture);
  },
  getOrganizationCount: async ({}, use) => {
    const fixture = async () => {
      const supabase = createAdminClient();
      const { teamId } = await getTestUserInfo(supabase);
      const { count } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);
      return count || 0;
    };
    await use(fixture);
  },
});

test.describe.configure({ mode: 'serial' });

test.describe('Chat Organization Tools - Full Page (/app/chat)', () => {
  test.beforeEach(async ({ deleteAllTeamOrganizations, deleteAllTeamChats }) => {
    await deleteAllTeamOrganizations();
    await deleteAllTeamChats();
  });

  test.afterAll(async ({ deleteAllTeamOrganizations, deleteAllTeamChats }) => {
    await deleteAllTeamOrganizations();
    await deleteAllTeamChats();
  });

  test('listOrganizations tool renders when asking about organizations', async ({
    page,
    createTestOrganization,
  }) => {
    await createTestOrganization({ name: 'Chat Test Corp' });

    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    // Type a message that should trigger listOrganizations
    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('List my organizations');
    await input.press('Enter');

    // Wait for tool call to appear -- either the tool display or text response
    // The LLM should call listOrganizations and we should see some tool indicator
    await expect(
      page.getByText(/Listed organizations/i).or(page.getByText('Chat Test Corp'))
    ).toBeVisible({ timeout: 30000 });
  });

  test('addOrganization tool shows confirmation card', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Add an organization called ChatToolTestCo of type Technology, status Prospect');
    await input.press('Enter');

    // Should see the confirmation card with "Yes, add" button
    await expect(
      page.getByRole('button', { name: /Yes, add/i })
    ).toBeVisible({ timeout: 30000 });

    // Should see the organization name in the confirmation preview card
    await expect(page.getByText('ChatToolTestCo', { exact: true })).toBeVisible();
  });

  test('confirming addOrganization creates organization in DB', async ({
    page,
    getOrganizationByName,
    getOrganizationCount,
  }) => {
    const countBefore = await getOrganizationCount();

    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Add an organization called ConfirmTestCo, type Healthcare');
    await input.press('Enter');

    // Wait for and click the confirm button
    const confirmButton = page.getByRole('button', { name: /Yes, add/i });
    await expect(confirmButton).toBeVisible({ timeout: 30000 });
    await confirmButton.click();

    // Wait for the server action to complete -- success state renders "Organization created"
    await expect(page.getByText(/Organization created/i)).toBeVisible({ timeout: 30000 });

    // Verify organization was created in the database
    const organization = await getOrganizationByName('ConfirmTestCo');
    expect(organization).not.toBeNull();
    expect(organization?.name).toBe('ConfirmTestCo');
    expect(organization?.type).toBe('Healthcare');

    expect(await getOrganizationCount()).toBe(countBefore + 1);
  });

  test('cancelling addOrganization does not create organization', async ({
    page,
    getOrganizationCount,
  }) => {
    const countBefore = await getOrganizationCount();

    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Add an organization called CancelTestCo');
    await input.press('Enter');

    // Wait for confirmation card
    const cancelButton = page.getByRole('button', { name: /Cancel/i });
    await expect(cancelButton).toBeVisible({ timeout: 30000 });
    await cancelButton.click();

    // Should see cancelled state
    await expect(page.getByText(/Cancelled/i)).toBeVisible({ timeout: 5000 });

    // DB should be unchanged
    expect(await getOrganizationCount()).toBe(countBefore);
  });

  test('editOrganization tool shows diff preview', async ({
    page,
    createTestOrganization,
  }) => {
    await createTestOrganization({ name: 'EditTarget', status: 'Prospect' });

    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Update EditTarget organization status to Client');
    await input.press('Enter');

    // Should see confirmation card with "Yes, update" button
    await expect(
      page.getByRole('button', { name: /Yes, update/i })
    ).toBeVisible({ timeout: 30000 });
  });

  test('deleteOrganization tool shows cascade warning', async ({
    page,
    createTestOrganization,
  }) => {
    await createTestOrganization({ name: 'DeleteTarget' });

    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Delete the organization DeleteTarget');
    await input.press('Enter');

    // Should see destructive confirmation card with "Yes, delete" button
    await expect(
      page.getByRole('button', { name: /Yes, delete/i })
    ).toBeVisible({ timeout: 30000 });

    // Should see cascade warning text
    await expect(
      page.getByText(/permanently delete/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('confirming deleteOrganization removes organization from DB', async ({
    page,
    createTestOrganization,
    getOrganizationByName,
  }) => {
    await createTestOrganization({ name: 'DeleteConfirmCo' });

    // Verify it exists
    expect(await getOrganizationByName('DeleteConfirmCo')).not.toBeNull();

    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Delete the organization DeleteConfirmCo');
    await input.press('Enter');

    const deleteButton = page.getByRole('button', { name: /Yes, delete/i });
    await expect(deleteButton).toBeVisible({ timeout: 30000 });
    await deleteButton.click();

    // Wait for the server action to complete -- success state renders "Deleted"
    await expect(page.getByText(/Deleted/i)).toBeVisible({ timeout: 30000 });

    // Verify organization was removed
    expect(await getOrganizationByName('DeleteConfirmCo')).toBeNull();
  });
});

/**
 * LLM-dependent tests that are non-deterministic.
 * Run as a triplet -- the test passes if at least 1 of 3 attempts succeeds.
 */
test.describe('Chat Organization Tools - LLM Eval (triplet)', () => {
  test.describe.configure({ mode: 'serial', retries: 2 });

  test.beforeEach(async ({ deleteAllTeamOrganizations, deleteAllTeamChats }) => {
    await deleteAllTeamOrganizations();
    await deleteAllTeamChats();
  });

  test.afterAll(async ({ deleteAllTeamOrganizations, deleteAllTeamChats }) => {
    await deleteAllTeamOrganizations();
    await deleteAllTeamChats();
  });

  test('success state shows link to created organization', async ({
    page,
    getOrganizationByName,
  }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Ask sage anything/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Add an organization called LinkTestCo');
    await input.press('Enter');

    // Wait for the LLM to call addOrganization and show the confirmation card
    const confirmButton = page.getByRole('button', { name: /Yes, add/i });
    await expect(confirmButton).toBeVisible({ timeout: 30000 });
    await confirmButton.click();

    // Wait for the server action to complete -- the success state renders
    // "Organization created" text, replacing the "Saving..." button.
    await expect(
      page.getByText(/Organization created/i)
    ).toBeVisible({ timeout: 30000 });

    // Verify organization was created in DB
    const organization = await getOrganizationByName('LinkTestCo');
    expect(organization).not.toBeNull();

    // The success state renders a "View organization" link, and the follow-up LLM
    // message should include the organization URL. Check for either.
    await expect(
      page.getByRole('link', { name: /View organization/i })
        .or(page.getByText(/\/app\/organizations\/\d+/))
    ).toBeVisible({ timeout: 30000 });
  });
});
