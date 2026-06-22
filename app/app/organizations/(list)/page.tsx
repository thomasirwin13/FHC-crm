import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamForUser, getOrganizationsForTeam } from '@/lib/db/supabase-queries';
import OrganizationsList from './organizations-list';
import UploadOrganizationsCsvDialog from './upload-csv-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SkeletonTable } from '@/components/ui/skeleton-field';

export default async function OrganizationsPage() {
  const team = await getTeamForUser();

  if (!team) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-4">Organizations</h1>
        <p className="text-muted-foreground">No team found. Please contact support.</p>
      </div>
    );
  }

  const organizations = await getOrganizationsForTeam(team.id);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Manage your organizations and track opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadOrganizationsCsvDialog existingOrganizations={organizations} />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-shrink-0 border-border hover:bg-accent hover:border-foreground/20 transition-all duration-150"
          >
            <Link href="/app/organizations/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add organization</span>
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<SkeletonTable rows={5} cols={7} />}>
        <OrganizationsList initialOrganizations={organizations} teamId={team.id} />
      </Suspense>
    </div>
  );
}
