import { getTeamForUser, getMeetingsForTeam } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import { resolveActionNetworkKey } from '@/lib/integrations';
import MeetingsList from './meetings-list';
import LegislativeEventsSection from './legislative-events-section';
import { getEventsForTeam } from '../legislative/actions';
import { redirect } from 'next/navigation';
import MeetingsPageTabs from './meetings-page-tabs';

// Pulling attendance paginates across Action Network people + attendances, so
// give the server actions room beyond the default (Vercel Hobby caps at 60s).
export const maxDuration = 60;

export default async function MeetingsPage() {
  const team = await getTeamForUser();
  if (!team) redirect('/sign-in');

  const supabase = await createClient();
  const [meetings, legislativeEvents, { data: contactsRaw }, actionNetworkKey] = await Promise.all([
    getMeetingsForTeam(team.id),
    getEventsForTeam(),
    supabase.from('contacts').select('id, name, email').eq('team_id', team.id).order('name'),
    resolveActionNetworkKey(team.id),
  ]);
  const contacts = (contactsRaw || []) as { id: number; name: string; email: string | null }[];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings & events</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Meetings, gatherings, and legislative events
          </p>
        </div>
      </div>
      <MeetingsPageTabs
        meetingsContent={
          <MeetingsList
            initialMeetings={meetings}
            existingContacts={contacts}
            actionNetworkConfigured={!!actionNetworkKey}
          />
        }
        eventsContent={<LegislativeEventsSection initialEvents={legislativeEvents} />}
      />
    </div>
  );
}
