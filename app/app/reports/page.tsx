import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getCategoryContactCounts, getCategoriesForTeam, getContactsByCategory } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import ReportsClient from './reports-client';

export default async function ReportsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const team = await getTeamForUser();
  if (!team) redirect('/login');

  const supabase = await createClient();

  const [categoryCounts, allCategories] = await Promise.all([
    getCategoryContactCounts(team.id),
    getCategoriesForTeam(team.id),
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

  const { data: noOrgContacts } = await (supabase as any)
    .from('contacts')
    .select('id, name, email, phone, city, state')
    .eq('team_id', team.id)
    .is('organization_id', null)
    .order('name');

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
      />
    </div>
  );
}
