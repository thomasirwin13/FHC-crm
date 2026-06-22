import { redirect } from 'next/navigation';
import { getTeamForUser, getMeetingById, getContactsForTeam } from '@/lib/db/supabase-queries';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import MeetingDetail from './meeting-detail';

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const team = await getTeamForUser();
  if (!team) redirect('/sign-in');

  const { id } = await params;
  const meetingId = parseInt(id);
  if (!meetingId || isNaN(meetingId)) redirect('/app/meetings');

  const [meeting, contacts] = await Promise.all([
    getMeetingById(meetingId, team.id),
    getContactsForTeam(team.id),
  ]);

  if (!meeting) redirect('/app/meetings');

  const breadcrumbItems = [
    { label: 'Meetings', href: '/app/meetings' },
    { label: meeting.name, isCurrentPage: true },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />
      <MeetingDetail meeting={meeting} allContacts={contacts} />
    </div>
  );
}
