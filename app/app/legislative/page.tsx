import { redirect } from 'next/navigation';
import { getTeamForUser } from '@/lib/db/supabase-queries';
import { resolveActionNetworkKey } from '@/lib/integrations';
import { getBillsForTeam } from './actions';
import LegislativeDashboardClient from './legislative-dashboard-client';
import ActionNetworkParticipation from './action-network-participation';

// The participation tracker paginates across Action Network people + action
// members, so give the server action room beyond the default (Hobby caps at 60s).
export const maxDuration = 60;

export default async function LegislativePage() {
  const team = await getTeamForUser();
  if (!team) redirect('/sign-in');

  const [bills, actionNetworkKey] = await Promise.all([
    getBillsForTeam(),
    resolveActionNetworkKey(team.id),
  ]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 lg:px-8 py-5 border-b border-border/50 bg-background">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Legislative tracker</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Track California bills and priority actions
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <ActionNetworkParticipation configured={!!actionNetworkKey} />
        <LegislativeDashboardClient bills={bills} />
      </div>
    </div>
  );
}
