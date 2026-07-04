'use server';

import { z } from 'zod';
import {
  getUser,
  getTeamForUser,
  createContact,
  createOrganization,
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
  email_secondary: z.string().optional(),
  phone: z.string().optional(),
  phone_secondary: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  background: z.string().optional(),
  assigned_user_id: z.number().nullable().optional(),
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

const ENGAGEMENT_LEVEL_MAP: Record<string, string> = {
  activist: 'activist', '4': 'activist', 'level 4': 'activist', 'level4': 'activist',
  attender: 'attender', '3': 'attender', 'level 3': 'attender', 'level3': 'attender',
  participator: 'participator', '2': 'participator', 'level 2': 'participator', 'level2': 'participator',
  learner: 'learner', '1': 'learner', 'level 1': 'learner', 'level1': 'learner',
  potential: 'potential', '0': 'potential', 'level 0': 'potential', 'level0': 'potential',
};

function normalizeEngagementLevel(val: string): string {
  return ENGAGEMENT_LEVEL_MAP[val.toLowerCase().trim()] ?? 'potential';
}

function parseBool(val: string): boolean {
  return ['yes', 'y', 'true', '1', 'x'].includes(val.toLowerCase().trim());
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
    engagement_level: z.string().optional(),
    action_committed: z.string().optional(),
    preferred_contact_method: z.string().optional(),
    categories: z.string().optional(),
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
      engagement_level: normalizeEngagementLevel(c.engagement_level || ''),
      action_committed: c.action_committed ? parseBool(c.action_committed) : false,
      preferred_contact_method: c.preferred_contact_method || null,
      team_id: team.id,
      user_id: user.id,
      organization_id: null,
    }));

    const { data: inserted, error } = await supabase.from('contacts').insert(rows as any).select('id');
    if (error) return { error: error.message };

    // Handle category assignments
    const categoryNames = new Set<string>();
    valid.forEach((c) => {
      if (c.categories) {
        c.categories.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => categoryNames.add(n));
      }
    });

    if (categoryNames.size > 0 && inserted && inserted.length > 0) {
      // Upsert categories
      const catRows = Array.from(categoryNames).map((name) => ({ team_id: team.id, name, color: 'blue' }));
      await supabase.from('contact_categories' as any).upsert(catRows, { onConflict: 'team_id,name', ignoreDuplicates: false });

      // Fetch all relevant categories
      const { data: teamCats } = await supabase
        .from('contact_categories' as any)
        .select('id, name')
        .eq('team_id', team.id)
        .in('name', Array.from(categoryNames));

      if (teamCats && teamCats.length > 0) {
        const catByName: Record<string, number> = {};
        (teamCats as any[]).forEach((c: any) => { catByName[c.name] = c.id; });

        const assignments: { contact_id: number; category_id: number; team_id: number }[] = [];
        valid.forEach((c, i) => {
          if (!c.categories || !inserted[i]) return;
          c.categories.split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => {
            const catId = catByName[name];
            if (catId) assignments.push({ contact_id: inserted[i].id, category_id: catId, team_id: team.id });
          });
        });

        if (assignments.length > 0) {
          await supabase.from('contact_category_assignments' as any).upsert(assignments, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
        }
      }
    }

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

export async function linkExistingContactsAction(contactIds: number[], organizationId: number) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient());

  // Insert into contact_organizations junction (skip conflicts)
  const rows = contactIds.map((id) => ({ contact_id: id, organization_id: organizationId, team_id: team.id }));
  const { error } = await (supabase as any).from('contact_organizations').upsert(rows, { onConflict: 'contact_id,organization_id', ignoreDuplicates: true });
  if (error) return { error: error.message };

  // Also set organization_id on the contact if it doesn't have one already
  for (const contactId of contactIds) {
    await supabase.from('contacts').update({ organization_id: organizationId }).eq('id', contactId).is('organization_id', null);
  }

  revalidatePath(`/app/organizations/${organizationId}`);
  revalidatePath('/app/contacts');
  return { success: `Linked ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''}` };
}

export async function updateContactsFromCsvAction(updates: { contactId: number; email: string }[]) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient());

  let updated = 0;
  for (const { contactId, email } of updates) {
    const { error } = await supabase
      .from('contacts')
      .update({ email: email || null } as any)
      .eq('id', contactId)
      .eq('team_id', team.id);
    if (!error) updated++;
  }

  revalidatePath('/app/contacts');
  return { success: `Updated ${updated} contact${updated !== 1 ? 's' : ''}` };
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

export async function createAndLinkOrganizationAction(contactId: number, name: string) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Organization name is required' };

  let organization;
  try {
    organization = await createOrganization({
      name: trimmed,
      status: 'Potential Lead',
      user_id: user.id,
      team_id: team.id,
    });
  } catch {
    return { error: 'Failed to create organization' };
  }

  await logActivity(team.id, user.id, ActivityType.CREATE_ORGANIZATION);

  const ok = await addContactToOrganization(contactId, organization.id, team.id);
  if (!ok) return { error: 'Organization created but failed to link it' };

  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath(`/app/organizations/${organization.id}`);
  revalidatePath('/app/organizations');
  return { success: true, organization };
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
