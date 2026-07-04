'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';

export async function mergeOrganizationsAction(primaryId: number, duplicateIds: number[]) {
  if (duplicateIds.length === 0) return { error: 'No duplicates to merge' };

  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();

  // 1. Fetch primary
  const { data: primary } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', primaryId)
    .eq('team_id', team.id)
    .single();

  if (!primary) return { error: 'Primary organization not found' };

  const { data: duplicates } = await supabase
    .from('organizations')
    .select('*')
    .in('id', duplicateIds)
    .eq('team_id', team.id);

  if (!duplicates || duplicates.length === 0) return { error: 'Duplicate organizations not found' };

  // 2. Fill nulls in primary from duplicates
  const fillableFields = ['description', 'website', 'type', 'size'] as const;
  const fieldUpdates: Record<string, string> = {};
  for (const field of fillableFields) {
    if (!(primary as any)[field]) {
      const donor = duplicates.find((d) => (d as any)[field]);
      if (donor) fieldUpdates[field] = (donor as any)[field];
    }
  }
  if (Object.keys(fieldUpdates).length > 0) {
    await supabase.from('organizations').update(fieldUpdates).eq('id', primaryId);
  }

  // 3. Transfer contacts (organization_id column)
  await supabase
    .from('contacts')
    .update({ organization_id: primaryId })
    .in('organization_id', duplicateIds)
    .eq('team_id', team.id);

  // 4. Transfer contact_organizations junction rows (skip conflicts)
  const { data: existingLinks } = await (supabase as any)
    .from('contact_organizations')
    .select('contact_id')
    .eq('organization_id', primaryId);

  const alreadyLinked = new Set(((existingLinks || []) as any[]).map((r: any) => r.contact_id));

  const { data: dupLinks } = await (supabase as any)
    .from('contact_organizations')
    .select('contact_id, team_id')
    .in('organization_id', duplicateIds);

  const newLinks = ((dupLinks || []) as any[]).filter((r: any) => !alreadyLinked.has(r.contact_id));
  if (newLinks.length > 0) {
    await (supabase as any).from('contact_organizations').insert(
      newLinks.map((r: any) => ({ contact_id: r.contact_id, organization_id: primaryId, team_id: r.team_id }))
    );
  }
  await (supabase as any).from('contact_organizations').delete().in('organization_id', duplicateIds);

  // 5. Clear team_leader_id on duplicates if it points to any contact (avoid FK issues on delete)
  await supabase.from('organizations').update({ team_leader_id: null } as any).in('id', duplicateIds);

  // 6. Delete duplicates
  await supabase.from('organizations').delete().in('id', duplicateIds).eq('team_id', team.id);

  revalidatePath('/app/organizations');
  return { success: `Merged ${duplicateIds.length} duplicate(s) into ${primary.name}` };
}
