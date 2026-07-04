'use server';

import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  getUser,
  getTeamForUser,
  getOrganizationById,
  updateOrganization,
  logActivity,
} from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import { ActivityType } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

const REGIONS = [
  'Antelope Valley', 'San Fernando Valley', 'San Gabriel Valley', 'Metro/Central LA',
  'West LA', 'South LA', 'South East LA', 'South Bay', 'Orange County', 'Other',
] as const;
const TYPES = ['Church', 'Community Group', 'Business', 'Nonprofit', 'School', 'Other'] as const;

const suggestionSchema = z.object({
  website: z.string().nullable().describe('Official website URL, or null if not reasonably known'),
  street: z.string().nullable().describe('Street address, or null'),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  type: z.enum(TYPES).nullable(),
  description: z.string().nullable().describe('One or two factual sentences, or null'),
  regions: z.array(z.enum(REGIONS)).describe('Applicable LA-area regions; [] if unsure'),
});

export type OrgSuggestion = z.infer<typeof suggestionSchema>;

export interface SuggestionItem {
  id: number;
  name: string;
  current: OrgSuggestion;
  suggestion: OrgSuggestion;
}

function pickCurrent(o: any): OrgSuggestion {
  return {
    website: o.website ?? null,
    street: o.street ?? null,
    city: o.city ?? null,
    state: o.state ?? null,
    zip: o.zip ?? null,
    type: (o.type ?? null) as OrgSuggestion['type'],
    description: o.description ?? null,
    regions: (o.regions ?? []) as OrgSuggestion['regions'],
  };
}

async function suggestForOrg(org: any): Promise<OrgSuggestion | null> {
  const context = [
    org.website ? `Known website: ${org.website}` : '',
    org.city || org.state ? `Known location: ${[org.city, org.state].filter(Boolean).join(', ')}` : '',
    org.type ? `Known type: ${org.type}` : '',
  ].filter(Boolean).join('\n');

  try {
    const { object } = await generateObject({
      model: openai('gpt-5.2'),
      schema: suggestionSchema,
      prompt: `You are enriching a CRM of faith-based and housing-advocacy organizations, mostly in the greater Los Angeles area.
Based only on what you reliably know, suggest details for the organization named "${org.name}".
${context}

Rules:
- Return null for ANY field you are not reasonably confident about. Do NOT guess or invent addresses, websites, or ZIP codes.
- "type" must be one of: ${TYPES.join(', ')}.
- "regions" must be a subset of: ${REGIONS.join(', ')} (return [] if unsure).
- "description" should be one or two factual sentences, or null if unknown.`,
    });
    return object;
  } catch (e) {
    console.error('suggestForOrg failed for', org.id, e);
    return null;
  }
}

/** Generate suggestions for a single organization. */
export async function suggestOrganizationDetailsAction(orgId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const org = await getOrganizationById(orgId, team.id);
  if (!org) return { error: 'Organization not found' };

  const suggestion = await suggestForOrg(org);
  if (!suggestion) return { error: 'Could not generate suggestions' };

  return { success: true, item: { id: org.id, name: org.name, current: pickCurrent(org), suggestion } as SuggestionItem };
}

/** Generate suggestions for a small batch of orgs (client loops over batches). */
export async function suggestOrganizationsBatchAction(orgIds: number[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };
  if (orgIds.length === 0) return { success: true, items: [] as SuggestionItem[] };

  const supabase = await createClient();
  const { data: orgs } = await (supabase as any)
    .from('organizations')
    .select('*')
    .eq('team_id', team.id)
    .in('id', orgIds.slice(0, 8)); // hard cap per request

  const items = (
    await Promise.all(
      ((orgs || []) as any[]).map(async (o) => {
        const s = await suggestForOrg(o);
        return s ? ({ id: o.id, name: o.name, current: pickCurrent(o), suggestion: s } as SuggestionItem) : null;
      })
    )
  ).filter(Boolean) as SuggestionItem[];

  return { success: true, items };
}

/** Persist the fields the user approved from a suggestion. */
export async function applyOrganizationSuggestionAction(orgId: number, patch: Record<string, any>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };
  if (!patch || Object.keys(patch).length === 0) return { success: true };

  const result = await updateOrganization(orgId, team.id, patch as any);
  if (!result) return { error: 'Failed to apply suggestion' };

  await logActivity(team.id, user.id, ActivityType.UPDATE_ORGANIZATION);
  revalidatePath(`/app/organizations/${orgId}`);
  revalidatePath('/app/organizations');
  return { success: true };
}
