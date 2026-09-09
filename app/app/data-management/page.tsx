import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getContactsForTeam, getCategoriesForTeam, getContactsByCategory, getMeetingsForTeam } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import { resolveMailerLite } from '@/lib/integrations';
import DataManagementClient from './data-management-client';
import NewsletterSyncSection from './newsletter-sync-section';
import PartifulImportDialog from './partiful-import-dialog';

// Newsletter sync fetches all MailerLite subscribers, which can take a moment
// on large lists — give the server action room beyond the default.
export const maxDuration = 60;

export default async function DataManagementPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const team = await getTeamForUser();
  if (!team) redirect('/login');

  const supabase = await createClient();

  const [allCategories, allTeamContacts, meetings, mailerLite] = await Promise.all([
    getCategoriesForTeam(team.id),
    getContactsForTeam(team.id),
    getMeetingsForTeam(team.id),
    resolveMailerLite(team.id),
  ]);

  const partifulContacts = (allTeamContacts as any[]).map((c) => ({
    id: c.id as number,
    name: c.name as string,
    email: (c.email ?? null) as string | null,
  }));

  // Fetch contacts for each category (needed for newsletter subscriber check)
  const categoryContacts: Record<number, any[]> = {};
  await Promise.all(
    (allCategories as any[]).map(async (cat: any) => {
      categoryContacts[cat.id] = await getContactsByCategory(cat.id, team.id);
    })
  );

  // Contacts with no email
  const { data: noEmailContacts } = await (supabase as any)
    .from('contacts')
    .select('id, name, email, phone, city, state')
    .eq('team_id', team.id)
    .or('email.is.null,email.eq.')
    .order('name');

  // Contacts with no org: exclude contacts linked via junction table too
  const { data: junctionLinked } = await (supabase as any)
    .from('contact_organizations')
    .select('contact_id')
    .eq('team_id', team.id);

  const junctionLinkedIds = new Set(((junctionLinked || []) as any[]).map((r: any) => r.contact_id));

  const { data: noOrgContactsRaw } = await (supabase as any)
    .from('contacts')
    .select('id, name, email, phone, city, state')
    .eq('team_id', team.id)
    .is('organization_id', null)
    .order('name');

  const noOrgContacts = ((noOrgContactsRaw || []) as any[]).filter(
    (c: any) => !junctionLinkedIds.has(c.id)
  );

  // Organizations with no contacts
  const { data: allOrgs } = await (supabase as any)
    .from('organizations')
    .select('id, name, type, regions, status')
    .eq('team_id', team.id)
    .order('name');

  const [{ data: orgsWithContacts }, { data: junctionOrgLinks }] = await Promise.all([
    (supabase as any)
      .from('contacts')
      .select('organization_id')
      .eq('team_id', team.id)
      .not('organization_id', 'is', null),
    (supabase as any)
      .from('contact_organizations')
      .select('organization_id')
      .eq('team_id', team.id),
  ]);

  const orgsWithContactIds = new Set<number>([
    ...((orgsWithContacts || []) as any[]).map((r: any) => r.organization_id),
    ...((junctionOrgLinks || []) as any[]).map((r: any) => r.organization_id),
  ]);
  const noContactOrgs = ((allOrgs || []) as any[]).filter((o: any) => !orgsWithContactIds.has(o.id));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data management</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Identify and fix missing data across your contacts and organizations
          </p>
        </div>
        <PartifulImportDialog meetings={meetings} existingContacts={partifulContacts} />
      </div>

      <NewsletterSyncSection configured={!!mailerLite.apiKey} />

      <DataManagementClient
        noEmailContacts={(noEmailContacts || []) as any[]}
        noOrgContacts={noOrgContacts as any[]}
        noContactOrgs={noContactOrgs as any[]}
        allTeamContacts={allTeamContacts as any[]}
        allCategories={allCategories as any[]}
        categoryContacts={categoryContacts}
        teamMembers={(team.team_members || []).map((tm: any) => ({ id: tm.user?.id, name: tm.user?.name, email: tm.user?.email })).filter((m: any) => m.id)}
      />
    </div>
  );
}
