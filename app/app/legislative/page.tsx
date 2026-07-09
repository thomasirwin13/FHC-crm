import { redirect } from 'next/navigation';
import { getTeamForUser } from '@/lib/db/supabase-queries';
import { getBillsForTeam, getEventsForTeam } from './actions';
import LegislativeDashboardClient from './legislative-dashboard-client';

export default async function LegislativePage() {
  const team = await getTeamForUser();
  if (!team) redirect('/sign-in');

  const [bills, events] = await Promise.all([
    getBillsForTeam(),
    getEventsForTeam(),
  ]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 lg:px-8 py-5 border-b border-border/50 bg-background">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Legislative tracker</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Track California bills, events, and priority actions
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <LegislativeDashboardClient bills={bills} events={events} />
      </div>
    </div>
  );
}
