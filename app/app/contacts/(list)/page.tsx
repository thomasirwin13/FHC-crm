import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamForUser, getContactsForTeam } from '@/lib/db/supabase-queries';
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

  const contacts = await getContactsForTeam(team.id);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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

      <Suspense fallback={<SkeletonTable rows={5} cols={6} />}>
        <ContactsList initialContacts={contacts} teamId={team.id} />
      </Suspense>
    </div>
  );
}
