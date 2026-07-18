'use server';

import { z } from 'zod';
import {
  updateOrganization,
  setOrganizationTeamLeader,
  logActivity,
  getUser,
  getTeamForUser,
} from '@/lib/db/supabase-queries';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { ActivityType } from '@/lib/db/schema';
import { organizationStatusSchema } from '@/lib/constants/organization';
import { revalidatePath } from 'next/cache';

const updateOrganizationSchema = z.object({
  id: z.coerce.number(),
  name: z.string().min(1, 'Organization name is required').max(255),
  description: z.string().optional(),
  website: z.string()
    .transform((val) => {
      if (!val) return '';
      if (val && !val.match(/^https?:\/\//)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url().optional().or(z.literal(''))),
  type: z.string().optional(),
  size: z.string().optional(),
  status: organizationStatusSchema.optional(),
  engagement_level: z.string().optional(),
  assigned_user_id: z.coerce.number().nullable().optional(),
  priority_follow_up: z.string().optional().transform((v) => v === 'true'),
});

export const updateOrganizationAction = validatedActionWithUser(
  updateOrganizationSchema,
  async (data, _, user) => {
    const team = await getTeamForUser();
    if (!team) {
      return { error: 'No team found' };
    }

    try {
      const result = await updateOrganization(
        data.id,
        team.id,
        {
          name: data.name,
          description: data.description || null,
          website: data.website || null,
          type: data.type || null,
          size: data.size || null,
          status: data.status || 'Potential Lead',
          engagement_level: data.engagement_level || 'potential',
          assigned_user_id: data.assigned_user_id ?? null,
          priority_follow_up: data.priority_follow_up ?? false,
        } as any
      );

      if (!result) {
        return { error: 'Organization not found or unauthorized' };
      }

      await logActivity(team.id, user.id, ActivityType.UPDATE_ORGANIZATION);

      return { success: true };
    } catch (error) {
      console.error('Failed to update organization:', error);
      return { error: 'Failed to update organization' };
    }
  }
);

export async function updateOrganizationAddressAction(
  organizationId: number,
  address: { street?: string | null; city?: string | null; state?: string | null; zip?: string | null }
) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const result = await updateOrganization(organizationId, team.id, address as any);
  if (!result) return { error: 'Failed to update address' };

  await logActivity(team.id, user.id, ActivityType.UPDATE_ORGANIZATION);
  revalidatePath(`/app/organizations/${organizationId}`);
  return { success: true };
}

export async function updateOrganizationRegionsAction(organizationId: number, regions: string[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const result = await updateOrganization(organizationId, team.id, { regions } as any);
  if (!result) return { error: 'Failed to update regions' };

  await logActivity(team.id, user.id, ActivityType.UPDATE_ORGANIZATION);
  revalidatePath(`/app/organizations/${organizationId}`);
  revalidatePath('/app/organizations');
  return { success: true };
}

export async function setTeamLeaderAction(organizationId: number, contactId: number | null) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const result = await setOrganizationTeamLeader(organizationId, team.id, contactId);
  if (!result) return { error: 'Failed to update team leader' };

  revalidatePath(`/app/organizations/${organizationId}`);
  return { success: true };
}

export async function setOrganizationOrganizersAction(organizationId: number, userIds: number[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const { setOrganizersForOrganization } = await import('@/lib/db/supabase-queries');
  const ok = await setOrganizersForOrganization(organizationId, team.id, userIds);
  if (!ok) return { error: 'Failed to update organizers' };

  revalidatePath(`/app/organizations/${organizationId}`);
  revalidatePath('/app/organizations');
  revalidatePath('/app/my-contacts');
  return { success: true };
}
