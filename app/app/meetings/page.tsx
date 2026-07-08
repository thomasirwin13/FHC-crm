import { getTeamForUser, getMeetingsForTeam } from '@/lib/db/supabase-queries';
import MeetingsList from './meetings-list';
import PartifulImportDialog from './partiful-import-dialog';
import { redirect } from 'next/navigation';

export default async function MeetingsPage() {
  const team = await getTeamForUser();
  if (!team) redirect('/sign-in');

  const meetings = await getMeetingsForTeam(team.id);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Log monthly gatherings and track attendance
          </p>
        </div>
        <PartifulImportDialog meetings={meetings} />
      </div>
      <MeetingsList initialMeetings={meetings} />
    </div>
  );
}
