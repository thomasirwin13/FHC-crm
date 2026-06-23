'use server';

import { revalidatePath } from 'next/cache';
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
