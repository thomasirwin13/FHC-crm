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
      />
    </div>
  );
}
