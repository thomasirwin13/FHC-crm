'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationById,
  logActivity,
  getTeamForUser,
  unlinkContactsFromOrganization,
  getContactsForOrganization,
  deleteContact,
  getUser,
} from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import {
  validatedActionWithUser
} from '@/lib/auth/middleware';
import { ActivityType } from '@/lib/db/schema';
import { organizationStatusSchema, DEFAULT_ORGANIZATION_STATUS } from '@/lib/constants/organization';

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  website: z.string()
    .transform((val) => {
      if (!val) return '';
      // Add https:// if no protocol is specified
      if (val && !val.match(/^https?:\/\//)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url().optional().or(z.literal(''))),
  industry: z.string().optional(),
  size: z.string().optional(),
  status: organizationStatusSchema.optional().default(DEFAULT_ORGANIZATION_STATUS),
  type: z.string().optional(),
});

export const createOrganizationAction = validatedActionWithUser(
  createOrganizationSchema,
  async (data, _, user) => {
    const team = await getTeamForUser();
    if (!team) {
      return { error: 'No team found' };
    }

    try {
      const organization = await createOrganization({
        name: data.name,
        description: data.description || null,
        location: data.location || null,
        website: data.website || null,
        industry: data.industry || null,
        size: data.size || null,
        status: data.status || 'Lead',
        type: data.type || null,
        user_id: user.id,
        team_id: team.id,
      });

      await logActivity(team.id, user.id, ActivityType.CREATE_ORGANIZATION);
      revalidatePath('/organizations');
      return { success: 'Organization created successfully', organization };
    } catch (error) {
      console.error('Failed to create organization:', error);
      return { error: 'Failed to create organization' };
    }
  }
);

const updateOrganizationSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
  name: z.string().min(1, 'Organization name is required').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  website: z.string()
    .transform((val) => {
      if (!val) return '';
      // Add https:// if no protocol is specified
      if (val && !val.match(/^https?:\/\//)) {
        return `https://${val}`;
      }
      return val;
    })
    .pipe(z.string().url().optional().or(z.literal(''))),
  industry: z.string().optional(),
  size: z.string().optional(),
  status: organizationStatusSchema.optional(),
  type: z.string().optional(),
});

export const updateOrganizationAction = validatedActionWithUser(
  updateOrganizationSchema,
  async (data, _, user) => {
    const team = await getTeamForUser();
    if (!team) {
      return { error: 'No team found' };
    }

    try {
      const organization = await getOrganizationById(data.id, team.id);
      if (!organization) {
        return { error: 'Organization not found' };
      }

      await updateOrganization(data.id, team.id, {
        name: data.name,
        description: data.description || null,
        location: data.location || null,
        website: data.website || null,
        industry: data.industry || null,
        size: data.size || null,
        status: data.status || undefined,
        type: data.type || null,
      });

      await logActivity(team.id, user.id, ActivityType.UPDATE_ORGANIZATION);
      revalidatePath('/organizations');
      return { success: 'Organization updated successfully' };
    } catch (error) {
      console.error('Failed to update organization:', error);
      return { error: 'Failed to update organization' };
    }
  }
);

const deleteOrganizationSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
  deleteContacts: z.string().optional().transform((val) => val === 'true'),
});

export const deleteOrganizationAction = validatedActionWithUser(
  deleteOrganizationSchema,
  async (data, _, user) => {
    const team = await getTeamForUser();
    if (!team) {
      return { error: 'No team found' };
    }

    try {
      // Handle contacts before deleting org
      if (data.deleteContacts) {
        const contacts = await getContactsForOrganization(data.id, team.id);
        for (const contact of contacts) {
          await deleteContact(contact.id, team.id);
        }
      } else {
        await unlinkContactsFromOrganization(data.id, team.id);
      }

      const result = await deleteOrganization(data.id, team.id);
      if ('error' in result) {
        return { error: result.error };
      }

      await logActivity(team.id, user.id, ActivityType.DELETE_ORGANIZATION);
      revalidatePath('/organizations');
      return { success: 'Organization deleted successfully' };
    } catch (error) {
      console.error('Failed to delete organization:', error);
      return { error: 'Failed to delete organization' };
    }
  }
);

const ORG_ENGAGEMENT_LEVEL_MAP: Record<string, string> = {
  activist: 'activist', '4': 'activist', 'level 4': 'activist', 'level4': 'activist',
  attender: 'attender', '3': 'attender', 'level 3': 'attender', 'level3': 'attender',
  participator: 'participator', '2': 'participator', 'level 2': 'participator', 'level2': 'participator',
  learner: 'learner', '1': 'learner', 'level 1': 'learner', 'level1': 'learner',
  potential: 'potential', '0': 'potential', 'level 0': 'potential', 'level0': 'potential',
};

function normalizeOrgEngagementLevel(val: string): string {
  return ORG_ENGAGEMENT_LEVEL_MAP[val.toLowerCase().trim()] ?? 'potential';
}

const bulkCreateOrganizationsSchema = z.array(
  z.object({
    name: z.string().min(1),
    engagement_level: z.string().optional(),
    industry: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
    size: z.string().optional(),
    description: z.string().optional(),
  })
);

export async function bulkCreateOrganizationsAction(organizations: unknown[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = bulkCreateOrganizationsSchema.safeParse(organizations);
  if (!validated.success) return { error: 'Invalid organization data' };

  const valid = validated.data.filter((o) => o.name.trim());
  if (valid.length === 0) return { error: 'No valid organizations to import' };

  try {
    const supabase = await createClient();
    const rows = valid.map((o) => ({
      name: o.name.trim(),
      engagement_level: normalizeOrgEngagementLevel(o.engagement_level || ''),
      industry: o.industry || null,
      website: o.website || null,
      location: o.location || null,
      size: o.size || null,
      description: o.description || null,
      status: 'Lead' as const,
      team_id: team.id,
      user_id: user.id,
    }));

    const { error } = await supabase.from('organizations').insert(rows as any);
    if (error) return { error: error.message };

    await logActivity(team.id, user.id, ActivityType.CREATE_ORGANIZATION);
    revalidatePath('/app/organizations');

    return { success: `Imported ${valid.length} organization${valid.length !== 1 ? 's' : ''}` };
  } catch {
    return { error: 'Failed to import organizations' };
  }
}
