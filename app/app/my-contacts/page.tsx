import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getContactsForOrganizer, getOneOnOnesForOrganizer, getCategoriesForTeam } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import { resolveRegions } from '@/lib/integrations';
import MyContactsClient from './my-contacts-client';

export default async function MyContactsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const team = await getTeamForUser();
  if (!team) redirect('/login');

  const supabase = await createClient();
  const [contacts, oneOnOnes, categories, regionOptions] = await Promise.all([
    getContactsForOrganizer(user.id, team.id),
    getOneOnOnesForOrganizer(user.id, team.id),
    getCategoriesForTeam(team.id),
    resolveRegions(team.id),
  ]);

  const [{ data: orgRows }, { data: orgOrganizerRows }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, status, type, city, state, regions, engagement_level')
      .eq('team_id', team.id)
      .order('name'),
    (supabase as any)
      .from('organization_organizers')
      .select('organization_id, user_id')
      .eq('team_id', team.id),
  ]);
  const organizations = (orgRows || []) as { id: number; name: string }[];

  const orgOrganizerMap: Record<number, number[]> = {};
  for (const row of (orgOrganizerRows || []) as any[]) {
    if (!orgOrganizerMap[row.organization_id]) orgOrganizerMap[row.organization_id] = [];
    orgOrganizerMap[row.organization_id].push(row.user_id);
  }

  const myOrganizations = (orgRows || []).filter((o: any) =>
    (orgOrganizerMap[o.id] || []).includes(user.id)
  );

  const teamMembers = ((team as any).team_members || []).map((m: any) => ({
    id: m.user.id as number,
    name: m.user.name as string | null,
    email: m.user.email as string,
  }));

  const [{ data: assignmentRows }, { data: organizerRows }] = await Promise.all([
    (supabase as any)
      .from('contact_category_assignments')
      .select('contact_id, category_id')
      .eq('team_id', team.id),
    (supabase as any)
      .from('contact_organizers')
      .select('contact_id, user_id')
      .eq('team_id', team.id),
  ]);

  const assignmentMap: Record<number, number[]> = {};
  for (const row of (assignmentRows || []) as any[]) {
    if (!assignmentMap[row.contact_id]) assignmentMap[row.contact_id] = [];
    assignmentMap[row.contact_id].push(row.category_id);
  }

  const contactOrganizerMap: Record<number, number[]> = {};
  for (const row of (organizerRows || []) as any[]) {
    if (!contactOrganizerMap[row.contact_id]) contactOrganizerMap[row.contact_id] = [];
    contactOrganizerMap[row.contact_id].push(row.user_id);
  }

  return (
    <MyContactsClient
      contacts={contacts}
      oneOnOnes={oneOnOnes}
      userName={user.name || user.email}
      categories={categories as any[]}
      teamMembers={teamMembers}
      organizations={organizations}
      regionOptions={regionOptions}
      assignmentMap={assignmentMap}
      contactOrganizerMap={contactOrganizerMap}
      myOrganizations={myOrganizations as any[]}
    />
  );
}
