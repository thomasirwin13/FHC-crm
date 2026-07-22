import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamForUser, getContactsForTeam, getCategoriesForTeam, getUser } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import ContactsList from './contacts-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SkeletonTable } from '@/components/ui/skeleton-field';
import UploadContactsCsvDialog from './upload-csv-dialog';
import MailerLiteSyncDialog from './mailerlite-sync-dialog';
import ActionNetworkSyncDialog from './action-network-sync-dialog';
import { resolveActionNetworkKey, resolveMailerLite, resolveRegions } from '@/lib/integrations';
import BulkDistrictsButton from './bulk-districts-button';


// Action Network syncs paginate across people + petitions + events, so give
// the server action room beyond the default (Vercel Hobby caps at 60s).
export const maxDuration = 60;

export default async function ContactsPage() {
  const team = await getTeamForUser();

  if (!team) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-4">Contacts</h1>
        <p className="text-muted-foreground">No team found. Please contact support.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const [contacts, categories, currentUser, actionNetworkKey, mailerLite, regionOptions] = await Promise.all([
    getContactsForTeam(team.id),
    getCategoriesForTeam(team.id),
    getUser(),
    resolveActionNetworkKey(team.id),
    resolveMailerLite(team.id),
    resolveRegions(team.id),
  ]);

  const { data: orgRows } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('team_id', team.id)
    .order('name');
  const organizations = (orgRows || []) as { id: number; name: string }[];

  const teamMembers = ((team as any).team_members || []).map((m: any) => ({
    id: m.user.id as number,
    name: m.user.name as string | null,
    email: m.user.email as string,
  }));

  const [{ data: assignmentRows }, { data: organizerRows }, { data: oneOnOneRows }] = await Promise.all([
    (supabase as any)
      .from('contact_category_assignments')
      .select('contact_id, category_id')
      .eq('team_id', team.id),
    (supabase as any)
      .from('contact_organizers')
      .select('contact_id, user_id')
      .eq('team_id', team.id),
    supabase
      .from('one_on_ones')
      .select('contact_id, date')
      .eq('team_id', team.id)
      .order('date', { ascending: false }),
  ]);

  // Build map: contactId -> Set of categoryIds
  const assignmentMap: Record<number, number[]> = {};
  for (const row of (assignmentRows || []) as any[]) {
    if (!assignmentMap[row.contact_id]) assignmentMap[row.contact_id] = [];
    assignmentMap[row.contact_id].push(row.category_id);
  }

  // Build map: contactId -> organizer user IDs
  const contactOrganizerMap: Record<number, number[]> = {};
  for (const row of (organizerRows || []) as any[]) {
    if (!contactOrganizerMap[row.contact_id]) contactOrganizerMap[row.contact_id] = [];
    contactOrganizerMap[row.contact_id].push(row.user_id);
  }

  // Build map: contactId -> most recent 1-on-1 date
  const lastOneOnOneMap: Record<number, string> = {};
  for (const row of (oneOnOneRows || []) as any[]) {
    if (row.contact_id && row.date && !lastOneOnOneMap[row.contact_id]) {
      lastOneOnOneMap[row.contact_id] = row.date;
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 lg:px-8 py-5 border-b border-border/50 bg-background">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Manage your contacts and their organization associations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkDistrictsButton />
          <ActionNetworkSyncDialog configured={!!actionNetworkKey} />
          <MailerLiteSyncDialog configured={!!mailerLite.apiKey} />
          <UploadContactsCsvDialog existingContacts={contacts} />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
          >
            <Link href="/app/contacts/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add contact</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <Suspense fallback={<SkeletonTable rows={5} cols={6} />}>
          <ContactsList
            initialContacts={contacts}
            teamId={team.id}
            categories={categories as any[]}
            assignmentMap={assignmentMap}
            teamMembers={teamMembers}
            currentUserId={currentUser?.id ?? null}
            organizations={organizations}
            regionOptions={regionOptions}
            contactOrganizerMap={contactOrganizerMap}
            lastOneOnOneMap={lastOneOnOneMap}
          />
        </Suspense>
      </div>
    </div>
  );
}
