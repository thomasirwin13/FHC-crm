import { redirect } from 'next/navigation';
import { getUser, getTeamForUser, getContactsForOrganizer, getOneOnOnesForOrganizer } from '@/lib/db/supabase-queries';
import MyContactsClient from './my-contacts-client';

export default async function MyContactsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const team = await getTeamForUser();
  if (!team) redirect('/login');

  const [contacts, oneOnOnes] = await Promise.all([
    getContactsForOrganizer(user.id, team.id),
    getOneOnOnesForOrganizer(user.id, team.id),
  ]);

  return (
    <MyContactsClient
      contacts={contacts}
      oneOnOnes={oneOnOnes}
      userName={user.name || user.email}
    />
  );
}
