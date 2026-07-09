import { getTeamForUser, getMeetingsForTeam } from '@/lib/db/supabase-queries';
import MeetingsList from './meetings-list';
import PartifulImportDialog from './partiful-import-dialog';
import LegislativeEventsSection from './legislative-events-section';
import { getEventsForTeam } from '../legislative/actions';
import { redirect } from 'next/navigation';
import MeetingsPageTabs from './meetings-page-tabs';

export default async function MeetingsPage() {
  const team = await getTeamForUser();
  if (!team) redirect('/sign-in');

  const [meetings, legislativeEvents] = await Promise.all([
    getMeetingsForTeam(team.id),
    getEventsForTeam(),
  ]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings & events</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Meetings, gatherings, and legislative events
          </p>
        </div>
        <PartifulImportDialog meetings={meetings} />
      </div>
      <MeetingsPageTabs
        meetingsContent={<MeetingsList initialMeetings={meetings} />}
        eventsContent={<LegislativeEventsSection initialEvents={legislativeEvents} />}
      />
    </div>
  );
}
