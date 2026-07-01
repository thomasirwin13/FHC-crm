import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getCategoryContactCounts, getCategoriesForTeam, getContactsByCategory, getContactsForTeam } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import ReportsClient from './reports-client';

export default async function ReportsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const team = await getTeamForUser();
  if (!team) redirect('/login');

  const supabase = await createClient();

  const [categoryCounts, allCategories, allTeamContacts] = await Promise.all([
    getCategoryContactCounts(team.id),
    getCategoriesForTeam(team.id),
    getContactsForTeam(team.id),
  ]);

  // Action committed stats
  const { count: committedCount } = await (supabase as any)
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('action_committed', true);

  const { count: totalCount } = await (supabase as any)
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id);

  // Preferred contact method breakdown (for committed contacts)
  const { data: methodRows } = await (supabase as any)
    .from('contacts')
    .select('preferred_contact_method')
    .eq('team_id', team.id)
    .eq('action_committed', true);

  const methodCounts: Record<string, number> = {};
  for (const row of (methodRows || [])) {
    const m = (row as any).preferred_contact_method || 'not_set';
    methodCounts[m] = (methodCounts[m] ?? 0) + 1;
  }

  // Fetch contacts for each category upfront (for the client)
  const categoryContacts: Record<number, any[]> = {};
  await Promise.all(
    categoryCounts.map(async (cat) => {
      categoryContacts[cat.id] = await getContactsByCategory(cat.id, team.id);
    })
  );

  // Also fetch committed contacts
  const { data: committedContacts } = await (supabase as any)
    .from('contacts')
    .select('id, name, email, phone, city, state, preferred_contact_method')
    .eq('team_id', team.id)
    .eq('action_committed', true)
    .order('name');

  // Data-quality reports
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

  // 1-on-1s by organizer
  const { data: oneOnOneRows } = await (supabase as any)
    .from('one_on_ones')
    .select('id, date, contact_id, user_id, organizer_name, contacts(id, name), users(id, name, email)')
    .eq('team_id', team.id)
    .order('date', { ascending: false });

  // Organizations with no contacts: fetch all orgs, then exclude those with contacts
  const { data: allOrgs } = await (supabase as any)
    .from('organizations')
    .select('id, name, industry, location, status')
    .eq('team_id', team.id)
    .order('name');

  const { data: orgsWithContacts } = await (supabase as any)
    .from('contacts')
    .select('organization_id')
    .eq('team_id', team.id)
    .not('organization_id', 'is', null);

  const orgsWithContactIds = new Set(((orgsWithContacts || []) as any[]).map((r: any) => r.organization_id));
  const noContactOrgs = ((allOrgs || []) as any[]).filter((o: any) => !orgsWithContactIds.has(o.id));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Contact lists by category and engagement status
          </p>
        </div>
      </div>

      <ReportsClient
        categoryCounts={categoryCounts}
        allCategories={allCategories}
        categoryContacts={categoryContacts}
        committedCount={committedCount ?? 0}
        totalCount={totalCount ?? 0}
        methodCounts={methodCounts}
        committedContacts={(committedContacts || []) as any[]}
        noEmailContacts={(noEmailContacts || []) as any[]}
        noOrgContacts={(noOrgContacts || []) as any[]}
        noContactOrgs={noContactOrgs as any[]}
        allTeamContacts={allTeamContacts as any[]}
        oneOnOnes={(oneOnOneRows || []) as any[]}
        teamMembers={(team.team_members || []).map((tm: any) => ({ id: tm.user?.id, name: tm.user?.name, email: tm.user?.email })).filter((m: any) => m.id)}
      />
    </div>
  );
}
