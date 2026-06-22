'use server';

import { z } from 'zod';
import {
  getUser,
  getTeamForUser,
  createContact,
  updateContact,
  deleteContact,
  logActivity,
  addContactToOrganization,
  removeContactFromOrganization,
} from '@/lib/db/supabase-queries';
import { ActivityType } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

const createContactSchema = z.object({
  organizationId: z.number().optional(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export async function createContactAction(data: z.infer<typeof createContactSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = createContactSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const contact = await createContact({
      organization_id: validated.data.organizationId || null,
      name: validated.data.name,
      email: validated.data.email || null,
      phone: validated.data.phone || null,
      street: validated.data.street || null,
      city: validated.data.city || null,
      state: validated.data.state || null,
      zip: validated.data.zip || null,
      team_id: team.id,
      user_id: user.id,
    });

    // Also record in junction table for many-to-many
    if (validated.data.organizationId) {
      await addContactToOrganization(contact.id, validated.data.organizationId, team.id);
    }

    await logActivity(team.id, user.id, ActivityType.CREATE_CONTACT);
    revalidatePath('/app/contacts');
    if (validated.data.organizationId) {
      revalidatePath(`/app/organizations/${validated.data.organizationId}`);
    }

    return { success: 'Contact created', data: contact };
  } catch {
    return { error: 'Failed to create contact' };
  }
}

const updateContactSchema = z.object({
  id: z.number(),
  organizationId: z.number(),
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export async function updateContactAction(data: z.infer<typeof updateContactSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = updateContactSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const { id, organizationId, ...updates } = validated.data;
    const contact = await updateContact(id, team.id, updates);

    if (!contact) return { error: 'Contact not found' };

    await logActivity(team.id, user.id, ActivityType.UPDATE_CONTACT);
    revalidatePath(`/app/organizations/${organizationId}`);

    return { success: 'Contact updated', data: contact };
  } catch {
    return { error: 'Failed to update contact' };
  }
}

const bulkCreateContactsSchema = z.array(
  z.object({
    name: z.string().min(1),
    email: z.string().optional(),
    phone: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  })
);

export async function bulkCreateContactsAction(contacts: unknown[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = bulkCreateContactsSchema.safeParse(contacts);
  if (!validated.success) return { error: 'Invalid contact data' };

  const valid = validated.data.filter((c) => c.name.trim());
  if (valid.length === 0) return { error: 'No valid contacts to import' };

  try {
    const supabase = await import('@/lib/supabase/server').then((m) => m.createClient());
    const rows = valid.map((c) => ({
      name: c.name.trim(),
      email: c.email || null,
      phone: c.phone || null,
      street: c.street || null,
      city: c.city || null,
      state: c.state || null,
      zip: c.zip || null,
      team_id: team.id,
      user_id: user.id,
      organization_id: null,
    }));

    const { error } = await supabase.from('contacts').insert(rows);
    if (error) return { error: error.message };

    await logActivity(team.id, user.id, ActivityType.CREATE_CONTACT);
    revalidatePath('/app/contacts');

    return { success: `Imported ${valid.length} contacts` };
  } catch {
    return { error: 'Failed to import contacts' };
  }
}

const deleteContactSchema = z.object({
  id: z.number(),
  organizationId: z.number(),
});

export async function deleteContactAction(data: z.infer<typeof deleteContactSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = deleteContactSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const deleted = await deleteContact(validated.data.id, team.id);
    if (!deleted) return { error: 'Contact not found' };

    await logActivity(team.id, user.id, ActivityType.DELETE_CONTACT);
    revalidatePath(`/app/organizations/${validated.data.organizationId}`);

    return { success: 'Contact deleted' };
  } catch {
    return { error: 'Failed to delete contact' };
  }
}

export async function addContactOrganizationAction(contactId: number, organizationId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await addContactToOrganization(contactId, organizationId, team.id);
  if (!ok) return { error: 'Failed to add organization' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath(`/app/organizations/${organizationId}`);
  return { success: true };
}

export async function removeContactOrganizationAction(contactId: number, organizationId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const ok = await removeContactFromOrganization(contactId, organizationId, team.id);
  if (!ok) return { error: 'Failed to remove organization' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath(`/app/organizations/${organizationId}`);
  return { success: true };
}
