import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamForUser, getContactsForTeam, getCategoriesForTeam } from '@/lib/db/supabase-queries';
import { createClient } from '@/lib/supabase/server';
import ContactsList from './contacts-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SkeletonTable } from '@/components/ui/skeleton-field';
import UploadContactsCsvDialog from './upload-csv-dialog';

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
  const [contacts, categories] = await Promise.all([
    getContactsForTeam(team.id),
    getCategoriesForTeam(team.id),
  ]);

  const { data: assignmentRows } = await (supabase as any)
    .from('contact_category_assignments')
    .select('contact_id, category_id')
    .eq('team_id', team.id);

  // Build map: contactId -> Set of categoryIds
  const assignmentMap: Record<number, number[]> = {};
  for (const row of (assignmentRows || []) as any[]) {
    if (!assignmentMap[row.contact_id]) assignmentMap[row.contact_id] = [];
    assignmentMap[row.contact_id].push(row.category_id);
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
          />
        </Suspense>
      </div>
    </div>
  );
}
