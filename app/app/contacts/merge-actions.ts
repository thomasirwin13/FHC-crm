'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getTeamForUser } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';

export async function mergeContactsAction(primaryId: number, duplicateIds: number[]) {
  if (duplicateIds.length === 0) return { error: 'No duplicates to merge' };

  const user = await getUser();
  if (!user) return { error: 'Not authenticated' };

  const team = await getTeamForUser();
  if (!team) return { error: 'No team found' };

  const supabase = await createClient();

  // 1. Fetch primary and duplicates
  const { data: primary } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .eq('team_id', team.id)
    .single();

  if (!primary) return { error: 'Primary contact not found' };

  const { data: duplicates } = await supabase
    .from('contacts')
    .select('*')
    .in('id', duplicateIds)
    .eq('team_id', team.id);

  if (!duplicates || duplicates.length === 0) return { error: 'Duplicate contacts not found' };

  // 2. Fill nulls in primary with first non-null value from duplicates.
  // Includes the fields surfaced in reports: preferred contact method
  // (newsletter/WhatsApp), lead organizer, background, and political districts.
  const fillableFields = [
    'phone', 'street', 'city', 'state', 'zip',
    'preferred_contact_method', 'background', 'assigned_user_id', 'engagement_level',
    'congressional_district', 'state_senate_district', 'state_assembly_district',
    'county', 'districts_updated_at',
  ] as const;
  const fieldUpdates: Record<string, any> = {};
  for (const field of fillableFields) {
    if (!(primary as any)[field] || (field === 'engagement_level' && (primary as any)[field] === 'potential')) {
      const donor = duplicates.find((d) => {
        const v = (d as any)[field];
        // For engagement_level, only a non-default value counts as worth keeping.
        return field === 'engagement_level' ? v && v !== 'potential' : v;
      });
      if (donor) fieldUpdates[field] = (donor as any)[field];
    }
  }

  // Weekly-action commitment is a boolean: keep it true if the primary OR any
  // duplicate was committed.
  if (!(primary as any).action_committed && duplicates.some((d) => (d as any).action_committed)) {
    fieldUpdates['action_committed'] = true;
  }

  // Handle email: if primary has no email, take duplicate's. If both differ,
  // push duplicate's email to email_secondary (if primary has no secondary yet).
  if (!primary.email) {
    const donor = duplicates.find((d) => d.email);
    if (donor) fieldUpdates['email'] = donor.email as string;
  } else {
    const existingSecondary = (primary as any).email_secondary;
    if (!existingSecondary) {
      const differentEmail = duplicates.find(
        (d) => d.email && d.email.toLowerCase() !== (primary.email as string).toLowerCase()
      );
      if (differentEmail) fieldUpdates['email_secondary'] = differentEmail.email as string;
    }
  }

  // Handle phone: same pattern as email.
  if (!primary.phone) {
    const donor = duplicates.find((d) => d.phone);
    if (donor) fieldUpdates['phone'] = donor.phone as string;
  } else {
    const existingSecondaryPhone = (primary as any).phone_secondary;
    if (!existingSecondaryPhone) {
      const differentPhone = duplicates.find(
        (d) => d.phone && d.phone !== primary.phone
      );
      if (differentPhone) fieldUpdates['phone_secondary'] = differentPhone.phone as string;
    }
  }

  if (Object.keys(fieldUpdates).length > 0) {
    await (supabase as any).from('contacts').update(fieldUpdates).eq('id', primaryId);
  }

  // 3. Transfer one_on_ones
  await (supabase as any).from('one_on_ones').update({ contact_id: primaryId }).in('contact_id', duplicateIds);

  // 4. Transfer meeting_attendance (skip meetings primary already attended)
  const { data: existingAttendance } = await (supabase as any)
    .from('meeting_attendance')
    .select('meeting_id')
    .eq('contact_id', primaryId);

  const attendedMeetingIds = new Set(((existingAttendance || []) as any[]).map((a) => a.meeting_id));

  const { data: dupAttendance } = await (supabase as any)
    .from('meeting_attendance')
    .select('meeting_id, team_id')
    .in('contact_id', duplicateIds);

  const newAttendance = ((dupAttendance || []) as any[]).filter(
    (a) => !attendedMeetingIds.has(a.meeting_id)
  );

  if (newAttendance.length > 0) {
    await (supabase as any).from('meeting_attendance').insert(
      newAttendance.map((a) => ({ meeting_id: a.meeting_id, contact_id: primaryId, team_id: a.team_id }))
    );
  }
  await (supabase as any).from('meeting_attendance').delete().in('contact_id', duplicateIds);

  // 5. Transfer contact_organizations (skip orgs primary is already linked to)
  const { data: existingOrgs } = await (supabase as any)
    .from('contact_organizations')
    .select('organization_id')
    .eq('contact_id', primaryId);

  const linkedOrgIds = new Set(((existingOrgs || []) as any[]).map((o) => o.organization_id));

  const { data: dupOrgs } = await (supabase as any)
    .from('contact_organizations')
    .select('organization_id, team_id')
    .in('contact_id', duplicateIds);

  const newOrgs = ((dupOrgs || []) as any[]).filter((o) => !linkedOrgIds.has(o.organization_id));

  if (newOrgs.length > 0) {
    await (supabase as any).from('contact_organizations').insert(
      newOrgs.map((o) => ({ contact_id: primaryId, organization_id: o.organization_id, team_id: o.team_id }))
    );
  }
  await (supabase as any).from('contact_organizations').delete().in('contact_id', duplicateIds);

  // 6. Transfer contact_category_assignments (skip categories primary is already in)
  const { data: existingCats } = await (supabase as any)
    .from('contact_category_assignments')
    .select('category_id')
    .eq('contact_id', primaryId);

  const linkedCatIds = new Set(((existingCats || []) as any[]).map((c) => c.category_id));

  const { data: dupCats } = await (supabase as any)
    .from('contact_category_assignments')
    .select('category_id, team_id')
    .in('contact_id', duplicateIds);

  const newCats = ((dupCats || []) as any[]).filter((c) => !linkedCatIds.has(c.category_id));

  if (newCats.length > 0) {
    await (supabase as any).from('contact_category_assignments').insert(
      newCats.map((c) => ({ contact_id: primaryId, category_id: c.category_id, team_id: c.team_id }))
    );
  }
  await (supabase as any).from('contact_category_assignments').delete().in('contact_id', duplicateIds);

  // 7. Delete duplicate contacts
  await supabase.from('contacts').delete().in('id', duplicateIds).eq('team_id', team.id);

  revalidatePath('/app/contacts');
  return { success: `Merged ${duplicateIds.length} duplicate(s) into ${primary.name}` };
}
