'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getUser,
  getTeamForUser,
  addCategoryToContact,
  removeCategoryFromContact,
  createCategory,
  deleteCategory,
  updateContact,
} from '@/lib/db/supabase-queries';

export async function addContactCategoryAction(contactId: number, categoryId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await addCategoryToContact(contactId, categoryId, team.id);
  if (!ok) return { error: 'Failed to add category' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/reports');
  return { success: true };
}

export async function removeContactCategoryAction(contactId: number, categoryId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await removeCategoryFromContact(contactId, categoryId, team.id);
  if (!ok) return { error: 'Failed to remove category' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/reports');
  return { success: true };
}

export async function createCategoryAction(name: string, color: string) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const category = await createCategory(team.id, name.trim(), color);
  if (!category) return { error: 'Failed to create category (name may already exist)' };

  revalidatePath('/app/reports');
  return { success: true, category };
}

export async function deleteCategoryAction(categoryId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await deleteCategory(categoryId, team.id);
  if (!ok) return { error: 'Failed to delete category' };

  revalidatePath('/app/reports');
  return { success: true };
}

export async function mergeCategoriesAction(primaryId: number, secondaryIds: number[]) {
  if (secondaryIds.length === 0) return { error: 'No categories to merge' };

  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();

  // Get contact IDs already assigned to primary (to avoid unique constraint violations)
  const { data: existingLinks } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .eq('category_id', primaryId);
  const alreadyLinked = new Set(((existingLinks || []) as any[]).map((r: any) => r.contact_id));

  // Get all assignments from secondary categories
  const { data: secondaryLinks } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id')
    .in('category_id', secondaryIds);

  // Insert only contacts not already linked to primary
  const toInsert = ((secondaryLinks || []) as any[])
    .filter((r: any) => !alreadyLinked.has(r.contact_id))
    .map((r: any) => ({ contact_id: r.contact_id, category_id: primaryId, team_id: team.id }));

  if (toInsert.length > 0) {
    await (supabase as any)
      .from('contact_category_assignments')
      .upsert(toInsert, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
  }

  // Delete secondary categories (cascade deletes their assignments)
  await (supabase as any)
    .from('contact_categories')
    .delete()
    .in('id', secondaryIds)
    .eq('team_id', team.id);

  revalidatePath('/app/reports');
  revalidatePath('/app/contacts');
  return { success: `Merged ${secondaryIds.length} categor${secondaryIds.length !== 1 ? 'ies' : 'y'}` };
}

export async function updateEngagementLevelAction(contactId: number, level: string) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const updated = await updateContact(contactId, team.id, { engagement_level: level } as any);
  if (!updated) return { error: 'Failed to update' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/contacts');
  return { success: true };
}

export async function updatePreferredContactMethodAction(contactId: number, method: string) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };
  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const updated = await updateContact(contactId, team.id, { preferred_contact_method: method || null } as any);
  if (!updated) return { error: 'Failed to update' };

  revalidatePath(`/app/contacts/${contactId}`);
  return { success: true };
}
