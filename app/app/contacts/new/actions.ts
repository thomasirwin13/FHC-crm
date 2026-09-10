'use server';

import { z } from 'zod';
import {
  getUser,
  getTeamForUser,
  createOrganization,
  createContact,
  createOneOnOne,
  addContactToOrganization,
  setOrganizersForContact,
  logActivity,
} from '@/lib/db/supabase-queries';
import { ActivityType } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { notifyTeamMembers } from '@/lib/db/notifications';

const oneOnOneInputSchema = z.object({
  date: z.string().min(1),
  meeting_form: z.string().optional(),
  user_id: z.number().nullable().optional(),
  organizer_name: z.string().optional(),
  notes: z.string().optional(),
});

const fullContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  background: z.string().optional(),
  organizationId: z.number().optional(),
  engagement_level: z.string().optional(),
  regions: z.array(z.string()).optional(),
  organizerIds: z.array(z.number()).optional(),
  categories: z.array(z.string()).optional(),
  oneOnOnes: z.array(oneOnOneInputSchema).optional(),
});

export async function createFullContactAction(data: z.infer<typeof fullContactSchema>) {
  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const validated = fullContactSchema.safeParse(data);
  if (!validated.success) return { error: validated.error.errors[0].message };

  const d = validated.data;
  // Strip literal "All" from regions — it's not a real region name.
  const cleanRegions = (d.regions || []).filter((r) => r.toLowerCase() !== 'all');

  try {
    const contact = await createContact({
      organization_id: d.organizationId || null,
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      street: d.street || null,
      city: d.city || null,
      state: d.state || null,
      zip: d.zip || null,
      background: d.background || null,
      engagement_level: d.engagement_level || 'potential',
      regions: cleanRegions,
      team_id: team.id,
      user_id: user.id,
    } as any);

    // Many-to-many organization link
    if (d.organizationId) {
      await addContactToOrganization(contact.id, d.organizationId, team.id);
    }

    // Lead organizers (contact_organizers junction)
    if (d.organizerIds && d.organizerIds.length > 0) {
      await setOrganizersForContact(contact.id, team.id, d.organizerIds);
    }

    // Categories — upsert by name, then assign
    const categoryNames = Array.from(
      new Set((d.categories || []).map((c) => c.trim()).filter(Boolean))
    );
    if (categoryNames.length > 0) {
      const supabase = await createClient();
      const catRows = categoryNames.map((name) => ({ team_id: team.id, name, color: 'blue' }));
      await (supabase as any)
        .from('contact_categories')
        .upsert(catRows, { onConflict: 'team_id,name', ignoreDuplicates: false });

      const { data: teamCats } = await (supabase as any)
        .from('contact_categories')
        .select('id, name')
        .eq('team_id', team.id)
        .in('name', categoryNames);

      if (teamCats && teamCats.length > 0) {
        const assignments = (teamCats as any[]).map((c: any) => ({
          contact_id: contact.id,
          category_id: c.id,
          team_id: team.id,
        }));
        await (supabase as any)
          .from('contact_category_assignments')
          .upsert(assignments, { onConflict: 'contact_id,category_id', ignoreDuplicates: true });
      }
    }

    // 1-on-1 meetings
    for (const m of d.oneOnOnes || []) {
      if (!m.date) continue;
      await createOneOnOne({
        team_id: team.id,
        contact_id: contact.id,
        date: m.date,
        notes: m.notes || null,
        user_id: m.user_id ?? null,
        organizer_name: m.organizer_name || null,
        meeting_form: m.meeting_form || 'not_specified',
      } as any);
    }

    await logActivity(team.id, user.id, ActivityType.CREATE_CONTACT);
    revalidatePath('/app/contacts');
    if (d.organizationId) {
      revalidatePath(`/app/organizations/${d.organizationId}`);
    }

    const userName = user.name || user.email || 'Someone';
    notifyTeamMembers({
      teamId: team.id,
      excludeUserId: user.id,
      type: 'contact_created',
      title: `${userName} added a new contact: ${contact.name}`,
      link: `/app/contacts/${contact.id}`,
    }).catch(() => {});

    return { success: 'Contact created', data: contact };
  } catch {
    return { error: 'Failed to create contact' };
  }
}

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
