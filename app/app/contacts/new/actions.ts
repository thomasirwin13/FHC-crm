'use server';

import {
  getUser,
  getTeamForUser,
  createOrganization,
  logActivity,
} from '@/lib/db/supabase-queries';
import { ActivityType } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

export async function createOrganizationAction(name: string) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Organization name is required' };

  try {
    const organization = await createOrganization({
      name: trimmed,
      status: 'Potential Lead',
      user_id: user.id,
      team_id: team.id,
    });

    await logActivity(team.id, user.id, ActivityType.CREATE_ORGANIZATION);
    revalidatePath('/app/organizations');

    return { data: organization };
  } catch {
    return { error: 'Failed to create organization' };
  }
}
